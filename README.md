# One Man Agency — SvelteKit + TypeScript + Supabase

The marketing site for One Man Agency (Dendermonde, BE), rebuilt on SvelteKit with content
in Supabase and a custom CMS at `/admin`.

The public site is **fully prerendered at build time**: content is read from Supabase during
the build and written to static HTML, so a visitor or a crawler never touches the database.
Publishing a change means triggering a rebuild, which takes about a minute.

---

## Quick start

```bash
npm install
cp .env.example .env        # fill in the Supabase values
npm run dev                 # http://localhost:5173
```

Without Supabase credentials the site builds from `supabase/seed.json`, so `npm run dev`
and `npm run build` work before the database exists.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Prerender the site and inject the redirects |
| `npm run preview` | Serve the production build locally |
| `npm run check` | TypeScript and Svelte diagnostics |
| `npm run verify` | Acceptance checks against the build output |
| `npm run parity` | Diff the build against the original site (`dist-original/`) |

## Layout

```
src/
  lib/
    markdown.ts          Markdown -> HTML, matched to the original renderer
    schema.ts            JSON-LD: ProfessionalService, Person, Service, FAQPage, BlogPosting
    shortcodes.ts        {{tokens}} in page bodies
    site.ts              Services, steps, Dutch dates, sitemap priorities
    server/content.ts    Build-time content access (Supabase, or the seed file)
    components/          Public site blocks
    components/admin/    CMS editors
  routes/
    (public)             Prerendered: /, /[slug], /diensten/[slug], /blog/[slug], …
    admin/               The CMS. Never prerendered, requires login
    api/                 Form submissions and the publish hook
supabase/
  schema.sql             Tables, RLS, storage bucket
  seed.json              Migration payload; also the offline build fallback
tools/                   Migration and verification scripts
content/                 Markdown source (see "Where the content came from")
dist-original/           The original build. Immutable reference — do not edit
```

---

## Setting up Supabase

1. Create a project, then run `supabase/schema.sql` in the SQL editor.
2. **Disable public sign-up** under Authentication → Providers → Email.
   There is one account; an open sign-up endpoint is the obvious way in.
3. Create Niels's account manually, with email and password.
4. Fill in `.env`.
5. Load the content:

```bash
python tools/migrate.py --dry-run     # verify the mapping, write supabase/seed.json
python tools/migrate.py               # upsert into Supabase
python tools/migrate.py --with-media  # also upload assets/ to Storage
```

The migration is idempotent — it upserts on `(type, slug)` and `slug`, so re-running it
never duplicates rows. It refuses to load if its own verification fails.

---

## Deploying (Vercel)

Set these in the Vercel project:

| Variable | Scope | Notes |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | build + runtime | Safe to expose |
| `PUBLIC_SUPABASE_ANON_KEY` | runtime | Safe to expose; RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | build + runtime | **Secret.** Bypasses RLS. Server-side only |
| `DEPLOY_HOOK_URL` | runtime | **Secret.** Anyone holding it can trigger builds |
| `PUBLIC_SITE_URL` | build | `https://www.onemanagency.be` |

Create a Deploy Hook (Settings → Git → Deploy Hooks) and put its URL in `DEPLOY_HOOK_URL`.
That is what the CMS Publish button calls, from a server route.

Attaching the production domain takes the old site offline and is the irreversible step.
**Do it last**, after verifying on the `*.vercel.app` URL.

### The publish cycle

```
Niels edits in /admin
  → saved to Supabase          (the live site is unchanged)
  → clicks Publish             (server route POSTs to DEPLOY_HOOK_URL)
  → Vercel rebuilds, reading Supabase
  → static output deployed     (~1 minute)
```

Saving is never called publishing. The CMS shows a banner stating how many changes are not
yet live, and reports build state as building / live / failed — never a green state it has
not verified.

---

## Where the content came from

The handover named `content/`, `preview/`, `scripts/` and `docs/` as the specification, but
only `dist/` and `handover/` were delivered; `build.py` was supplied separately. The
Markdown source was therefore **reconstructed from the rendered HTML** by
`tools/extract.py`.

That reconstruction is proven, not assumed:

```bash
python tools/extract.py    # dist-original/ -> content/
python build.py            # the original generator, run on the reconstructed content
python tools/verify.py     # byte-compare against dist-original/
```

