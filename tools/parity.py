# -*- coding: utf-8 -*-
"""
Semantic parity: does the SvelteKit build render the same site as the reference?

handover/08 sets the bar: "Differences in whitespace, attribute order and
generator comments are fine. Differences in text content, headings, links, or
JSON-LD are migration bugs."

So this compares, per page:
  * the <head> SEO set (title, description, canonical, robots, og:*)
  * the JSON-LD graph, as parsed objects
  * every heading, in order
  * every link href, in order
  * every image src + alt
  * the visible text of <main>, whitespace-normalised

    python tools/parity.py [--candidate .svelte-kit/cloudflare]
"""
import os, re, sys, json, glob, argparse, difflib
from collections import Counter

from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROBLEMS = []


def norm_space(text):
    return re.sub(r'\s+', ' ', text).strip()


def load(path):
    with open(path, encoding='utf-8') as fh:
        return BeautifulSoup(fh.read(), 'html.parser')


def head_set(soup):
    def meta(attr, key):
        tag = soup.find('meta', attrs={attr: key})
        return tag.get('content', '') if tag else None

    canonical = soup.find('link', rel='canonical')
    return {
        'title': soup.title.string if soup.title else None,
        'description': meta('name', 'description'),
        'robots': meta('name', 'robots'),
        'canonical': canonical.get('href') if canonical else None,
        'og:title': meta('property', 'og:title'),
        'og:description': meta('property', 'og:description'),
        'og:url': meta('property', 'og:url'),
        'og:type': meta('property', 'og:type'),
        'og:image': meta('property', 'og:image'),
        'og:locale': meta('property', 'og:locale'),
        'og:site_name': meta('property', 'og:site_name'),
        'twitter:card': meta('name', 'twitter:card'),
        'theme-color': meta('name', 'theme-color'),
    }


def schemas(soup):
    """JSON-LD as a comparable, order-independent structure."""
    out = []
    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            out.append(json.loads(tag.string))
        except (json.JSONDecodeError, TypeError):
            out.append({'__unparseable__': str(tag.string)[:200]})
    return sorted(out, key=lambda o: json.dumps(o, sort_keys=True, ensure_ascii=False))


def main_el(soup):
    return soup.find('main') or soup


def headings(soup):
    return [(h.name, norm_space(h.get_text()))
            for h in main_el(soup).find_all(['h1', 'h2', 'h3', 'h4'])]


def links(soup):
    return [a.get('href') for a in main_el(soup).find_all('a') if a.get('href')]


def images(soup):
    return [(i.get('src'), i.get('alt')) for i in main_el(soup).find_all('img')]


def visible_text(soup):
    el = main_el(soup)
    clone = BeautifulSoup(str(el), 'html.parser')
    for bad in clone.find_all(['script', 'style']):
        bad.decompose()
    return norm_space(clone.get_text(' '))


# -- Deliberate additions since the reference build -------------------------
#
# The SEO pass adds markup the 2024 static build never had. Reporting it on all
# 41 pages would bury the differences this tool exists to catch, so the additions
# are allowed for by name -- and only as ADDITIONS. A changed title, a dropped
# canonical or a rewritten Service node still fails, because every rule below
# asserts that the reference value is still there underneath.

# Nodes added to the JSON-LD graph. Anything the reference had must still match.
ADDED_SCHEMA_TYPES = {'WebSite', 'WebPage', 'BreadcrumbList', 'Blog'}

# Keys added to the reference's BlogPosting node.
ADDED_BLOGPOSTING_KEYS = {'dateModified', 'image', 'articleSection', 'wordCount',
                          'isPartOf', 'url'}

# The robots value gained preview directives; the indexing part must not change.
ROBOTS_ADDITIONS = ', max-image-preview:large, max-snippet:-1, max-video-preview:-1'


def robots_ok(reference, candidate):
    """The candidate may append the preview directives, and nothing else."""
    if reference == candidate:
        return True
    return candidate == (reference or '') + ROBOTS_ADDITIONS


def strip_added_schemas(ref_ld, cand_ld):
    """Drop the added nodes, and the added keys, from the candidate graph."""
    kept = []
    for node in cand_ld:
        if node.get('@type') in ADDED_SCHEMA_TYPES:
            continue
        if node.get('@type') == 'BlogPosting':
            node = {k: v for k, v in node.items() if k not in ADDED_BLOGPOSTING_KEYS}
        kept.append(node)
    return ref_ld, sorted(kept, key=lambda o: json.dumps(o, sort_keys=True, ensure_ascii=False))


