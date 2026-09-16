# -*- coding: utf-8 -*-
"""
Reconstruct content/ (44 Markdown files + settings.yml + logos.yml) from the
rendered site in dist/.

The original content/ directory was not included in the handover; dist/ is the
only surviving copy of the source text. This script reverses build.py.

Verification is not by inspection: run

    python tools/extract.py && python build.py && python tools/verify.py

which rebuilds the site from the reconstructed content and diffs it against the
original dist/. A clean diff proves the reconstruction is lossless.

Usage:  python tools/extract.py [--out content] [--dist dist-original]
"""
import os, re, sys, html, json, glob, shutil, argparse, datetime
from collections import OrderedDict

from bs4 import BeautifulSoup, Tag
import soupsieve
import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from html2md import to_markdown, unsmarty, presentinel, sentinel_to_char

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NL_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
             'augustus', 'september', 'oktober', 'november', 'december']


# ---------------------------------------------------------------- YAML output
class Literal(str):
    """Marker type: force YAML block scalar (|-) for multi-line text."""


def _literal_representer(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:str', str(data), style='|')


yaml.add_representer(Literal, _literal_representer)
yaml.add_representer(OrderedDict,
                     lambda d, data: d.represent_mapping('tag:yaml.org,2002:map', data.items()))


def dump_yaml(data):
    return yaml.dump(data, allow_unicode=True, sort_keys=False,
                     default_flow_style=False, width=10_000)


def write_md(path, front_matter, body):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = '---\n' + dump_yaml(front_matter) + '---\n\n' + body.strip() + '\n'
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)


# ---------------------------------------------------------------- small helpers
def txt(node):
    """Visible text of a node, with build.py's escaping reversed."""
    if node is None:
        return ''
    return unsmarty(node.get_text()).strip()


def raw_txt(node):
    """Text with typographic characters restored (for values, not Markdown)."""
    if node is None:
        return ''
    return sentinel_to_char(node.get_text()).strip()


def soup_of(path):
    with open(path, encoding='utf-8') as fh:
        return BeautifulSoup(presentinel(fh.read()), 'html.parser')


def main_of(path):
    """The <main> element plus the raw page source."""
    with open(path, encoding='utf-8') as fh:
        page = presentinel(fh.read())
    body = page.split('<main id="main">', 1)[1].rsplit('</main>', 1)[0]
    return BeautifulSoup(body, 'html.parser'), page


def head_fields(page):
    s = BeautifulSoup(page.split('</head>')[0], 'html.parser')
    return {
        'seo_titel': sentinel_to_char(html.unescape(str(s.title.string))),
        'meta_omschrijving': sentinel_to_char(html.unescape(str(s.find('meta', attrs={'name': 'description'})['content']))),
        'noindex': 'noindex' in (s.find('meta', attrs={'name': 'robots'}) or {}).get('content', ''),
    }


def prose_to_md(node):
    """A div.prose / article.post element -> Markdown, dropping generated blocks."""
    clone = BeautifulSoup(str(node), 'html.parser')
    root = clone.find(True)
    for sel in ('div.tablewrap', 'div.faq', 'div.todo', 'div.btns', 'p.hint'):
        for el in root.select(sel):
            el.decompose()
    # The generated "Wat het kost" / "Veelgestelde vragen" headings are build.py's,
    # not the author's: they always carry the inline margin-top style.
    for h2 in root.find_all('h2'):
        if h2.get('style', '').startswith('margin-top:2.6rem'):
            h2.decompose()
    return to_markdown(root.decode_contents())


# ---------------------------------------------------------------- block readers
def read_faq(scope):
    block = scope.select_one('div.faq')
    if not block:
        return None
    return [OrderedDict(vraag=raw_txt(d.summary), antwoord=raw_txt(d.find('p')))
            for d in block.select('details')]