All 113 files come back **byte-identical**, including every page's JSON-LD, `sitemap.xml`,
`robots.txt`, `llms.txt` and `_redirects`. `content/` and `build.py` are kept as the
historical reference; do not delete them until the new site has been live through a full
publish cycle.

## How "no regression" is checked

```bash
npm run build
npm run parity     # semantic diff against the original site
npm run verify     # acceptance criteria
```

`tools/parity.py` compares, for all 42 pages: the head SEO set, the JSON-LD graph as parsed
objects, every heading, every link, every image, and the visible text of `<main>`.
Whitespace and attribute order are ignored, as the handover allows; anything else is a bug.

`tools/verify.py` checks the acceptance criteria: 41 indexable routes, the sitemap and its
priorities, the AI-crawler allowances, 16 redirects, and the JSON-LD counts
(`Service` on 20 pages, `FAQPage` on 13, `BlogPosting` on 7).

Both currently pass with zero differences.

---

## Decisions taken, and where they differ from the handover

**Resolved open questions**

| | Question | Resolution |
|---|---|---|
| Q1 | Contact forms | Stored in Supabase. `/api/submit` writes with the service role key; submissions appear under **Berichten** in the CMS |
| Q2 | Images | Supabase Storage (`media` bucket), baked into the static output at build time |
| Q3 | Host | Vercel |
| Q4 | `af_te_werken` notices | Still rendered visibly, exactly as before, and editable in the CMS. Changing this would be a visible content change, which was out of scope — **worth confirming with the client** |
| Q5 | `_headers` | Not written. CSP, HSTS and cache-control are decisions, not defaults to guess — **still open** |

**Deviations, and why**

- **`adapter-vercel`, not `adapter-static`.** The handover assumed Cloudflare Pages. Every
  public route is still prerendered to static HTML; only `/admin` and `/api` run as
  functions, which `adapter-static` cannot host.
- **Redirects are injected at build time** (`tools/redirects.mjs`) rather than shipped as a
  Cloudflare `_redirects` file, which Vercel ignores. A `_redirects` file is still written
  alongside as a portable record. A new post with a `legacy_url` is covered automatically.
- **The mobile nav stays three lines of inline JavaScript.** The handover suggested a
  `$state` boolean, but that needs hydration, and shipping the Svelte runtime to power one
  button would break the performance budget the same document sets.
- **Two new pages, `/bedankt` and `/formulier-fout`.** Moving the forms off Formspree needs
  somewhere to land. Both are `noindex` and excluded from the sitemap, so the indexable
  count is unchanged at 41. **Their Dutch copy is new and should be reviewed by the client.**
- **`tools/build.mjs` wraps `vite build`** to fall back from symlink to directory junction
  on Windows, where symlinks need Developer Mode. It is a no-op on Linux.

**Two handover facts the data contradicts**

- There are **6** posts with an `oude_url`, not 7 — giving 10 static + 6 post rules = 16.
- There are **42** Markdown files, not 44. Any unpublished drafts left no trace in the
  rendered output and could not be recovered.

---

## Known content gaps (carried over deliberately)

These were migrated as-is rather than invented, and are surfaced on the CMS dashboard:

- **22 of 53 logos** are still named `"Klant"`, so their alt text carries no client name.
- **13 pages** carry an `af_te_werken` note that renders visibly to visitors.
- **Three homepage testimonials** are placeholder text attributed to "Voornaam Naam".
- **The business address** conflicted between sources in the original material and is
  unresolved.
- `formspree_id` is still the placeholder. It no longer matters — forms post to Supabase —
  and the field is kept only as a fallback.

## Before the domain cutover

Run against the deployed URL, not locally:

- [ ] All 41 routes return 200; an unknown path returns the styled 404
- [ ] `/sitemap.xml`, `/robots.txt`, `/llms.txt` load
- [ ] Old URLs 301: `/vragen` → `/veelgestelde-vragen`, `/webdesign` → `/diensten/webdesign`
- [ ] JSON-LD passes Google's Rich Results Test on the home page, a service page, a post
- [ ] Mobile menu opens and closes and `aria-expanded` flips
- [ ] Both forms submit and appear under **Berichten**
- [ ] `/admin` redirects to the login screen when logged out
- [ ] A full edit → publish → live cycle completes
- [ ] Lighthouse on mobile is no worse than the original static build