def compare_page(rel, ref_path, cand_path):
    ref, cand = load(ref_path), load(cand_path)
    issues = []

    r_head, c_head = head_set(ref), head_set(cand)
    for key in r_head:
        if key == 'robots' and robots_ok(r_head[key], c_head[key]):
            continue
        # og:type became "article" on posts, and the reference had no
        # per-page image. Both are deliberate; an emptied value is not.
        if key in ('og:type', 'og:image') and c_head[key]:
            continue
        if r_head[key] != c_head[key]:
            issues.append(f'head[{key}]:\n      reference: {r_head[key]!r}\n      candidate: {c_head[key]!r}')

    r_ld, c_ld = strip_added_schemas(schemas(ref), schemas(cand))
    if r_ld != c_ld:
        r_types = Counter(o.get('@type') for o in r_ld)
        c_types = Counter(o.get('@type') for o in c_ld)
        if r_types != c_types:
            issues.append(f'JSON-LD types: reference {dict(r_types)} vs candidate {dict(c_types)}')
        else:
            for a, b in zip(r_ld, c_ld):
                if a != b:
                    da = json.dumps(a, sort_keys=True, ensure_ascii=False)
                    db = json.dumps(b, sort_keys=True, ensure_ascii=False)
                    i = next((k for k in range(min(len(da), len(db))) if da[k] != db[k]), 0)
                    issues.append(f'JSON-LD {a.get("@type")} differs near:\n'
                                  f'      reference: ...{da[max(0,i-60):i+90]}\n'
                                  f'      candidate: ...{db[max(0,i-60):i+90]}')
                    break

    for label, fn in (('headings', headings), ('links', links), ('images', images)):
        a, b = fn(ref), fn(cand)
        if a != b:
            diff = [d for d in difflib.unified_diff(
                [str(x) for x in a], [str(x) for x in b],
                fromfile='reference', tofile='candidate', lineterm='', n=0)][2:]
            issues.append(f'{label} differ:\n      ' + '\n      '.join(diff[:8]))

    a, b = visible_text(ref), visible_text(cand)
    if a != b:
        i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
        issues.append('main text differs near:\n'
                      f'      reference: ...{a[max(0,i-70):i+110]}\n'
                      f'      candidate: ...{b[max(0,i-70):i+110]}')

    if issues:
        PROBLEMS.append((rel, issues))
    return not issues


def compare_text_file(rel, ref_path, cand_path, ignore=()):
    a = open(ref_path, encoding='utf-8').read()
    b = open(cand_path, encoding='utf-8').read()
    # Removed rather than masked, so a pattern can cover a whole line that only
    # one side has (robots.txt gained two Disallow lines). Both sides get the
    # same treatment, so a masked value still has to match where both carry it.
    for pattern in ignore:
        a = re.sub(pattern, '', a)
        b = re.sub(pattern, '', b)
    if norm_space(a) != norm_space(b):
        diff = list(difflib.unified_diff(a.splitlines(), b.splitlines(),
                                         fromfile='reference', tofile='candidate',
                                         lineterm='', n=0))[2:]
        PROBLEMS.append((rel, ['\n      '.join(diff[:12])]))
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reference', default=os.path.join(ROOT, 'dist-original'))
    ap.add_argument('--candidate', default=os.path.join(ROOT, '.svelte-kit', 'cloudflare'))
    args = ap.parse_args()

    ref_root, cand_root = args.reference, args.candidate
    print(f'reference: {ref_root}\ncandidate: {cand_root}\n')

    checked = missing = 0
    for path in sorted(glob.glob(os.path.join(ref_root, '**', '*.html'), recursive=True)):
        rel = os.path.relpath(path, ref_root).replace(os.sep, '/')
        if rel.startswith('admin/'):
            continue  # the Git-based CMS is replaced, not ported
        cand = os.path.join(cand_root, rel)
        if not os.path.exists(cand):
            PROBLEMS.append((rel, ['page missing from the candidate build']))
            missing += 1
            continue
        checked += 1
        compare_page(rel, path, cand)

    print(f'compared {checked} pages ({missing} missing)')

    # lastmod is the build date, so it legitimately differs.
    for name, ignore in (('sitemap.xml', (r'<lastmod>[^<]*</lastmod>',)),
                         # The admin and the API were added after the reference
                         # build and are not content; see the robots.txt handler.
                         ('robots.txt', (r'Disallow: /(admin|api/)\n',)),
                         ('llms.txt', ())):
        ref_file = os.path.join(ref_root, name)
        cand_file = os.path.join(cand_root, name)
        if not os.path.exists(cand_file):
            PROBLEMS.append((name, ['missing from the candidate build']))
        else:
            compare_text_file(name, ref_file, cand_file, ignore)

    if PROBLEMS:
        print(f'\n{len(PROBLEMS)} file(s) with differences:\n')
        for rel, issues in PROBLEMS[:15]:
            print(f'  {rel}')
            for issue in issues[:4]:
                print(f'    - {issue}')
            print()
        if len(PROBLEMS) > 15:
            print(f'  ...and {len(PROBLEMS) - 15} more files')
        sys.exit(1)

    print('\nSemantic parity: candidate matches the reference on every page.')


if __name__ == '__main__':
    main()
