# -*- coding: utf-8 -*-
"""
Migrate content/ into Supabase — once, losslessly, idempotently.

Implements handover/08-MIGRATION.md. Reuses build.py's front-matter parser so the
Markdown is read exactly the way the reference implementation reads it.

    python tools/migrate.py --dry-run      # write supabase/seed.json, touch nothing
    python tools/migrate.py                # upsert into Supabase
    python tools/migrate.py --with-media   # also upload assets/ to Storage

Credentials come from .env (PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
The service role key bypasses RLS and is used server-side only, never committed.

The seed file written by --dry-run is also what the SvelteKit build falls back to
when no credentials are configured, so the site can be built and parity-checked
without a live database.
"""
import os, re, sys, json, glob, argparse, datetime
from collections import OrderedDict

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, 'content')
SEED = os.path.join(ROOT, 'supabase', 'seed.json')

# Folder -> page_type discriminator (handover/05: one table, four families)
PAGE_TYPES = {'paginas': 'page', 'diensten': 'service',
              'sectoren': 'sector', 'regio': 'region'}

# The single auditable NL -> EN mapping table (handover/08 step 2).
FIELD_MAP = {
    'titel':             'title',
    'seo_titel':         'seo_title',
    'meta_omschrijving': 'meta_description',
    'intro':             'intro',
    'noindex':           'noindex',
    'af_te_werken':      'todo_note',
    'faq':               'faq',
    'prijzen':           'prices',
    'pakketten':         'packages',
    'projecten':         'projects',
    'cijfers':           'figures',
    'citaten':           'testimonials',
    'sectoren_lijst':    'sector_list',
    'formulier':         'form_variant',
    'agenda_url':        'booking_url',
    'portret':           'portrait_url',
    'portret_alt':       'portrait_alt',
    'header_afbeelding': 'header_image_url',
    'header_alt':        'header_alt',
    # blog-only
    'datum':             'published_on',
    'categorie':         'category',
    'gepubliceerd':      'is_published',
    'afbeelding':        'image_url',
    'oude_url':          'legacy_url',
}

# Paired CTA fields collapse into a single jsonb column each.
CTA_MAP = {
    'cta_primary':   ('knop_primair', 'knop_primair_link'),
    'cta_secondary': ('knop_secundair', 'knop_secundair_link'),
}


def lees(path):
    """Front matter + body. Copied from build.py:lees so parsing cannot drift."""
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', text, re.S)
    if not m:
        return {}, text
    return yaml.safe_load(m.group(1)) or {}, m.group(2)


def json_safe(value):
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    return value


def build_pages():
    rows = []
    for folder, page_type in PAGE_TYPES.items():
        for order, path in enumerate(sorted(glob.glob(os.path.join(CONTENT, folder, '*.md')))):
            fm, body = lees(path)
            slug = os.path.basename(path)[:-3]
            row = {
                'type': page_type,
                'slug': slug,
                'body': body,
                'sort_order': order,
                'noindex': bool(fm.get('noindex', False)),
            }
            for nl, en in FIELD_MAP.items():
                if nl in fm and en not in ('published_on', 'category',
                                           'is_published', 'image_url', 'legacy_url'):
                    row[en] = json_safe(fm[nl])
            for column, (label_key, link_key) in CTA_MAP.items():
                if fm.get(label_key):
                    row[column] = {'label': fm[label_key], 'link': fm.get(link_key, '')}
            rows.append(row)
    return rows


def build_posts():
    rows = []
    for path in sorted(glob.glob(os.path.join(CONTENT, 'blog', '*.md'))):
        fm, body = lees(path)
        row = {
            'slug': os.path.basename(path)[:-3],
            'body': body,
            'is_published': bool(fm.get('gepubliceerd', True)),
        }
        for nl, en in FIELD_MAP.items():
            if nl in fm and en not in ('noindex', 'todo_note', 'faq', 'prices',
                                       'packages', 'projects', 'figures',
                                       'testimonials', 'sector_list', 'form_variant',
                                       'booking_url', 'portrait_url', 'portrait_alt',
                                       'header_image_url', 'header_alt'):
                row[en] = json_safe(fm[nl])
        rows.append(row)
    return rows


def build_logos():
    data = yaml.safe_load(open(os.path.join(CONTENT, 'logos.yml'), encoding='utf-8'))['logos']
    return [{'name': l['naam'],
             'file_path': '/assets/logos/' + l['bestand'],
             'sort_order': i}
            for i, l in enumerate(data)]


def build_settings():
    s = yaml.safe_load(open(os.path.join(CONTENT, 'settings.yml'), encoding='utf-8'))
    return {
        'id': True,
        'company': json_safe(s['bedrijf']),
        'navigation': json_safe(s['navigatie']),
        'header_cta': json_safe(s['knop']),
        'formspree_id': s.get('formspree_id') or None,
        'socials': json_safe(s['socials']),
    }