def read_price_table(scope):
    """The 'Wat het kost' two-column table on service pages."""
    for wrap in scope.select('div.tablewrap'):
        headers = [raw_txt(th) for th in wrap.select('th')]
        if headers == ['Wat', 'Vanaf']:
            return [OrderedDict(wat=raw_txt(tr.find_all('td')[0]),
                                vanaf=raw_txt(tr.find_all('td')[1]))
                    for tr in wrap.select('tbody tr')]
    return None


def read_projects(scope):
    for wrap in scope.select('div.tablewrap'):
        headers = [raw_txt(th) for th in wrap.select('th')]
        if headers[:2] == ['Project', 'Vanaf']:
            rows = []
            for tr in wrap.select('tbody tr'):
                tds = tr.find_all('td')
                rows.append(OrderedDict(wat=raw_txt(tds[0]), vanaf=raw_txt(tds[1]),
                                        link=tds[2].find('a')['href']))
            return rows
    return None


def read_packages(scope):
    plans = scope.select('div.plans div.plan')
    if not plans:
        return None
    out = []
    for p in plans:
        price = p.select_one('p.price')
        period = price.find('small')
        amount = price.contents[0]
        out.append(OrderedDict(
            naam=raw_txt(p.find('h3')),
            voor_wie=raw_txt(p.select_one('p.who')),
            prijs=str(amount).strip(),
            periode=raw_txt(period),
            uitgelicht='pick' in p.get('class', []),
            inbegrepen=[raw_txt(li) for li in p.select('ul li')],
        ))
    return out


def read_faq_from_schema(page):
    """Some pages carry `faq` in front matter without a {{faq}} token in the body:
    the data reaches the output only as FAQPage JSON-LD. Recover it from there."""
    s = BeautifulSoup(page, 'html.parser')
    for tag in s.select('script[type="application/ld+json"]'):
        obj = json.loads(sentinel_to_char(str(tag.string)))
        if obj.get('@type') == 'FAQPage':
            return [OrderedDict(vraag=q['name'],
                                antwoord=q['acceptedAnswer']['text'])
                    for q in obj['mainEntity']]
    return None


def read_todo(scope):
    block = scope.select_one('div.todo')
    if not block:
        return None
    text = raw_txt(block.find('p'))
    return text.replace('Nog aan te vullen.', '', 1).strip()


# ---------------------------------------------------------------- settings.yml
def extract_settings(dist):
    page = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()
    s = BeautifulSoup(page, 'html.parser')

    topbar = s.select_one('.topbar .wrap')
    tel_a = topbar.select_one('a[href^="tel:"]')
    mail_a = topbar.select_one('a[href^="mailto:"]')

    footer = s.select_one('footer.site .wrap')
    addr = footer.find('p', class_=None)
    # <p>{juridisch}<br>{straat}<br>{postcode} {stad}<br>BTW {btw}</p>
    lines = [str(x).strip() for x in addr.contents if not isinstance(x, Tag) or x.name != 'br']
    lines = [html.unescape(re.sub('<[^>]+>', '', l)).strip() for l in lines if str(x := l).strip()]
    juridisch, straat, plaats, btw_line = lines[0], lines[1], lines[2], lines[3]
    postcode, stad = plaats.split(' ', 1)
    btw = btw_line.replace('BTW', '', 1).strip()

    nav = [OrderedDict(label=html.unescape(a.get_text()), link=a['href'])
           for a in s.select('#navlist a.navlink')]
    cta = s.select_one('#navlist a.btn')

    socials = [OrderedDict(naam=a.get_text(), url=a['href'])
               for a in footer.select('a[rel~="me"]')]

    # The Formspree ID only appears on pages that render a form.
    formspree_id = ''
    for candidate in ('contact.html', 'gratis-marketingscan.html'):
        p = os.path.join(dist, candidate)
        if os.path.exists(p):
            m = re.search(r'formspree\.io/f/([^"]*)', open(p, encoding='utf-8').read())
            if m:
                formspree_id = m.group(1)
                break

    return OrderedDict(
        bedrijf=OrderedDict(
            naam='One Man Agency',
            juridisch=juridisch,
            straat=straat,
            postcode=int(postcode) if postcode.isdigit() else postcode,
            stad=stad,
            btw=btw,
            telefoon=tel_a.get_text().strip(),
            telefoon_link=tel_a['href'].replace('tel:', ''),
            email=mail_a.get_text().strip(),
            slogan=raw_txt(footer.select_one('p.tagline')),
        ),
        navigatie=nav,
        knop=OrderedDict(label=html.unescape(cta.get_text()), link=cta['href']),
        formspree_id=formspree_id,
        socials=socials,
    )


