# 02 — Decisions, Non-Goals, and Open Questions

## Locked decisions

These were decided by the client. Implement them; do not relitigate.

| # | Decision | Detail |
|---|---|---|
| D1 | **Stack: SvelteKit + TypeScript + Supabase** | Chosen for stack ownership and consistency — the client wants a CMS he owns on his own stack, rather than a third-party Git-based CMS. |
| D2 | **Custom-built CMS** | Not Sveltia, not Decap, not a hosted CMS. Built as part of this project. |
| D3 | **Design = the build in this repository** | Not the current live onemanagency.be. The target is `preview/`. |
| D4 | **Static prerender at build time** | Content is read from Supabase during the build; output is static HTML. Publishing triggers a rebuild. |
| D5 | **One CMS user: Niels** | Single admin account, full access. No roles, no user-management UI, no invite flow. |

### On D1 — recorded for the record

The repository already contains a configured Git-based CMS (Sveltia, in `admin/config.yml`)
that covers the stated requirement at zero infrastructure cost. The client was informed of
this and chose the custom build anyway, for stack ownership. This note exists so you do not
spend time rediscovering the alternative or proposing it back. **Build what is specified.**

### On D4 — why static, not SSR

The site's value is search and AI visibility. Static prerendering keeps the HTML identical
to today's output, removes Supabase from the request path entirely, and means a paused or
slow database can never affect a visitor or a crawler. The cost is a rebuild (~1 minute) on
every publish. That trade was made deliberately. See `09-DEPLOYMENT.md` for the hook.

## Non-goals

Do not build these. If you think one is needed, ask first.

- Multi-language / i18n. The site is Dutch-only.
- Multi-user accounts, roles, permissions, audit logs.
- E-commerce, payments, client portal, or a quote/offer tool.
- A visual page builder or drag-and-drop layout editor. Content is structured fields
  plus Markdown body — same model as today.
- Redesigning anything. Port the design as-is.
- Rewriting the Dutch copy.
- Comments, search, newsletter infrastructure, or analytics dashboards.

## Open questions — ask, do not assume

Each of these changes the implementation. Get an answer before building the affected part.

| # | Question | Blocks |
|---|---|---|
| Q1 | **Do the contact forms stay on Formspree, or move to Supabase?** Today both forms POST to Formspree with a placeholder ID. Moving them to a Supabase table plus an email notification is more work but removes a dependency and stores submissions. | The two form components, and whether a "submissions" inbox screen is needed in the CMS |
| Q2 | **Where do images live?** Supabase Storage (needs the media library, bucket policies, and transformation decisions) or committed to the repo as today? The current build has 12 site assets plus 53 logos. | Media library, migration script, `05` and `07` |
| Q3 | **Which host?** Cloudflare Pages is what the current docs assume and what the existing `_redirects` file targets. Vercel/Netlify would need the redirect syntax rewritten. | `09-DEPLOYMENT.md`, adapter choice, redirect format |
| Q4 | **Is the `af_te_werken` "unfinished" banner still wanted?** It renders visibly to visitors on 13 pages today. That is deliberate but unusual. | Whether the field survives into the schema as a rendered element or becomes a CMS-only note |
| Q5 | **Should `_headers` be reinstated?** The original delivery had a Cloudflare `_headers` file; it was lost and `build.py` never generated it. Its contents (CSP, HSTS, cache-control) are a decision, not a guess. | `09-DEPLOYMENT.md` |

## Decisions you may make yourself

- Component file layout, naming, and internal TypeScript types
- Test framework and coverage approach
- Styling mechanism (see `03-DESIGN-SYSTEM.md` — the tokens are fixed, the delivery
  mechanism is yours: plain CSS, CSS modules, or Tailwind configured with these exact tokens)
- Migration script language (TypeScript or Python — Python already has the Markdown and
  YAML parsing in `build.py` to copy from)
