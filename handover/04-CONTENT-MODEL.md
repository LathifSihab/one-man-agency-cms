# 04 — Content Model

Extracted from the 44 Markdown files in `content/` plus `settings.yml` and `logos.yml`.
Field names below are the **current Dutch keys**. You may rename them to English in the
database (recommended for a TypeScript codebase) as long as `08-MIGRATION.md` maps them,
but keep the *values* untouched.

Every content item = structured front-matter fields + a Markdown body.

## Shared fields — on all page types

| Field (NL) | Suggested EN | Type | Constraint |
|---|---|---|---|
| `titel` | `title` | text | required. Renders as H1 |
| `seo_titel` | `seo_title` | text | required. **≤ 62 characters — enforce in the CMS** |
| `meta_omschrijving` | `meta_description` | text | required. **≤ 158 characters — enforce** |
| `intro` | `intro` | text | required. Lead paragraph under the H1 |
| *(body)* | `body` | markdown | The Markdown after the front matter |

The two length limits are currently enforced by regex in `admin/config.yml`. They are not
cosmetic: they are why every title and description renders fully in search results.

## 1. `paginas` — fixed pages (15)

Slug = filename. `home` maps to `/`, everything else to `/<slug>`.

Optional fields, with the count of pages using each:

| Field | Count | Type | Notes |
|---|---|---|---|
| `faq` | 3 | list of `{vraag, antwoord}` | Also drives `FAQPage` JSON-LD |
| `af_te_werken` | 3 | text | Renders a visible notice. See Q4 in `02` |
| `formulier` | 2 | enum `contact` \| `scan` | Selects the form variant |
| `portret` / `portret_alt` | 2 | image + text | |
| `noindex` | 1 | boolean | **404 page only** |
| `agenda_url` | 1 | url | `/afspraak` — Google Calendar embed |
| `cijfers` | 1 | list of `{getal, label}` | Homepage stat row |
| `citaten` | 1 | list of `{tekst, naam, functie}` | Homepage testimonials |
| `sectoren_lijst` | 1 | list of text | Homepage sector list |
| `pakketten` | 1 | list — see below | `/prijzen` |
| `projecten` | 1 | list of `{wat, vanaf, link}` | `/prijzen` |
| `header_afbeelding` / `header_alt` | 1 | image + text | Homepage band image |
| `knop_primair` / `knop_primair_link` | 1 | text + url | Homepage hero CTA |
| `knop_secundair` / `knop_secundair_link` | 1 | text + url | Homepage hero CTA |

`pakketten` item shape:
```yaml
naam: "Easy to Start"
voor_wie: "Voor wie net begint of een klein budget heeft"
prijs: "€ 475"
periode: "per maand, excl. btw"
uitgelicht: false        # boolean — true gets the highlighted card
inbegrepen: [ ... ]      # list of text
```

### Shortcodes — the hard part

Page bodies contain tokens that expand into components. The current parser splits the
Markdown on `/(\{\{[a-z\-]+\}\})/` and alternates between prose blocks and components.
**Your renderer must reproduce this**, or homepage and pricing content will not assemble.

| Token | Component | Used on |
|---|---|---|
| `{{diensten}}` | ServicesGrid | home |
| `{{diensten-volledig}}` | ServicesGrouped | diensten |
| `{{citaten}}` | Testimonials | home |
| `{{stappen}}` | Steps | home |
| `{{sectoren}}` | SectorList | home |
| `{{scan-blok}}` | ScanCta | home |
| `{{logos}}` | LogoWall | referenties |
| `{{logos-strook}}` | LogoStrip | home |
| `{{pakketten}}` | PackageCards | prijzen |
| `{{projecten}}` | ProjectPrices | prijzen |
| `{{faq}}` | Faq | prijzen, veelgestelde-vragen |
| `{{agenda}}` | BookingEmbed | afspraak |
| `{{blogindex}}` | BlogIndex | blog |
| `{{intro-blok}}`, `{{einde-blok}}` | **no-ops** — stripped, render nothing | home |

Only 6 of 15 pages use shortcodes. Suggested approach: store the body as Markdown with
tokens intact, and resolve tokens to components at render time. In the CMS, show the
available tokens as insertable buttons rather than expecting the client to type them.

## 2. `diensten` — service pages (10)

Route `/diensten/<slug>`. All 10 have **every** field:

| Field | Type |
|---|---|
| shared fields | as above |
| `prijzen` | list of `{wat, vanaf}` — e.g. `{wat: "Onepager", vanaf: "€ 1.450"}` |
| `faq` | list of `{vraag, antwoord}` |

Slugs: `ai-voor-kmo`, `branding-en-huisstijl`, `e-mailmarketing`, `foto-en-video`,
`google-ads`, `grafische-vormgeving-en-drukwerk`, `marketingstrategie`, `seo-en-geo`,
`social-media`, `webdesign`.

> **Encoding warning:** prices contain `€` followed by a **non-breaking space** (U+00A0),
> e.g. `€\u00a01.450`. Preserve it. Read and write UTF-8 explicitly everywhere.

## 3. `sectoren` — sector pages (4)

Route `/sectoren/<slug>`. Shared fields + `af_te_werken` (all 4 have it).
Slugs: `bouw-en-renovatie`, `garages-en-autobedrijven`, `horeca-en-retail`,
`verzekeringsmakelaars`.

## 4. `regio` — region pages (6)

Route `/regio/<slug>`. Shared fields + `af_te_werken` (all 6 have it).
These pages also append the full services list after the body — see `blok_diensten(kort=False)`.
Slugs: `marketingbureau-aalst`, `marketingbureau-dendermonde`, `marketingbureau-lebbeke`,
`marketingbureau-sint-niklaas`, `marketingbureau-wetteren`, `marketingbureau-zele`.

## 5. `blog` — posts (7)

Route `/blog/<slug>`. All 7 have every field:

| Field | Type | Notes |
|---|---|---|
| shared fields | | |
| `datum` | date | Sort key, descending. Rendered in Dutch long form: `14 september 2026` |
| `categorie` | enum | In use: `SEO & vindbaarheid`, `Branding`, `Strategie`. Full allowed list is in `admin/config.yml`: also `Website`, `Social media`, `AI & automatisatie`, `Lokale marketing` |
| `gepubliceerd` | boolean | `false` excludes the post from the build entirely |
| `afbeelding` | image | |
| `oude_url` | text | **Generates a 301 redirect from the old site. Do not drop this field.** |

Dutch month names are needed for date rendering — copy the array from `build.py:nl_datum`.

## 6. `settings.yml` — site settings (singleton)

```yaml
bedrijf:      naam, juridisch, straat, postcode, stad, btw,
              telefoon, telefoon_link, email, slogan
navigatie:    list of {label, link}      # 6 items
knop:         {label, link}              # header CTA
formspree_id: string                     # currently a placeholder
socials:      list of {naam, url}        # 4 items
```

`bedrijf` feeds the `ProfessionalService` JSON-LD on every page, and `socials` feeds
`sameAs` on both the organisation and the person. Changing these changes the schema
site-wide — worth a warning in the CMS.

## 7. `logos.yml` — client logos (53)

```yaml
- naam:    "NeoKraft"        # becomes the alt text
  bestand: "neokraft_social-70LdMw6xCyBXwOZA.png"
  url:     "https://assets.zyrosite.com/..."   # legacy CDN fallback
```

All 53 files are present locally in `assets/logos/`. The `url` field is now dead weight —
migrate it or drop it, but the site must not fetch from `zyrosite.com` again.
**22 of 53 have `naam: "Klant"`** and need real client names; surface this in the CMS.
