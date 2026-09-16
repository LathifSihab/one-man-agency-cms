#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
One Man Agency — sitegenerator.

Leest alles uit content/ (markdown + yaml) en schrijft de volledige site naar dist/.
Draaien:  python3 build.py
"""
import os, re, json, shutil, html, datetime, glob
import yaml, markdown

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, 'content')
DIST = os.path.join(ROOT, 'dist')
SITE = 'https://www.onemanagency.be'
TODAY = datetime.date.today().isoformat()

MD = markdown.Markdown(extensions=['extra', 'sane_lists', 'smarty'])
S = yaml.safe_load(open(os.path.join(CONTENT, 'settings.yml'), encoding='utf-8'))
LOGOS = yaml.safe_load(open(os.path.join(CONTENT, 'logos.yml'), encoding='utf-8'))['logos']
B = S['bedrijf']
PAGINAS = []


# ------------------------------------------------------------------ helpers
def lees(pad):
    """Markdownbestand met frontmatter inlezen."""
    tekst = open(pad, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', tekst, re.S)
    if not m:
        return {}, tekst
    return yaml.safe_load(m.group(1)) or {}, m.group(2)


def mdhtml(tekst):
    MD.reset()
    return MD.convert(tekst or '')


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False) + '</script>'


def nl_datum(d):
    maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
               'augustus', 'september', 'oktober', 'november', 'december']
    return f'{d.day} {maanden[d.month - 1]} {d.year}'


ORG = {
    '@context': 'https://schema.org', '@type': 'ProfessionalService',
    '@id': SITE + '/#organisatie', 'name': B['naam'], 'alternateName': B['juridisch'],
    'description': ("One Man Agency is een eenmansmarketingbureau uit Dendermonde, opgericht door "
                    "Niels Van de Meersch, dat KMO's in Oost-Vlaanderen begeleidt in marketingstrategie, "
                    "branding, webdesign, SEO, Google Ads, social media, e-mailmarketing, drukwerk en AI."),
    'slogan': B['slogan'], 'url': SITE, 'telephone': B['telefoon_link'], 'email': B['email'],
    'vatID': B['btw'].replace(' ', '').replace('.', ''), 'priceRange': '€€', 'currenciesAccepted': 'EUR',
    'image': SITE + '/assets/og-image.png',
    'founder': {'@type': 'Person', '@id': SITE + '/#niels', 'name': 'Niels Van de Meersch',
                'jobTitle': 'Zaakvoerder en marketingstrateeg', 'image': SITE + '/assets/niels.jpg',
                'worksFor': {'@id': SITE + '/#organisatie'},
                'sameAs': [s['url'] for s in S['socials']]},
    'address': {'@type': 'PostalAddress', 'streetAddress': B['straat'], 'postalCode': str(B['postcode']),
                'addressLocality': B['stad'], 'addressRegion': 'Oost-Vlaanderen', 'addressCountry': 'BE'},
    'areaServed': ['Dendermonde', 'Lebbeke', 'Buggenhout', 'Zele', 'Berlare', 'Hamme', 'Temse',
                   'Sint-Niklaas', 'Aalst', 'Wetteren', 'Londerzeel', 'Opwijk', 'Oost-Vlaanderen'],
    'openingHoursSpecification': [{'@type': 'OpeningHoursSpecification',
                                   'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                                   'opens': '08:30', 'closes': '18:00'}],
    'sameAs': [s['url'] for s in S['socials']],
}

DIENSTEN_KORT = [
    ('marketingstrategie', 'Marketingstrategie', 'Weten waar je naartoe gaat, voor je geld uitgeeft.'),
    ('branding-en-huisstijl', 'Branding &amp; huisstijl', 'Een merk dat blijft hangen, van logo tot toon.'),
    ('webdesign', 'Webdesign', 'Een website die vragen beantwoordt en klanten oplevert.'),
    ('seo-en-geo', 'SEO &amp; GEO', 'Gevonden worden in Google én in AI-antwoorden.'),
    ('google-ads', 'Google Ads', 'Bovenaan staan op het moment dat iemand koopklaar zoekt.'),
    ('social-media', 'Social media', 'Een contentkalender die doorloopt, ook als jij het druk hebt.'),
    ('e-mailmarketing', 'E-mailmarketing', 'Je bestaande klanten zijn je goedkoopste omzet.'),
    ('grafische-vormgeving-en-drukwerk', 'Vormgeving &amp; drukwerk', 'Van visitekaartje tot gevelreclame.'),
    ('foto-en-video', 'Foto &amp; video', 'Echte beelden van jouw zaak, geen stockfoto’s.'),
    ('ai-voor-kmo', 'AI voor KMO’s', 'Tijd winnen op administratie, offertes en klantcommunicatie.'),
]

STAPPEN = [
    ('Kennismaking van 30 minuten, gratis', 'Ik luister. Jij vertelt wat er scheelt. We kijken of het klikt.'),
    ('Voorstel op maat', 'Eén pagina. Wat ik doe, wat het kost, wanneer het klaar is.'),
    ('Uitvoering', 'Ik werk. Jij doet je job.'),
    ('Opvolging', 'Elke maand een kort rapport in mensentaal: wat werkte, wat niet, wat we aanpassen.'),
]


# ------------------------------------------------------------------ bouwstenen
def blok_diensten(kort=True):
    rows = ''.join(
        f'<a class="row" href="/diensten/{slug}"><h3>{naam}</h3><p>{oms}</p>'
        f'<span class="go">Bekijken</span></a>' for slug, naam, oms in DIENSTEN_KORT)
    kop = ('<h2>Alles wat je marketing eenvoudiger maakt</h2>'
           '<p class="lead">Neem alles af, of enkel het stuk waar je vastloopt.</p>') if kort else ''
    extra = '<div class="btns"><a class="btn btn-ghost" href="/diensten">Bekijk alle diensten</a></div>' if kort else ''
    return f'<section class="alt"><div class="wrap">{kop}<div class="rows">{rows}</div>{extra}</div></section>'


def blok_diensten_volledig():
    groepen = [('Strategie en merk', DIENSTEN_KORT[0:2]),
               ('Online zichtbaar', DIENSTEN_KORT[2:5]),
               ('Content en contact', DIENSTEN_KORT[5:9]),
               ('Nieuw', DIENSTEN_KORT[9:])]
    out = '<section><div class="wrap">'
    for titel, items in groepen:
        rows = ''.join(f'<a class="row" href="/diensten/{s}"><h3>{n}</h3><p>{o}</p>'
                       f'<span class="go">Bekijken</span></a>' for s, n, o in items)
        out += f'<h2 style="margin-top:2.4rem">{titel}</h2><div class="rows">{rows}</div>'
    return out + '</div></section>'


def blok_citaten(citaten):
    if not citaten:
        return ''
    q = ''.join(f'<blockquote><p>&ldquo;{html.escape(c["tekst"])}&rdquo;</p>'
                f'<cite>{html.escape(c["naam"])} &mdash; {html.escape(c["functie"])}</cite></blockquote>'
                for c in citaten)
    return ('<section><div class="wrap"><h2>Wat klanten zeggen</h2>'
            f'<div class="quotes">{q}</div>'
            '<div class="btns"><a class="btn btn-ghost" href="/referenties">Bekijk de referenties</a>'
            '</div></div></section>')


def blok_stappen():
    li = ''.join(f'<li><h3>{t}</h3><p>{o}</p></li>' for t, o in STAPPEN)
    return f'<section class="alt"><div class="wrap"><h2>Zo verloopt het</h2><ol class="steps">{li}</ol></div></section>'


def blok_sectoren(lijst):
    tags = ''.join(f'<li>{html.escape(x)}</li>' for x in (lijst or []))
    return ('<section><div class="wrap"><h2>Ik werk vooral met</h2>'
            f'<ul class="tags">{tags}</ul>'
            '<p style="margin-top:1.6rem">Zit jouw sector er niet bij? Met 25 jaar ervaring vind ik voor '
            'zowat elk probleem een oplossing. <a href="/contact">Stuur me je vraag.</a></p></div></section>')


def logo_img(l, naam_tonen=True):
    src = l['url']
    lokaal = os.path.join(ROOT, 'assets', 'logos', l['bestand'])
    if os.path.exists(lokaal):
        src = '/assets/logos/' + l['bestand']
    bekend = l['naam'] != 'Klant'
    alt = f"Logo van {l['naam']}" if bekend else 'Klantlogo'
    naam = (f'<span class="logonaam">{html.escape(l["naam"])}</span>'
            if (naam_tonen and bekend) else '')
    return (f'<figure class="logo">'
            f'<img src="{src}" alt="{html.escape(alt)}" loading="lazy" decoding="async" '
            f'width="375" height="375">{naam}</figure>')


def blok_logos():
    items = ''.join(logo_img(l) for l in LOGOS)
    return ('<section class="tight"><div class="wrap">'
            f'<p class="strookkop">{len(LOGOS)} klanten en telkens opnieuw hetzelfde aanspreekpunt</p>'
            f'<div class="logowall">{items}</div>'
            '<p class="hint">Beweeg over een logo voor de naam.</p>'
            '</div></section>')


def blok_logostrook():
    items = ''.join(logo_img(l, naam_tonen=False) for l in LOGOS[:12])
    return ('<section class="alt tight"><div class="wrap">'
            '<p class="strookkop">Zij werken al met One Man Agency</p>'
            f'<div class="logowall klein">{items}</div>'
            '<div class="btns"><a class="btn btn-ghost" href="/referenties">Alle referenties</a></div>'
            '</div></section>')


def blok_pakketten(pakketten):
    cards = ''
    for p in pakketten:
        li = ''.join(f'<li>{html.escape(x)}</li>' for x in p['inbegrepen'])
        cls = ' pick' if p.get('uitgelicht') else ''
        cards += (f'<div class="plan{cls}"><h3>{html.escape(p["naam"])}</h3>'
                  f'<p class="who">{html.escape(p["voor_wie"])}</p>'
                  f'<p class="price">{p["prijs"]}<small>{p["periode"]}</small></p>'
                  f'<ul>{li}</ul></div>')
    return ('<h2 style="margin-top:2.6rem">Maandelijkse pakketten</h2>'
            f'<div class="plans">{cards}</div>'
            '<p class="hint">Alle prijzen exclusief btw. Opzegbaar per kwartaal. Geen opstartkosten.</p>')


def blok_projecten(projecten):
    rows = ''.join(f'<tr><td>{html.escape(p["wat"])}</td><td>{p["vanaf"]}</td>'
                   f'<td><a href="{p["link"]}">Meer</a></td></tr>' for p in projecten)
    return ('<h2 style="margin-top:2.6rem">Projecten</h2><div class="tablewrap"><table>'
            '<thead><tr><th>Project</th><th>Vanaf</th><th></th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div>')


def blok_prijstabel(prijzen):
    rows = ''.join(f'<tr><td>{html.escape(p["wat"])}</td><td>{p["vanaf"]}</td></tr>' for p in prijzen)
    return ('<h2 style="margin-top:2.6rem">Wat het kost</h2><div class="tablewrap"><table>'
            '<thead><tr><th>Wat</th><th>Vanaf</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div>'
            '<p class="hint">Alle bedragen exclusief btw. Je krijgt altijd een vaste prijs voor we beginnen.</p>')


def blok_faq(faq, kop=True):
    if not faq:
        return ''
    d = ''.join(f'<details><summary>{html.escape(f["vraag"])}</summary>'
                f'<p>{html.escape(f["antwoord"])}</p></details>' for f in faq)
    k = '<h2 style="margin-top:2.6rem">Veelgestelde vragen</h2>' if kop else ''
    return f'{k}<div class="faq">{d}</div>'


def blok_formulier(soort):
    fid = S['formspree_id']
    if soort == 'scan':
        velden = """
        <div class="field"><label for="f-naam">Naam</label><input id="f-naam" name="naam" required></div>
        <div class="field"><label for="f-bedrijf">Bedrijf</label><input id="f-bedrijf" name="bedrijf" required></div>
        <div class="field"><label for="f-web">Website</label><input id="f-web" name="website" type="url" placeholder="https://" required></div>
        <div class="field"><label for="f-gem">Gemeente</label><input id="f-gem" name="gemeente" required></div>
        <div class="field"><label for="f-mail">E-mail</label><input id="f-mail" name="email" type="email" required></div>
        <div class="field"><label for="f-tel">Telefoon <span class="opt">(optioneel)</span></label><input id="f-tel" name="telefoon" type="tel"></div>
        <div class="field"><label for="f-vraag">Waar loop je vooral op vast?</label><textarea id="f-vraag" name="vraag"></textarea></div>
        <div class="field checkline"><input id="f-nb" name="nieuwsbrief" type="checkbox" value="ja">
          <label for="f-nb" class="normaal">Stuur me ook de maandelijkse marketingtips.</label></div>"""
        knop = 'Vraag je scan aan'
        kop = 'Vraag je scan aan'
    else:
        velden = """
        <div class="field"><label for="f-naam">Naam</label><input id="f-naam" name="naam" required></div>
        <div class="field"><label for="f-bedrijf">Bedrijf</label><input id="f-bedrijf" name="bedrijf"></div>
        <div class="field"><label for="f-mail">E-mail</label><input id="f-mail" name="email" type="email" required></div>
        <div class="field"><label for="f-tel">Telefoon</label><input id="f-tel" name="telefoon" type="tel"></div>
        <div class="field"><label for="f-ond">Waarover gaat het?</label>
          <select id="f-ond" name="onderwerp">
            <option>Website of webshop</option><option>Social media</option>
            <option>Branding en huisstijl</option><option>SEO en Google Ads</option>
            <option>Drukwerk</option><option>Foto en video</option>
            <option>AI voor mijn zaak</option><option>Iets anders</option></select></div>
        <div class="field"><label for="f-bud">Budgetvork <span class="opt">(optioneel)</span></label><input id="f-bud" name="budget" placeholder="bv. 2.000 – 4.000 euro"></div>
        <div class="field"><label for="f-vraag">Je vraag</label><textarea id="f-vraag" name="vraag" required></textarea></div>"""
        knop = 'Verstuur je vraag'
        kop = 'Stuur je vraag door'
    return (f'<h2>{kop}</h2><form action="https://formspree.io/f/{fid}" method="POST">{velden}'
            f'<button class="btn" type="submit">{knop}</button>'
            '<p class="hint">Je gegevens worden enkel gebruikt om je vraag te beantwoorden.</p></form>')


def blok_agenda(url):
    return ('<div class="agenda"><iframe title="Agenda One Man Agency" loading="lazy" '
            f'src="{url}" style="border:0;width:100%;height:640px"></iframe></div>'
            '<p class="hint">Lukt het inplannen niet? Bel <a href="tel:' + B['telefoon_link'] + '">' +
            B['telefoon'] + '</a> of mail <a href="mailto:' + B['email'] + '">' + B['email'] + '</a>.</p>')


def blok_blogindex(posts):
    li = ''
    for p in posts:
        li += (f'<li><p class="date">{nl_datum(p["datum"])} · {html.escape(p.get("categorie",""))}</p>'
               f'<h3><a href="/blog/{p["slug"]}">{html.escape(p["titel"])}</a></h3>'
               f'<p>{html.escape(p.get("intro",""))}</p></li>')
    return f'<ul class="postlist">{li}</ul>'


def blok_cases(cases):
    k = ''.join(f'<article class="case"><div class="ph">Beeld van de case</div><div class="body">'
                f'<p class="sector">{c["sector"]}</p><h3>{html.escape(c["naam"])}</h3>'
                f'<p>{html.escape(c["resultaat"])}</p></div></article>' for c in cases)
    return f'<div class="cases">{k}</div>'


def blok_scan():
    return ('<section class="alt"><div class="wrap split"><div>'
            '<h2>Nog niet klaar voor een gesprek? Start met de gratis scan.</h2>'
            '<p>Je krijgt binnen vijf werkdagen een overzicht van je online zichtbaarheid: je positie in '
            'Google, je Bedrijfsprofiel, je website en je social media. Geen verkooppraat, wel drie '
            'concrete punten waar je zelf mee verder kan.</p>'
            '<div class="btns"><a class="btn" href="/gratis-marketingscan">Vraag je gratis scan aan</a></div>'
            '</div><div><div class="facts-grid">'
            '<div><b>5</b><span>werkdagen tot je rapport</span></div>'
            '<div><b>4</b><span>kanalen doorgelicht</span></div>'
            '<div><b>3</b><span>concrete verbeterpunten</span></div>'
            '</div></div></div></section>')


# ------------------------------------------------------------------ template
def render(url, fm, inhoud_html, extra_schema=None, prio='0.7'):
    titel = fm.get('seo_titel') or fm.get('titel')
    meta = fm.get('meta_omschrijving', '')
    canon = SITE + url
    noindex = fm.get('noindex')
    huidig = '/' + url.strip('/')

    def actief(link):
        link = '/' + link.strip('/')
        return huidig == link or huidig.startswith(link + '/')

    AC = ' aria-current="page"'
    nav = ''.join(
        '<li><a class="navlink" href="%s"%s>%s</a></li>'
        % (n['link'], AC if actief(n['link']) else '', html.escape(n['label']))
        for n in S['navigatie'])
    schema = jsonld(ORG)
    for s in (extra_schema or []):
        schema += jsonld(s)

    doc = f"""<!DOCTYPE html>
