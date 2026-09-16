# 10 — Acceptance Criteria

Verifiable checks. "It looks right" is not a check. Where a number is given, produce it.

## A. Content parity

- [ ] 41 indexable routes + a `noindex` 404 = 42 pages, matching the route map in `06`
- [ ] Row counts: `pages` 35, `posts` 7, `logos` 53, `settings` 1
- [ ] Every Dutch string identical to source — verified by diffing rendered HTML against `dist/`
- [ ] Non-breaking spaces intact in all prices
- [ ] Exactly 13 pages carry a `todo_note`; exactly 22 logos are named "Klant"
      (these are known defects being carried over deliberately, not fixed silently)

## B. SEO and GEO — the project's reason for existing

- [ ] Every page: unique `<title>` ≤ 62 chars, meta description ≤ 158, canonical, OG tags
- [ ] `ProfessionalService` `#organisatie` and `Person` `#niels` emitted, cross-referenced
      by `@id` from every page — not duplicated inline per page
- [ ] `Service` on 20 pages, `FAQPage` on 13, `BlogPosting` on 7
- [ ] Google Rich Results Test passes on: home, a service page, a blog post, an FAQ page
- [ ] `sitemap.xml` lists 41 URLs with correct priorities, excludes `/404`
- [ ] `robots.txt` explicitly allows GPTBot, PerplexityBot, ClaudeBot, Google-Extended
- [ ] `llms.txt` present with live company details
- [ ] All 16 redirects resolve with a 301, including the 7 per-post `legacy_url` rules
- [ ] Blog index is in the prerendered HTML, **not** rendered client-side

## C. Design fidelity

- [ ] Rendered pages match `preview/` — compare side by side at 1440px, 768px and 375px
- [ ] Token values match `03-DESIGN-SYSTEM.md` exactly
- [ ] All 8 media queries carried over, including `prefers-reduced-motion` and `print`
- [ ] Mobile nav opens/closes; `aria-expanded` and `aria-controls` correct
- [ ] Skip link present and functional
- [ ] Images carry explicit `width`/`height`
- [ ] Nav order is `Over Niels · Diensten · Referenties · Prijzen · Blog · Contact`

## D. CMS

- [ ] Niels can log in; public sign-up is disabled
- [ ] Unauthenticated access to `/admin/*` redirects to login
- [ ] All content types editable: pages, services, sectors, regions, posts, logos, settings
- [ ] New blog post creatable end to end, appearing live after publish
- [ ] Character counters enforce 62 / 158 before save
- [ ] Repeating fields edited as rows — **no raw JSON in the UI anywhere**
- [ ] Shortcodes insertable by name, previewed as labelled blocks
- [ ] Unpublished-changes state is visible and accurate
- [ ] Publish triggers a rebuild; build state reported honestly, including failures
- [ ] Dashboard's outstanding-items list is data-driven and correct

## E. Security

- [ ] RLS enabled on all four tables; `anon` has no policy
- [ ] Service role key absent from every client bundle — grep the build output
- [ ] Deploy hook callable only from a server route, and rate-limited
- [ ] No secrets committed; `.env.example` present
- [ ] Admin sessions in httpOnly cookies, not `localStorage`

## F. Performance

- [ ] Published output contains zero runtime Supabase calls — grep for the project URL
- [ ] Lighthouse mobile no worse than the current static build on any of the four scores
- [ ] Fonts still `preconnect` + `display=swap`

## G. Handover back

- [ ] README: run locally, build, deploy, publish
- [ ] Migration script committed and documented
- [ ] `.env.example` committed
- [ ] Open questions Q1–Q5 recorded with their resolutions
- [ ] Remaining content placeholders listed for the client (see `01`)

## Definition of done

The site is live on `www.onemanagency.be`, Niels has published a blog post and a content
edit himself without assistance, and search/AI visibility is no worse than the static build
it replaced.

## What "not done" looks like

- A beautiful codebase that dropped the JSON-LD cross-references
- A CMS that requires knowing Markdown or JSON
- Prerendering that silently missed the dynamic routes and shipped 30 pages
- Invented Dutch copy, testimonials or client names
- A green "Published" state that was never verified against the host