# ---------------------------------------------------------------- logos.yml
def extract_logos(dist):
    s = soup_of(os.path.join(dist, 'referenties.html'))
    out = []
    for fig in s.select('.logowall figure.logo'):
        name_el = fig.select_one('.logonaam')
        src = fig.find('img')['src']
        out.append(OrderedDict(
            naam=html.unescape(name_el.get_text()) if name_el else 'Klant',
            bestand=os.path.basename(src),
            url=src,
        ))
    return {'logos': out}


# ---------------------------------------------------------------- blog
def extract_blog(dist, out_dir, redirects):
    categories = read_blog_categories(dist)
    posts = []
    for path in sorted(glob.glob(os.path.join(dist, 'blog', '*.html'))):
        slug = os.path.basename(path)[:-5]
        m, page = main_of(path)
        fm = OrderedDict()
        fm['titel'] = txt(m.find('h1'))
        head = head_fields(page)
        fm['seo_titel'] = head['seo_titel']
        fm['meta_omschrijving'] = head['meta_omschrijving']

        # datePublished from the BlogPosting JSON-LD is authoritative.
        ld = [json.loads(t.string) for t in BeautifulSoup(page, 'html.parser')
              .select('script[type="application/ld+json"]')]
        blogposting = next(o for o in ld if o.get('@type') == 'BlogPosting')
        fm['datum'] = datetime.date.fromisoformat(blogposting['datePublished'])

        fm['categorie'] = categories.get(slug, '')

        fm['intro'] = raw_txt(m.select_one('header.pagehead p.lead'))
        fm['gepubliceerd'] = True
        legacy = redirects.get(f'/blog/{slug}')
        if legacy:
            fm['oude_url'] = legacy

        body = prose_to_md(m.select_one('article.post'))
        write_md(os.path.join(out_dir, 'blog', slug + '.md'), fm, body)
        posts.append(slug)
    return posts


def read_blog_categories(dist):
    """slug -> category. The post page only shows date + author; the category is
    rendered on the blog index, so that is the only place to recover it from."""
    out = {}
    index = os.path.join(dist, 'blog.html')
    if not os.path.exists(index):
        return out
    s = soup_of(index)
    for li in s.select('ul.postlist li'):
        link = li.select_one('h3 a')
        date_line = raw_txt(li.select_one('p.date'))
        if link and '·' in date_line:
            out[link['href'].rsplit('/', 1)[-1]] = date_line.split('·', 1)[1].strip()
    return out


# ---------------------------------------------------------------- diensten/sectoren/regio
def extract_simple(dist, out_dir, folder):
    slugs = []
    for path in sorted(glob.glob(os.path.join(dist, folder, '*.html'))):
        slug = os.path.basename(path)[:-5]
        m, page = main_of(path)
        head = head_fields(page)

        fm = OrderedDict()
        fm['titel'] = txt(m.find('h1'))
        fm['seo_titel'] = head['seo_titel']
        fm['meta_omschrijving'] = head['meta_omschrijving']
        fm['intro'] = raw_txt(m.select_one('header.pagehead p.lead'))

        prices = read_price_table(m)
        if prices:
            fm['prijzen'] = prices
        faq = read_faq(m) or read_faq_from_schema(page)
        if faq:
            fm['faq'] = faq
        todo = read_todo(m)
        if todo:
            fm['af_te_werken'] = todo

        prose = m.select('div.prose')
        # Region pages interleave the services list between two .prose divs; the
        # author's body is the first one.
        body = prose_to_md(prose[0])
        write_md(os.path.join(out_dir, folder, slug + '.md'), fm, body)
        slugs.append(slug)
    return slugs


