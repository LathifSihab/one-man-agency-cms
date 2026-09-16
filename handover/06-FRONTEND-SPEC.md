# 06 — Frontend Spec

SvelteKit + TypeScript, **fully prerendered** (D4). Reference implementation: `build.py`.
Diff your output against `dist/`.

## Rendering strategy

```ts
// src/routes/+layout.ts
export const prerender = true;
export const ssr = true;
export const csr = false;   // the public site needs no client-side JS beyond the nav toggle
```

- Use `adapter-static`.
- All content is fetched from Supabase **in `+page.server.ts` / `entries()` during the
  build**, using the service role key server-side.
- Dynamic routes (`/diensten/[slug]`, `/blog/[slug]`, …) need an
  [`entries()`](https://svelte.dev/docs/kit/page-options#entries) export returning every
  slug from Supabase, or prerendering will miss pages. **This is the most likely way to
  silently ship a 30-page site instead of a 42-page one — verify the count.**
- The published output must contain **zero** runtime Supabase calls. Confirm by grepping
  the build output for your Supabase project URL.

## Route map — all 41 indexable routes

Reproduce these URLs exactly. They are in `sitemap.xml` and in the 301 redirects.

| Route | Source | Sitemap priority |
|---|---|---|
| `/` | `pages` where slug=`home` | 1.0 |
| `/diensten`, `/prijzen`, `/referenties`, `/gratis-marketingscan` | `pages` | 0.9 |
| `/diensten/[slug]` × 10 | `pages` type=service | 0.8 |
| `/sectoren/[slug]` × 4 | `pages` type=sector | 0.7 |
| `/regio/[slug]` × 6 | `pages` type=region | 0.7 |
| `/afspraak`, `/contact`, `/over-niels`, `/blog`, `/veelgestelde-vragen`, `/wat-kost-een-website`, `/privacybeleid`, `/cookiebeleid`, `/algemene-voorwaarden` | `pages` | 0.7 |
| `/blog/[slug]` × 7 | `posts` | 0.6 |
| `/404` | `pages` slug=404 | **noindex, excluded from sitemap** |

No trailing slashes. No `.html` extensions.

## Per-page `<head>` — every page

```html
<title>{seo_title}</title>
<meta name="description" content="{meta_description}">
<link rel="canonical" href="https://www.onemanagency.be{route}">
<meta name="robots" content="index, follow">        <!-- or noindex on /404 -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="One Man Agency">
<meta property="og:locale" content="nl_BE">
<meta property="og:title" content="{seo_title}">
<meta property="og:description" content="{meta_description}">
<meta property="og:url" content="https://www.onemanagency.be{route}">
<meta property="og:image" content="https://www.onemanagency.be/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#49C2AB">
```

`<html lang="nl-BE">`. Canonical and `og:url` are **always absolute** on the production
domain, never relative — a lesson already learned in this repo.

## JSON-LD — the highest-risk part of the port

Copy the object construction from `build.py` (the `ORG` constant at line 50, and the
per-page `extra_schema` arguments). Emit as `<script type="application/ld+json">`.

1. **`ProfessionalService`**, `@id: https://www.onemanagency.be/#organisatie` — on every
   page. Built from `settings.company` + `settings.socials`. Includes `founder` (the
   `Person` node), `address`, `areaServed` (12 municipalities + Oost-Vlaanderen),
   `openingHoursSpecification` (Mon–Fri 08:30–18:00), `vatID`, `priceRange`, `sameAs`.
2. **`Person`**, `@id: .../#niels` — Niels Van de Meersch, nested as `founder`.
3. **`Service`** — on all 20 service/sector/region pages, with
   `provider: {"@id": ".../#organisatie"}` and `areaServed` = Oost-Vlaanderen.
4. **`FAQPage`** — on every page with FAQs (13 pages), one `Question`/`acceptedAnswer` per item.
5. **`BlogPosting`** — on each post: `headline`, `description`, `datePublished`,
   `inLanguage: nl-BE`, `author: {"@id": ".../#niels"}`,
   `publisher: {"@id": ".../#organisatie"}`, `mainEntityOfPage`.

The `@id` cross-references are the point: they tell Google and AI assistants that all 41
pages describe one entity. **Do not inline duplicate organisation objects per page.**

Validate every route against Google's Rich Results Test before calling this done.

## Generated files — all must still be produced at build time

| File | How |
|---|---|
| `sitemap.xml` | All 41 indexable routes, `<lastmod>` = build date, priorities per the table above. Excludes `/404`. |
| `robots.txt` | `Allow: /` for `*`, plus explicit `Allow` blocks for **GPTBot, PerplexityBot, ClaudeBot, Google-Extended**, plus the sitemap URL. Copy the current text; the AI-crawler allowances are deliberate. |
| `llms.txt` | Hand-written plain-text business summary. Copy from `build.py` and template in the live company details, phone, email and address. |
| `_redirects` | 16 rules: 10 static legacy paths (`/diensten-one-man-agency`, `/marketingbureau-prijzen`, `/pakketten`, `/marketingbureau-kmo`, `/referenties`, `/vragen`, `/offerte-or-contact`, `/gratis-marketing-scan`, `/webdesign`, `/post/*`) plus one per post `legacy_url`. **Format is host-specific — see Q3.** |

## Client-side JavaScript

Essentially none. The only interactive element is the mobile nav toggle (see `03`).
`csr = false` is viable for the public site. The admin app is a separate, fully client-side
concern — see `07`.

**Do not** render the blog index client-side. The old site did, and the audit flagged it as
uncrawlable. It must be in the prerendered HTML.

## Performance budget — match or beat the current build

The current output is static HTML with one 358-line stylesheet, one webfont, and 3 lines of
JS. Fonts use `preconnect` + `display=swap`. Images carry explicit `width`/`height`
(preventing layout shift). Any framework overhead you add should be measured against this,
not assumed to be free.
