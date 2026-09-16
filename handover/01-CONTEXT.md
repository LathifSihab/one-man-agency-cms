# 01 — Context

## The business

**One Man Agency BV** — a one-person marketing agency in Dendermonde, East Flanders,
Belgium, run by **Niels Van de Meersch**. Sells marketing strategy, branding, web design,
SEO/GEO, Google Ads, social media, email marketing, print, photo/video and AI services to
SMEs ("KMO's") in East Flanders.

- Slogan: *"A One Man Agency is all you need."*
- Positioning: one point of contact, no account managers, 25 years of experience.
- Site language: Dutch (`nl-BE`). **All visitor-facing text stays Dutch.** Code, comments
  and these documents are English.
- Production domain: `https://www.onemanagency.be`

## Where the project stands

| | |
|---|---|
| Current live site | Still the old Zyro/Hostinger builder site. **Not** the design you are building. |
| This repository | The finished replacement: 42 pages, built by `build.py`, not yet deployed |
| Your job | Port that replacement to SvelteKit + Supabase, with a custom CMS |

The rebuild exists because the old site could not rank: nine services on one page, zero
structured data, no local landing pages, 50 unlabelled logos, and no control over URLs or
schema. The full audit is in `docs/onemanagency-website-blueprint.md`.

## Why this matters for your implementation

The client sells SEO and GEO. The site is his own proof. Concretely, the current build
emits, and yours must too:

- a unique `<title>` (under 62 chars), meta description (under 158), canonical and
  Open Graph set per page
- a single `ProfessionalService` entity (`#organisatie`) and `Person` entity (`#niels`),
  referenced by `@id` from every other page's JSON-LD, so the entity graph is consistent
- `Service` schema on 20 pages, `FAQPage` where FAQs exist, `BlogPosting` on posts
- `sitemap.xml` with per-page priorities, `robots.txt` explicitly allowing GPTBot,
  PerplexityBot, ClaudeBot and Google-Extended, and a hand-written `llms.txt`
- 16 `301` redirects preserving the authority of the old site's URLs

## What must not regress

1. **Rendered HTML.** Same content, same heading hierarchy, same URLs.
2. **All SEO artefacts** listed above.
3. **The design.** See `03-DESIGN-SYSTEM.md`; the visual target is `preview/`.
4. **Dutch copy.** Do not rewrite, retranslate or "improve" any visitor-facing text.
   Migrate it verbatim.
5. **The 16 redirects**, including the seven per-post `oude_url` redirects.

## Scale

| Content type | Count |
|---|---|
| Fixed pages (`paginas`) | 15 |
| Service pages (`diensten`) | 10 |
| Sector pages (`sectoren`) | 4 |
| Region pages (`regio`) | 6 |
| Blog posts | 7 |
| Client logos | 53 |
| **Indexable pages** | **41** (+ a `noindex` 404 page = 42 HTML pages) |

## Known unfinished content — do not invent replacements

Carried over from the current build; see `docs-en/05-OPEN-ITEMS-AUDIT.md` for the full list.

- `formspree_id` is the placeholder `JOUW-FORMSPREE-ID` — **all forms currently fail**
- Three homepage testimonials are placeholder text attributed to "Voornaam Naam"
- 22 of 53 logos are named `"Klant"` ("Client")
- 13 pages carry an `af_te_werken` note that **renders visibly on the live page**
- The business address conflicts between two sources and is unresolved

Migrate these as-is. Do not fabricate testimonials, client names, legal text or a
Formspree ID. Surface them in the CMS so the client can fix them.