# ---------------------------------------------------------------- paginas
def classify_section(sec):
    """Map a rendered top-level element back to its source shortcode, or None if
    it is author prose. Matches the element itself as well as its descendants:
    some blocks (agenda, faq, blogindex, pakketten, projecten) are emitted bare,
    not wrapped in a <section>."""
    def has(selector):
        return sec.select_one(selector) is not None or soupsieve.match(selector, sec)

    if has('ol.steps'):
        return '{{stappen}}'
    if has('div.quotes'):
        return '{{citaten}}'
    if has('ul.tags'):
        return '{{sectoren}}'
    if has('.logowall.klein'):
        return '{{logos-strook}}'
    if has('.logowall'):
        return '{{logos}}'
    if has('.facts-grid'):
        return '{{scan-blok}}'
    if has('ul.postlist'):
        return '{{blogindex}}'
    if has('div.agenda'):
        return '{{agenda}}'
    if has('div.plans'):
        return '{{pakketten}}'
    if has('div.faq'):
        return '{{faq}}'
    if has('div.tablewrap'):
        headers = [raw_txt(th) for th in sec.select('th')]
        if headers[:2] == ['Project', 'Vanaf']:
            return '{{projecten}}'
    if sec.select_one('div.rows'):
        # ServicesGrid carries a heading + CTA; ServicesGrouped has four groups.
        return '{{diensten}}' if sec.select_one('.btns') else '{{diensten-volledig}}'
    return None


def extract_paginas(dist, out_dir, agenda_urls):
    files = ['index.html', '404.html'] + [
        os.path.basename(p) for p in sorted(glob.glob(os.path.join(dist, '*.html')))
        if os.path.basename(p) not in ('index.html', '404.html')
    ]
    slugs = []
    for name in files:
        path = os.path.join(dist, name)
        if not os.path.exists(path):
            continue
        slug = 'home' if name == 'index.html' else name[:-5]
        m, page = main_of(path)
        head = head_fields(page)

        fm = OrderedDict()
        fm['titel'] = txt(m.find('h1'))
        fm['seo_titel'] = head['seo_titel']
        fm['meta_omschrijving'] = head['meta_omschrijving']
        fm['intro'] = raw_txt(m.select_one('p.lead'))
        if head['noindex']:
            fm['noindex'] = True

        # --- homepage-only structured fields
        if slug == 'home':
            hero_img = m.select_one('img.heroportret')
            band = m.select_one('img.bandbeeld')
            btns = m.select('header.sign .btns a')
            fm['knop_primair'] = html.unescape(btns[0].get_text())
            fm['knop_primair_link'] = btns[0]['href']
            fm['knop_secundair'] = html.unescape(btns[1].get_text())
            fm['knop_secundair_link'] = btns[1]['href']
            fm['portret'] = hero_img['src']
            fm['portret_alt'] = html.unescape(hero_img['alt'])
            fm['header_afbeelding'] = band['src']
            fm['header_alt'] = html.unescape(band['alt'])
            fm['cijfers'] = [OrderedDict(getal=raw_txt(d.find('b')),
                                         label=raw_txt(d).replace(raw_txt(d.find('b')), '', 1).strip())
                             for d in m.select('header.sign .facts > div')]
            quotes = m.select('div.quotes blockquote')
            if quotes:
                cites = []
                for q in quotes:
                    cite = raw_txt(q.find('cite'))
                    naam, _, functie = cite.partition('—')
                    cites.append(OrderedDict(
                        tekst=raw_txt(q.find('p')).strip('“”'),
                        naam=naam.strip(), functie=functie.strip()))
                fm['citaten'] = cites
            tags = m.select('ul.tags li')
            if tags:
                fm['sectoren_lijst'] = [raw_txt(li) for li in tags]

        # --- other optional fields
        form = m.select_one('form[action*="formspree"]')
        if form:
            fm['formulier'] = 'scan' if form.select_one('#f-gem') else 'contact'
        iframe = m.select_one('div.agenda iframe')
        if iframe:
            fm['agenda_url'] = iframe['src']
        packages = read_packages(m)
        if packages:
            fm['pakketten'] = packages
        projects = read_projects(m)
        if projects:
            fm['projecten'] = projects
        faq = read_faq(m) or read_faq_from_schema(page)
        if faq:
            fm['faq'] = faq
        todo = read_todo(m)
        if todo:
            fm['af_te_werken'] = todo

        body = build_page_body(m, slug)
        write_md(os.path.join(out_dir, 'paginas', slug + '.md'), fm, body)
        slugs.append(slug)
    return slugs