<html lang="nl-BE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(titel)}</title>
<meta name="description" content="{html.escape(meta)}">
<link rel="canonical" href="{canon}">
<meta name="robots" content="{'noindex, follow' if noindex else 'index, follow'}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="One Man Agency">
<meta property="og:locale" content="nl_BE">
<meta property="og:title" content="{html.escape(titel)}">
<meta property="og:description" content="{html.escape(meta)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#49C2AB">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
<link rel="icon" href="/assets/icon-512.png" sizes="512x512">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
{schema}
</head>
<body>
<a class="skip" href="#main">Naar de inhoud</a>
<div class="topbar"><div class="wrap">
  <span>Marketingbureau in Dendermonde &middot; werkt in heel Oost-Vlaanderen</span>
  <span><a href="tel:{B['telefoon_link']}">{B['telefoon']}</a> &nbsp; <a href="mailto:{B['email']}">{B['email']}</a></span>
</div></div>
<nav class="nav" id="nav" aria-label="Hoofdnavigatie"><div class="wrap">
  <a class="brand" href="/"{AC if huidig == '/' else ''} aria-label="One Man Agency, naar de startpagina"><img src="/assets/logo-oma.png" alt="One Man Agency" width="337" height="215"></a>
  <button class="nav-toggle" aria-expanded="false" aria-controls="navlist">Menu</button>
  <ul id="navlist">{nav}<li><a class="btn" href="{S['knop']['link']}">{html.escape(S['knop']['label'])}</a></li></ul>
