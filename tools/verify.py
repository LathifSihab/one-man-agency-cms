# -*- coding: utf-8 -*-
"""
Parity harness.

Diffs a candidate build against the reference build in dist-original/ and
reports the content invariants from handover/08-MIGRATION.md and 10-ACCEPTANCE.md.

    python tools/verify.py                       # check dist/ (the build.py output)
    python tools/verify.py --candidate build     # check the SvelteKit output

Exit code is non-zero if any check fails, so this is usable in CI.
"""
import os, re, sys, glob, json, argparse, filecmp

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILED = []
PASSED = []


def check(label, ok, detail=''):
    (PASSED if ok else FAILED).append(label)
    mark = 'PASS' if ok else 'FAIL'
    print(f'  [{mark}] {label}{"  " + detail if detail else ""}')
    return ok


def compare_trees(reference, candidate):
    """Byte-compare every file in the reference against the candidate."""
    missing, differing, identical = [], [], 0
    for path in glob.glob(os.path.join(reference, '**', '*'), recursive=True):
        if os.path.isdir(path):
            continue
        rel = os.path.relpath(path, reference)
        other = os.path.join(candidate, rel)
        if not os.path.exists(other):
            missing.append(rel)
        elif filecmp.cmp(path, other, shallow=False):
            identical += 1
        else:
            differing.append(rel)
    return missing, differing, identical


def content_invariants(content_dir):
    print('\nContent invariants (handover 08 step 5):')
    counts = {}
    for folder in ('paginas', 'diensten', 'sectoren', 'regio', 'blog'):
        counts[folder] = len(glob.glob(os.path.join(content_dir, folder, '*.md')))

    check('paginas = 15', counts['paginas'] == 15, f'got {counts["paginas"]}')
    check('diensten = 10', counts['diensten'] == 10, f'got {counts["diensten"]}')
    check('sectoren = 4', counts['sectoren'] == 4, f'got {counts["sectoren"]}')
    check('regio = 6', counts['regio'] == 6, f'got {counts["regio"]}')
    check('blog = 7', counts['blog'] == 7, f'got {counts["blog"]}')

    logos = yaml.safe_load(open(os.path.join(content_dir, 'logos.yml'), encoding='utf-8'))['logos']
    check('logos = 53', len(logos) == 53, f'got {len(logos)}')
    klant = sum(1 for l in logos if l['naam'] == 'Klant')
    check('logos named "Klant" = 22', klant == 22, f'got {klant}')

    todo = 0
    nbsp = 0
    long_title = []
    long_meta = []
    legacy = 0
    for path in glob.glob(os.path.join(content_dir, '**', '*.md'), recursive=True):
        text = open(path, encoding='utf-8').read()
        fm = yaml.safe_load(re.match(r'^---\n(.*?)\n---\n', text, re.S).group(1))
        if fm.get('af_te_werken'):
            todo += 1
        if fm.get('oude_url'):
            legacy += 1
        if len(fm.get('seo_titel', '')) > 62:
            long_title.append(os.path.basename(path))
        if len(fm.get('meta_omschrijving', '')) > 158:
            long_meta.append(os.path.basename(path))
        for group in ('prijzen', 'pakketten'):
            for row in (fm.get(group) or []):
                if ' ' in str(row.get('vanaf', '')) or ' ' in str(row.get('prijs', '')):
                    nbsp += 1

    check('pages with af_te_werken = 13', todo == 13, f'got {todo}')
    check('posts with oude_url = 6', legacy == 6, f'got {legacy}')
    check('non-breaking spaces preserved in prices', nbsp > 0, f'{nbsp} price rows')
    check('all seo_titel <= 62', not long_title, ', '.join(long_title))
    check('all meta_omschrijving <= 158', not long_meta, ', '.join(long_meta))