def build_page_body(m, slug):
    """Walk the page's top-level sections, emitting prose as Markdown and
    generated blocks as their source shortcode token."""
    parts = []

    if slug in ('contact', 'gratis-marketingscan'):
        prose = m.select_one('div.wrap.split div.prose')
        return prose_to_md(prose) if prose else ''

    for sec in m.children:
        if not isinstance(sec, Tag):
            continue
        if sec.name == 'header':
            continue  # hero / pagehead come from front matter
        # Bare headings and hint paragraphs at top level are always part of a
        # generated block group (pakketten, projecten, agenda); the block itself
        # is matched separately, so these are dropped.
        if sec.name in ('h2', 'h3') or (sec.name == 'p' and 'hint' in sec.get('class', [])):
            continue
        token = classify_section(sec)
        if token:
            if token not in parts:
                parts.append(token)
            continue
        if sec.select_one('div.todo') and not sec.select_one('div.prose'):
            continue  # the trailing af_te_werken notice is generated
        prose = sec.select_one('div.prose')
        if prose is not None:
            md = prose_to_md(prose)
            if md.strip():
                parts.append(md)
    return '\n\n'.join(parts)


# ---------------------------------------------------------------- redirects
def read_redirects(dist):
    """post slug -> legacy URL, from the generated _redirects file."""
    out = {}
    path = os.path.join(dist, '_redirects')
    if not os.path.exists(path):
        return out
    for line in open(path, encoding='utf-8'):
        parts = line.split()
        if len(parts) == 3 and parts[1].startswith('/blog/') and parts[1] != '/blog':
            out[parts[1]] = parts[0]
    return out


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dist', default=os.path.join(ROOT, 'dist-original'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'content'))
    args = ap.parse_args()

    dist, out_dir = args.dist, args.out
    if not os.path.isdir(dist):
        sys.exit(f'Reference build not found: {dist}')

    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)

    settings = extract_settings(dist)
    with open(os.path.join(out_dir, 'settings.yml'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(dump_yaml(settings))

    logos = extract_logos(dist)
    with open(os.path.join(out_dir, 'logos.yml'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(dump_yaml(logos))

    redirects = read_redirects(dist)
    posts = extract_blog(dist, out_dir, redirects)
    services = extract_simple(dist, out_dir, 'diensten')
    sectors = extract_simple(dist, out_dir, 'sectoren')
    regions = extract_simple(dist, out_dir, 'regio')
    pages = extract_paginas(dist, out_dir, {})

    print(f'settings.yml   1')
    print(f'logos.yml      {len(logos["logos"])} logos '
          f'({sum(1 for l in logos["logos"] if l["naam"] == "Klant")} named "Klant")')
    print(f'paginas        {len(pages)}')
    print(f'diensten       {len(services)}')
    print(f'sectoren       {len(sectors)}')
    print(f'regio          {len(regions)}')
    print(f'blog           {len(posts)}')
    total = len(pages) + len(services) + len(sectors) + len(regions) + len(posts)
    print(f'total md       {total}')


if __name__ == '__main__':
    main()