</div></nav>
<main id="main">
{inhoud_html}
</main>
<section class="cta-band"><div class="wrap">
  <h2>Eén gesprek van 30 minuten. Daarna weet je waar je staat.</h2>
  <p>Gratis, vrijblijvend en zonder verkooppraat. Ik luister, jij vertelt wat er scheelt, en ik zeg eerlijk of ik kan helpen.</p>
  <div class="btns"><a class="btn btn-light" href="/afspraak">Maak een afspraak</a>
  <a class="btn btn-ghost wit" href="tel:{B['telefoon_link']}">Bel {B['telefoon']}</a></div>
</div></section>
<footer class="site"><div class="wrap">
  <div>
    <img class="footlogo" src="/assets/logo-oma-wit.png" alt="One Man Agency" width="337" height="215">
    <p class="tagline">{B['slogan']}</p>
    <p>{B['juridisch']}<br>{B['straat']}<br>{B['postcode']} {B['stad']}<br>BTW {B['btw']}</p>
  </div>
  <div><h4>Diensten</h4><ul>""" + ''.join(
        f'<li><a href="/diensten/{s}">{n}</a></li>' for s, n, _ in DIENSTEN_KORT[:8]) + """</ul></div>
  <div><h4>Regio</h4><ul>
    <li><a href="/regio/marketingbureau-dendermonde">Dendermonde</a></li>
    <li><a href="/regio/marketingbureau-lebbeke">Lebbeke</a></li>
    <li><a href="/regio/marketingbureau-aalst">Aalst</a></li>
    <li><a href="/regio/marketingbureau-sint-niklaas">Sint-Niklaas</a></li>
    <li><a href="/regio/marketingbureau-wetteren">Wetteren</a></li>
    <li><a href="/regio/marketingbureau-zele">Zele</a></li>
  </ul></div>
  <div><h4>Sectoren</h4><ul>
    <li><a href="/sectoren/verzekeringsmakelaars">Verzekeringsmakelaars</a></li>
    <li><a href="/sectoren/garages-en-autobedrijven">Garages &amp; autobedrijven</a></li>
    <li><a href="/sectoren/bouw-en-renovatie">Bouw &amp; renovatie</a></li>
    <li><a href="/sectoren/horeca-en-retail">Horeca &amp; retail</a></li>
  </ul><h4 style="margin-top:1.4rem">Volg mee</h4><ul>""" + ''.join(
        f'<li><a href="{s["url"]}" rel="me noopener">{s["naam"]}</a></li>' for s in S['socials']) + f"""</ul></div>
