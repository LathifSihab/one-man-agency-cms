# Handover — One Man Agency, rebuild on SvelteKit + TypeScript + Supabase

**Audience: the AI agent implementing this.** Read all files in order before writing code.
Everything here is extracted from the existing, working codebase in this repository.
Where a value is given (a hex code, a field name, a route), it is the real value — use it
verbatim rather than inventing your own.

## Read in this order

| # | File | What it settles |
|---|---|---|
| 01 | [01-CONTEXT.md](01-CONTEXT.md) | What the business is, what the site is for, what must not regress |
| 02 | [02-DECISIONS.md](02-DECISIONS.md) | Locked decisions, explicit non-goals, open questions you must not guess |
| 03 | [03-DESIGN-SYSTEM.md](03-DESIGN-SYSTEM.md) | Tokens, breakpoints, component inventory |
| 04 | [04-CONTENT-MODEL.md](04-CONTENT-MODEL.md) | Every content type and field, as it exists today |
| 05 | [05-SUPABASE-SCHEMA.md](05-SUPABASE-SCHEMA.md) | Tables, relations, RLS, auth, storage |
| 06 | [06-FRONTEND-SPEC.md](06-FRONTEND-SPEC.md) | Routes, prerendering, components, SEO output |
| 07 | [07-CMS-SPEC.md](07-CMS-SPEC.md) | The custom admin application |
| 08 | [08-MIGRATION.md](08-MIGRATION.md) | Getting today's content into Supabase |
| 09 | [09-DEPLOYMENT.md](09-DEPLOYMENT.md) | Hosting, env vars, rebuild-on-publish |
| 10 | [10-ACCEPTANCE.md](10-ACCEPTANCE.md) | Definition of done, with verifiable checks |

## The one-paragraph version

One Man Agency is a one-person marketing agency in Dendermonde, Belgium. This repository
holds a finished 42-page Dutch marketing website, generated from Markdown by a 614-line
Python script (`build.py`) and heavily optimised for search engines and AI assistants.
The client wants to keep that design and that content, but manage it through a custom CMS
built on SvelteKit + TypeScript + Supabase instead of the Git-based CMS currently wired up.
Your job is to port the site to SvelteKit with content in Supabase, prerendered to static
HTML at build time, plus an admin application for a single user.

## The reference implementation is in this repo — use it

Do not design from scratch. These files are the specification:

- `build.py` — every page's HTML structure, all JSON-LD, sitemap/robots/llms generation
- `assets/style.css` — 358 lines, the complete design system
- `content/` — 44 Markdown files, `settings.yml`, `logos.yml`
- `preview/` — **run `python build.py && python scripts/preview.py`, then open
  `preview/index.html`.** This is the visual target. Click through it before writing code.
- `dist/` — the production build; diff your output against it

## Non-negotiable

The site's entire purpose is being found in Google and cited by AI assistants. Every
SEO artefact described in `06-FRONTEND-SPEC.md` must survive the port byte-for-byte in
meaning. A prettier codebase that ranks worse is a failed project.