# ─────────────────────────────────────────────────────────── verification
def verify(payload):
    print('\nVerification (handover/08 step 5):')
    ok = True

    def check(label, condition, detail=''):
        nonlocal ok
        ok = ok and condition
        print(f'  [{"PASS" if condition else "FAIL"}] {label}{"  " + detail if detail else ""}')

    pages, posts = payload['pages'], payload['posts']
    check('pages = 35', len(pages) == 35, f'got {len(pages)}')
    check('posts = 7', len(posts) == 7, f'got {len(posts)}')
    check('logos = 53', len(payload['logos']) == 53, f'got {len(payload["logos"])}')
    check('settings = 1', payload['settings'] is not None)

    by_type = {}
    for p in pages:
        by_type.setdefault(p['type'], []).append(p)
    check('page type=page = 15', len(by_type.get('page', [])) == 15)
    check('page type=service = 10', len(by_type.get('service', [])) == 10)
    check('page type=sector = 4', len(by_type.get('sector', [])) == 4)
    check('page type=region = 6', len(by_type.get('region', [])) == 6)

    todo = sum(1 for p in pages if p.get('todo_note'))
    check('todo_note on 13 rows', todo == 13, f'got {todo}')

    legacy = sum(1 for p in posts if p.get('legacy_url'))
    check('legacy_url present on posts', legacy == 6, f'got {legacy}')

    nbsp = 0
    for p in pages:
        for group in ('prices', 'packages'):
            for row in (p.get(group) or []):
                if ' ' in str(row.get('vanaf', '')) + str(row.get('prijs', '')):
                    nbsp += 1
    check('non-breaking spaces intact in prices', nbsp > 0, f'{nbsp} rows')

    long_title = [p['slug'] for p in pages + posts if len(p['seo_title']) > 62]
    long_meta = [p['slug'] for p in pages + posts if len(p['meta_description']) > 158]
    check('seo_title <= 62 everywhere', not long_title, ', '.join(long_title))
    check('meta_description <= 158 everywhere', not long_meta, ', '.join(long_meta))

    klant = sum(1 for l in payload['logos'] if l['name'] == 'Klant')
    check('logos named "Klant" = 22', klant == 22, f'got {klant}')

    tokens = set()
    for p in pages:
        tokens.update(re.findall(r'\{\{[a-z\-]+\}\}', p['body']))
    print(f'         shortcode tokens preserved: {len(tokens)} distinct')
    return ok


# ─────────────────────────────────────────────────────────── loading
def load_env():
    path = os.path.join(ROOT, '.env')
    env = dict(os.environ)
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def upsert(payload, env, with_media):
    try:
        from supabase import create_client
    except ImportError:
        sys.exit('supabase-py is required to load. Install it with:\n'
                 '    pip install supabase\n'
                 'Or run with --dry-run to write supabase/seed.json instead.')

    url = env.get('PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        sys.exit('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')

    client = create_client(url, key)

    print('\nLoading into Supabase:')
    client.table('settings').upsert(payload['settings'], on_conflict='id').execute()
    print('  settings   1')

    # Idempotent: upsert on the natural keys, never insert blindly.
    client.table('pages').upsert(payload['pages'], on_conflict='type,slug').execute()
    print(f'  pages      {len(payload["pages"])}')

    client.table('posts').upsert(payload['posts'], on_conflict='slug').execute()
    print(f'  posts      {len(payload["posts"])}')

    # logos have no natural key beyond file_path; clear and reinsert in order.
    client.table('logos').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    client.table('logos').insert(payload['logos']).execute()
    print(f'  logos      {len(payload["logos"])}')

    if with_media:
        upload_media(client)


def storage_key(name):
    """Supabase Storage rejects characters that are legal on disk, notably `~`.

    Only the storage key is sanitised. The site keeps serving these images from
    the repo under their original filenames, so the rendered HTML is unchanged.
    """
    return re.sub(r'[^A-Za-z0-9._/-]', '-', name)


def upload_media(client):
    """Mirror assets/ into the `media` bucket (handover/05).

    This is a browsable copy for the CMS media library, and the destination for
    anything uploaded later. The images that shipped with the site are still
    served from the repo at their original paths, which is what keeps the
    rendered HTML identical to the reference build.
    """
    print('\nUploading media to Storage:')
    uploaded = 0
    renamed = 0
    for local in glob.glob(os.path.join(ROOT, 'assets', '**', '*'), recursive=True):
        if os.path.isdir(local):
            continue
        rel = os.path.relpath(local, os.path.join(ROOT, 'assets')).replace(os.sep, '/')
        key = f'logos/{os.path.basename(rel)}' if rel.startswith('logos/') else f'site/{rel}'
        safe = storage_key(key)
        if safe != key:
            renamed += 1
            key = safe
        with open(local, 'rb') as fh:
            try:
                client.storage.from_('media').upload(
                    key, fh.read(), {'upsert': 'true', 'cache-control': '31536000'})
                uploaded += 1
            except Exception as exc:                      # noqa: BLE001 - report and continue
                print(f'  ! {key}: {exc}')
    print(f'  uploaded   {uploaded} files'
          + (f' ({renamed} keys sanitised for Storage)' if renamed else ''))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true',
                    help='write supabase/seed.json and verify; do not touch Supabase')
    ap.add_argument('--with-media', action='store_true',
                    help='also upload assets/ to Supabase Storage')
    args = ap.parse_args()

    payload = {
        'pages': build_pages(),
        'posts': build_posts(),
        'logos': build_logos(),
        'settings': build_settings(),
    }

    ok = verify(payload)

    os.makedirs(os.path.dirname(SEED), exist_ok=True)
    with open(SEED, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f'\nWrote {SEED}')

    if not ok:
        sys.exit('Verification failed; refusing to load.')

    if not args.dry_run:
        upsert(payload, load_env(), args.with_media)
        print('\nMigration complete.')


if __name__ == '__main__':
    main()