</div>
<div class="legal"><div class="wrap">
  <span>&copy; {datetime.date.today().year} {B['juridisch']}</span>
  <span><a href="/veelgestelde-vragen">Veelgestelde vragen</a> &nbsp;
  <a href="/privacybeleid">Privacy</a> &nbsp; <a href="/cookiebeleid">Cookies</a> &nbsp;
  <a href="/algemene-voorwaarden">Algemene voorwaarden</a></span>
</div></div>
</footer>
<script>
(function(){{var n=document.getElementById('nav'),b=n.querySelector('.nav-toggle');
function zet(o){{n.classList.toggle('open',o);b.setAttribute('aria-expanded',o?'true':'false');}}
b.addEventListener('click',function(){{zet(!n.classList.contains('open'));}});
n.addEventListener('click',function(e){{if(e.target.closest('a'))zet(false);}});
document.addEventListener('keydown',function(e){{if(e.key==='Escape'&&n.classList.contains('open')){{zet(false);b.focus();}}}});
window.addEventListener('resize',function(){{if(window.innerWidth>920)zet(false);}});}})();
</script>
</body></html>"""

    pad = os.path.join(DIST, (url.strip('/') or 'index') + '.html')
    os.makedirs(os.path.dirname(pad), exist_ok=True)
    open(pad, 'w', encoding='utf-8').write(doc)
    if not noindex:
        PAGINAS.append((canon, prio))
    if len(titel) > 62:
        print(f'  ! title te lang ({len(titel)}): {url}')
    if len(meta) > 158:
        print(f'  ! meta te lang ({len(meta)}): {url}')


def pagehead(fm, kruimels=''):
    k = f'<p class="crumbs">{kruimels}</p>' if kruimels else ''
    return (f'<header class="pagehead"><div class="wrap">{k}'
            f'<h1>{html.escape(fm["titel"])}</h1>'
            f'<p class="lead">{html.escape(fm.get("intro",""))}</p></div></header>')


def todo(fm):
    t = fm.get('af_te_werken')
    return f'<div class="todo"><p><strong>Nog aan te vullen.</strong> {html.escape(t)}</p></div>' if t else ''


# ------------------------------------------------------------------ bouwen
if os.path.isdir(DIST):
    # Inhoud legen in plaats van de map zelf wissen: op Windows houdt een openstaande
    # editor of previewserver dist/ vast, waardoor rmtree(DIST) faalt.
    for naam in os.listdir(DIST):
        pad = os.path.join(DIST, naam)
        shutil.rmtree(pad) if os.path.isdir(pad) else os.remove(pad)
os.makedirs(DIST, exist_ok=True)
shutil.copytree(os.path.join(ROOT, 'assets'), os.path.join(DIST, 'assets'))
if os.path.isdir(os.path.join(ROOT, 'admin')):
    shutil.copytree(os.path.join(ROOT, 'admin'), os.path.join(DIST, 'admin'))

# --- blogberichten
posts = []
for f in glob.glob(os.path.join(CONTENT, 'blog', '*.md')):
    fm, body = lees(f)
    if not fm.get('gepubliceerd', True):
        continue
    fm['slug'] = os.path.basename(f)[:-3]
    fm['body'] = body
    d = fm['datum']
    fm['datum'] = d if isinstance(d, datetime.date) else datetime.date.fromisoformat(str(d))
    posts.append(fm)
posts.sort(key=lambda p: p['datum'], reverse=True)

for p in posts:
    inhoud = (f'<header class="pagehead"><div class="wrap">'
              f'<p class="crumbs"><a href="/">Home</a> / <a href="/blog">Blog</a></p>'
              f'<h1>{html.escape(p["titel"])}</h1>'
              f'<p class="lead">{html.escape(p.get("intro",""))}</p>'
              f'<p class="crumbs" style="margin:1rem 0 0">{nl_datum(p["datum"])} &middot; '
              f'Niels Van de Meersch</p></div></header>'
              f'<section><div class="wrap"><article class="post prose">{mdhtml(p["body"])}</article>'
              '<div class="btns"><a class="btn" href="/afspraak">Maak een afspraak</a>'
              '<a class="btn btn-ghost" href="/blog">Alle artikels</a></div></div></section>')
    render(f'/blog/{p["slug"]}', p, inhoud, prio='0.6', extra_schema=[{
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        'headline': p['titel'], 'description': p.get('meta_omschrijving', ''),
        'datePublished': p['datum'].isoformat(), 'inLanguage': 'nl-BE',
        'author': {'@id': SITE + '/#niels'}, 'publisher': {'@id': SITE + '/#organisatie'},
        'mainEntityOfPage': f'{SITE}/blog/{p["slug"]}'}])

# --- eenvoudige mappen: diensten, sectoren, regio
MAPPEN = {
    'diensten': ('<a href="/">Home</a> / <a href="/diensten">Diensten</a>', '0.8'),
    'sectoren': ('<a href="/">Home</a> / Sectoren', '0.7'),
    'regio': ('<a href="/">Home</a> / Regio', '0.7'),
}
for map_, (kruimels, prio) in MAPPEN.items():
    for f in sorted(glob.glob(os.path.join(CONTENT, map_, '*.md'))):
        fm, body = lees(f)
        slug = os.path.basename(f)[:-3]
        inhoud = pagehead(fm, kruimels) + '<section><div class="wrap"><div class="prose">'
        inhoud += mdhtml(body)
        if map_ == 'regio':
            inhoud += '</div>' + blok_diensten(kort=False).replace('<section><div class="wrap">', '').replace('</div></section>', '') + '<div class="prose">'
        if fm.get('prijzen'):
            inhoud += blok_prijstabel(fm['prijzen'])
        if fm.get('faq'):
            inhoud += blok_faq(fm['faq'])
        inhoud += todo(fm)
        inhoud += ('<div class="btns"><a class="btn" href="/afspraak">Maak een afspraak</a>'
                   '<a class="btn btn-ghost" href="/prijzen">Bekijk de prijzen</a></div>')
        inhoud += '</div></section>'
        schema = [{'@context': 'https://schema.org', '@type': 'Service', 'name': fm['titel'],
                   'description': fm.get('meta_omschrijving', ''), 'url': f'{SITE}/{map_}/{slug}',
                   'provider': {'@id': SITE + '/#organisatie'},
                   'areaServed': {'@type': 'State', 'name': 'Oost-Vlaanderen'}}]
        if fm.get('faq'):
            schema.append({'@context': 'https://schema.org', '@type': 'FAQPage',
                           'mainEntity': [{'@type': 'Question', 'name': q['vraag'],
                                           'acceptedAnswer': {'@type': 'Answer', 'text': q['antwoord']}}
                                          for q in fm['faq']]})
        render(f'/{map_}/{slug}', fm, inhoud, schema, prio)

# --- pagina's met shortcodes
SHORTCODES = {
    '{{diensten}}': lambda fm: blok_diensten(),
    '{{diensten-volledig}}': lambda fm: blok_diensten_volledig(),
    '{{citaten}}': lambda fm: blok_citaten(fm.get('citaten')),
    '{{stappen}}': lambda fm: blok_stappen(),
    '{{sectoren}}': lambda fm: blok_sectoren(fm.get('sectoren_lijst')),
    '{{scan-blok}}': lambda fm: blok_scan(),
    '{{logos}}': lambda fm: blok_logos(),
    '{{logos-strook}}': lambda fm: blok_logostrook(),
    '{{pakketten}}': lambda fm: blok_pakketten(fm.get('pakketten', [])),
    '{{projecten}}': lambda fm: blok_projecten(fm.get('projecten', [])),
    '{{faq}}': lambda fm: blok_faq(fm.get('faq'), kop=False),
    '{{cases}}': lambda fm: blok_cases(fm.get('cases', [])),
    '{{agenda}}': lambda fm: blok_agenda(fm.get('agenda_url', '')),
    '{{blogindex}}': lambda fm: blok_blogindex(posts),
}

for f in sorted(glob.glob(os.path.join(CONTENT, 'paginas', '*.md'))):
    slug = os.path.basename(f)[:-3]
    fm, body = lees(f)
    url = '/' if slug == 'home' else f'/{slug}'
    prio = '1.0' if slug == 'home' else ('0.9' if slug in ('diensten', 'prijzen', 'gratis-marketingscan',
                                                           'referenties') else '0.7')

    # markdown in stukken knippen rond de shortcodes
    delen = re.split(r'(\{\{[a-z\-]+\}\})', body)
    kern = ''
    open_prose = False
    for d in delen:
        if d in SHORTCODES:
            if open_prose:
                kern += '</div></div></section>'
                open_prose = False
            kern += SHORTCODES[d](fm)
        elif d.strip() in ('{{intro-blok}}', '{{einde-blok}}'):
            continue
        elif d.strip():
            if not open_prose:
                kern += '<section><div class="wrap"><div class="prose">'
                open_prose = True
            kern += mdhtml(d)
    if open_prose:
        kern += '</div></div></section>'

    # kop
    if slug == 'home':
        kop = (f'<header class="sign"><div class="wrap">'
               f'<div class="hero"><div>'
               f'<h1>{html.escape(fm["titel"])}</h1>'
               f'<p class="lead">{html.escape(fm.get("intro",""))}</p>'
               f'<div class="btns">'
               f'<a class="btn" href="{fm["knop_primair_link"]}">{html.escape(fm["knop_primair"])}</a>'
               f'<a class="btn btn-ghost" href="{fm["knop_secundair_link"]}">{html.escape(fm["knop_secundair"])}</a>'
               f'</div></div>'
               f'<img class="heroportret" src="{fm["portret"]}" alt="{html.escape(fm["portret_alt"])}" width="900" height="1125">'
               f'</div><div class="facts">' +
               ''.join(f'<div><b>{c["getal"]}</b>{html.escape(c["label"])}</div>' for c in fm['cijfers']) +
               '</div></div></header>' +
               f'<img class="bandbeeld" src="{fm["header_afbeelding"]}" alt="{html.escape(fm["header_alt"])}" width="851" height="315">')
    elif slug in ('contact', 'gratis-marketingscan'):
        kop = pagehead(fm)
        kern = ('<section><div class="wrap split"><div class="prose">' + kern
                .replace('<section><div class="wrap"><div class="prose">', '')
                .replace('</div></div></section>', '') +
                '</div><div>' + blok_formulier(fm['formulier']) + '</div></div></section>')
    else:
        kop = pagehead(fm)

    if fm.get('af_te_werken'):
        kern += f'<section class="tight"><div class="wrap">{todo(fm)}</div></section>'

    schema = []
    if fm.get('faq'):
        schema.append({'@context': 'https://schema.org', '@type': 'FAQPage',
                       'mainEntity': [{'@type': 'Question', 'name': q['vraag'],
                                       'acceptedAnswer': {'@type': 'Answer', 'text': q['antwoord']}}
                                      for q in fm['faq']]})
    render(url if slug != '404' else '/404', fm, kop + kern, schema, prio)

# --- sitemap, robots, llms, redirects
sm = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u, pr in PAGINAS:
    sm.append(f'  <url><loc>{u}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority></url>')
sm.append('</urlset>')
open(os.path.join(DIST, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(sm))

open(os.path.join(DIST, 'robots.txt'), 'w', encoding='utf-8').write(
    'User-agent: *\nAllow: /\n\n# AI-crawlers zijn welkom: dat is het punt van GEO.\n'
    'User-agent: GPTBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n'
    'User-agent: ClaudeBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\n'
    f'Sitemap: {SITE}/sitemap.xml\n')

oude = []
for p in posts:
    if p.get('oude_url'):
        oude.append(f'{p["oude_url"]:70} /blog/{p["slug"]}  301')
open(os.path.join(DIST, '_redirects'), 'w', encoding='utf-8').write(
    '\n'.join([
        f'{"/diensten-one-man-agency":70} /diensten  301',
        f'{"/marketingbureau-prijzen":70} /prijzen  301',
        f'{"/pakketten":70} /prijzen  301',
        f'{"/marketingbureau-kmo":70} /over-niels  301',
        f'{"/referenties":70} /referenties  301',
        f'{"/vragen":70} /veelgestelde-vragen  301',
        f'{"/offerte-or-contact":70} /contact  301',
        f'{"/gratis-marketing-scan":70} /gratis-marketingscan  301',
        f'{"/webdesign":70} /diensten/webdesign  301',
        f'{"/post/*":70} /blog  301',
    ] + oude) + '\n')

open(os.path.join(DIST, 'llms.txt'), 'w', encoding='utf-8').write(f"""# One Man Agency

