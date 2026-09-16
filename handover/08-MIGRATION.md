# 08 — Content Migration

Move 44 Markdown files, `settings.yml`, `logos.yml` and 65 images into Supabase, **once**,
losslessly, and verifiably.

## Ground rules

1. **Verbatim.** Do not reword, retranslate, reformat or "clean up" any Dutch copy.
2. **Idempotent.** Re-running the script must not create duplicates. Upsert on
   `(type, slug)` and `slug`.
3. **Verified, not assumed.** The script reports counts and a diff; you check them.
4. **UTF-8 everywhere.** Prices contain `€` + U+00A0 (non-breaking space); Dutch text has
   accented characters and typographic apostrophes (`'`). Open every file with an explicit
   `encoding='utf-8'`. Windows defaults will corrupt these silently.

## Reuse what exists

`build.py` already parses this content correctly. Its `lees()` function (line 26) splits
front matter from body with `^---\n(.*?)\n---\n?(.*)$` and `yaml.safe_load`. Copy that
rather than writing a new parser. Writing the migration in Python is the low-risk choice
for this reason.

## Steps

### 1. Extract
Walk `content/paginas`, `content/diensten`, `content/sectoren`, `content/regio`,
`content/blog`. For each file: slug = filename without `.md`; front matter → fields;
remainder → `body` **with `{{tokens}}` left intact**.

### 2. Map field names
Apply the NL → EN mapping from `04-CONTENT-MODEL.md`. Keep a single mapping table in the
script so it is auditable. Type notes:

- `datum` → `published_on` — already a `datetime.date` from YAML; do not re-parse from a string
- `gepubliceerd` → `is_published` — boolean
- `uitgelicht` inside packages — boolean, not the string `"False"`
- `noindex` — only on the 404 page
- `af_te_werken` → `todo_note`
- `oude_url` → `legacy_url` — **required for redirects, do not drop**

### 3. Images (depends on Q2)
If Supabase Storage: upload `assets/` (12 files) and `assets/logos/` (53 files), keeping
filenames, then rewrite paths in content. If staying in the repo: store
`/assets/logos/<file>.png` style paths and skip this step.

### 4. Load
Upsert `settings` (one row), `logos` (53, preserving `logos.yml` order as `sort_order`),
`pages` (35: 15 + 10 + 4 + 6), `posts` (7).

### 5. Verify — do not skip

| Check | Expected |
|---|---|
| Row counts | `pages` = 35, `posts` = 7, `logos` = 53, `settings` = 1 |
| Slugs | Match the route map in `06` exactly |
| Bodies | Byte-identical to the source Markdown, tokens intact |
| Non-breaking spaces | Still present in every `prijzen`/`pakketten` price |
| `legacy_url` | Present on all 7 posts |
| `todo_note` | Present on exactly 13 rows |
| Logos named "Klant" | Exactly 22 — if this changes, something was mangled |
| SEO lengths | All `seo_title` ≤ 62, all `meta_description` ≤ 158 |

### 6. The real acceptance test

Build the SvelteKit site from Supabase, then **diff the rendered HTML against `dist/`**.

```bash
python build.py                  # regenerate the reference
# build the SvelteKit site into e.g. build/
diff -r dist/ build/ | head -50
```

Differences in whitespace, attribute order and generator comments are fine. Differences in
**text content, headings, links, or JSON-LD are migration bugs.** Investigate every one.

## After migration

`content/`, `build.py` and `scripts/` become the historical reference. **Do not delete them
until the new site is live, verified and has been through a full publish cycle.** They are
the only way to regenerate the reference output for diffing.