def seo_artefacts(candidate):
    print('\nGenerated SEO artefacts (handover 06):')
    for name in ('sitemap.xml', 'robots.txt', 'llms.txt', '_redirects'):
        check(f'{name} present', os.path.exists(os.path.join(candidate, name)))

    sitemap = os.path.join(candidate, 'sitemap.xml')
    if os.path.exists(sitemap):
        text = open(sitemap, encoding='utf-8').read()
        urls = re.findall(r'<loc>(.*?)</loc>', text)
        check('sitemap lists 41 URLs', len(urls) == 41, f'got {len(urls)}')
        check('sitemap excludes /404', not any(u.endswith('/404') for u in urls))

    robots = os.path.join(candidate, 'robots.txt')
    if os.path.exists(robots):
        text = open(robots, encoding='utf-8').read()
        for bot in ('GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'):
            check(f'robots.txt allows {bot}', bot in text)

    redirects = os.path.join(candidate, '_redirects')
    if os.path.exists(redirects):
        rules = [l for l in open(redirects, encoding='utf-8').read().splitlines() if l.strip()]
        check('16 redirect rules', len(rules) == 16, f'got {len(rules)}')

    pages = [p for p in glob.glob(os.path.join(candidate, '**', '*.html'), recursive=True)
             if 'admin' not in os.path.relpath(p, candidate).split(os.sep)]

    # The count that matters is indexable pages. The reference had one noindex
    # page (/404); moving the forms to Supabase added /bedankt and
    # /formulier-fout, which are also noindex and excluded from the sitemap.
    indexable, noindexed = [], []
    for path in pages:
        text = open(path, encoding='utf-8').read()
        m = re.search(r'<meta name="robots" content="([^"]*)"', text)
        (noindexed if m and 'noindex' in m.group(1) else indexable).append(path)

    check('41 indexable pages', len(indexable) == 41, f'got {len(indexable)}')
    check('noindex pages excluded from the sitemap', len(noindexed) >= 1,
          f'{len(noindexed)} noindex: ' + ', '.join(sorted(os.path.basename(p) for p in noindexed)))

    # Every block must sit inside a .wrap, which supplies the page gutter.
    # build.py emitted some shortcode blocks as bare children of <main>, so their
    # text ran into the right edge of the viewport on four pages.
    from bs4 import BeautifulSoup
    unwrapped = []
    for path in pages:
        html_text = open(path, encoding='utf-8').read()
        if '<main id="main">' not in html_text:
            continue
        inner = html_text.split('<main id="main">')[1].rsplit('</main>')[0]
        for child in BeautifulSoup(inner, 'html.parser').children:
            if getattr(child, 'name', None) is None:
                continue
            classes = child.get('class', [])
            # <img class="bandbeeld"> is a deliberate full-bleed band on the home page.
            if child.name in ('section', 'header') or 'bandbeeld' in classes:
                continue
            unwrapped.append(f'{os.path.basename(path)}:<{child.name}>')

    check('no blocks outside a .wrap container', not unwrapped,
          ', '.join(unwrapped[:6]))

    org = faq = service = blogposting = 0
    for path in pages:
        text = open(path, encoding='utf-8').read()
        blobs = re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
        types = []
        for blob in blobs:
            try:
                types.append(json.loads(blob).get('@type'))
            except json.JSONDecodeError:
                check(f'valid JSON-LD in {os.path.basename(path)}', False)
        if 'ProfessionalService' in types:
            org += 1
        if 'FAQPage' in types:
            faq += 1
        if 'Service' in types:
            service += 1
        if 'BlogPosting' in types:
            blogposting += 1

    check('ProfessionalService on every page', org == len(pages), f'got {org}/{len(pages)}')
    check('Service on 20 pages', service == 20, f'got {service}')
    check('FAQPage on 13 pages', faq == 13, f'got {faq}')
    check('BlogPosting on 7 pages', blogposting == 7, f'got {blogposting}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reference', default=os.path.join(ROOT, 'dist-original'))
    ap.add_argument('--candidate', default=os.path.join(ROOT, 'dist'))
    ap.add_argument('--content', default=os.path.join(ROOT, 'content'))
    ap.add_argument('--skip-diff', action='store_true',
                    help='skip the byte-for-byte tree comparison')
    args = ap.parse_args()

    print(f'reference: {args.reference}\ncandidate: {args.candidate}')

    if not args.skip_diff:
        print('\nByte-for-byte parity against the reference build:')
        missing, differing, identical = compare_trees(args.reference, args.candidate)
        check('no missing files', not missing, f'{len(missing)} missing')
        for rel in missing[:10]:
            print(f'         missing: {rel}')
        check('no differing files', not differing, f'{len(differing)} differ')
        for rel in differing[:10]:
            print(f'         differs: {rel}')
        print(f'         {identical} files identical')

    if os.path.isdir(args.content):
        content_invariants(args.content)
    seo_artefacts(args.candidate)

    print(f'\n{len(PASSED)} passed, {len(FAILED)} failed')
    if FAILED:
        for f in FAILED:
            print(f'  FAILED: {f}')
        sys.exit(1)
    print('All checks passed.')


if __name__ == '__main__':
    main()