> One Man Agency is een eenmansmarketingbureau uit Dendermonde (Oost-Vlaanderen, Belgie), opgericht
> en gerund door Niels Van de Meersch. Het bureau begeleidt KMO's en lokale ondernemers in
> marketingstrategie, branding, webdesign, SEO en GEO, Google Ads, social media, e-mailmarketing,
> grafische vormgeving en drukwerk, foto en video, en AI-toepassingen.

Kernpunten:
- Een aanspreekpunt voor de volledige marketing; geen accountmanagers of tussenlagen.
- Meer dan 25 jaar ervaring in marketing en communicatie.
- Werkgebied: Dendermonde, Lebbeke, Buggenhout, Zele, Berlare, Hamme, Temse, Sint-Niklaas, Aalst,
  Wetteren, Londerzeel, Opwijk en de rest van Oost-Vlaanderen.
- Maandpakketten vanaf 475 euro excl. btw. Websites vanaf 1.450 euro excl. btw.
- Contact: {B['telefoon']} / {B['email']} / {B['straat']}, {B['postcode']} {B['stad']}.

## Belangrijkste pagina's
- [Over Niels Van de Meersch]({SITE}/over-niels)
- [Diensten]({SITE}/diensten)
- [Referenties]({SITE}/referenties)
- [Prijzen]({SITE}/prijzen)
- [Veelgestelde vragen]({SITE}/veelgestelde-vragen)
- [Blog]({SITE}/blog)
- [Contact]({SITE}/contact)
""")

print(f'Klaar: {len(PAGINAS)} indexeerbare pagina\'s, {len(posts)} blogberichten, {len(LOGOS)} logo\'s')
