# 03 — Design System

Source of truth: `assets/style.css` (358 lines). **Port it, do not redesign it.**
Visual target: run `python build.py && python scripts/preview.py`, open `preview/index.html`.

The simplest correct approach is to carry `style.css` over almost unchanged and scope
component styles around it. Rewriting it into a utility framework is allowed (D-level
decision) but the token values below are fixed.

## Tokens — copy verbatim

```css
:root {
  /* Colour */
  --ink:        #0A0A0A;   /* black, as in the wordmark */
  --ink-soft:   #3B3B3B;
  --muted:      #6E6E6E;
  --paper:      #FFFFFF;
  --paper-2:    #F4F9F8;   /* white with a hint of green */
  --line:       #E3E9E8;
  --line-dark:  #C9D5D3;
  --signal:     #49C2AB;   /* house green */
  --signal-dk:  #2E9C87;   /* darker green, for text and hover on white */
  --signal-lt:  #EAF8F5;

  /* Typography */
  --font: "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;

  /* Sizing */
  --wide:  1140px;   /* max content width */
  --prose: 68ch;     /* max reading width */
  --r:     4px;      /* border radius — deliberately small */
}
```

**Poppins** is loaded from Google Fonts, weights 400/500/600/700, with `display=swap` and
`preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`. Keep the preconnects; they
are a measurable LCP win.

`theme-color` meta is `#49C2AB`.

## Breakpoints

All `max-width`, mobile-last. Do not consolidate them — each was tuned to a specific
component's failure point.

| Breakpoint | Governs |
|---|---|
| `1000px` | Hero layout |
| `920px`  | Navigation → burger menu |
| `820px`  | Split layouts (contact/scan forms) |
| `760px`  | General section padding |
| `620px`  | Typography scale, stacked cards |
| `(hover: none)` | Touch devices — logo hover colour behaviour |
| `(prefers-reduced-motion: reduce)` | **Must be kept.** Disables transitions. |
| `print` | Print stylesheet — keep it |

## Component inventory

Every block below is a function in `build.py`. Read that function for the exact markup,
then build the Svelte equivalent. Line numbers are current as of this handover.

| Svelte component | `build.py` | Used by | Notes |
|---|---|---|---|
| `ServicesGrid` | `blok_diensten:95` | home | 10 services, short form, with "all services" button |
| `ServicesGrouped` | `blok_diensten_volledig:105` | `/diensten` | Same 10, grouped into 4 themes: Strategie en merk / Online zichtbaar / Content en contact / Nieuw |
| `Testimonials` | `blok_citaten:118` | home | Renders nothing if the list is empty |
| `Steps` | `blok_stappen:130` | home | 4 fixed steps, hardcoded in `build.py` |
| `SectorList` | `blok_sectoren:135` | home | From `sectoren_lijst` front matter |
| `LogoWall` | `blok_logos:157` | `/referenties` | All 53, greyscale, colour on hover |
| `LogoStrip` | `blok_logostrook:166` | home | Subset strip |
| `PackageCards` | `blok_pakketten:175` | `/prijzen` | `uitgelicht: true` gets the highlighted treatment |
| `ProjectPrices` | `blok_projecten:189` | `/prijzen` | Linked price rows |
| `PriceTable` | `blok_prijstabel:197` | 10 service pages | From `prijzen` front matter |
| `Faq` | `blok_faq:205` | 13 pages | **Also emits `FAQPage` JSON-LD** — see `06` |
| `ContactForm` | `blok_formulier:214` | `/contact`, `/gratis-marketingscan` | Two variants; fields listed below |
| `BookingEmbed` | `blok_agenda:250` | `/afspraak` | Google Calendar appointment iframe |
| `BlogIndex` | `blok_blogindex:257` | `/blog` | **Must be server-rendered, not client-side.** The old site's JS-rendered blog index was uncrawlable — that was an explicit audit finding. |
| `CaseList` | `blok_cases:266` | (unused today) | Data shape exists; no page populates it |
| `ScanCta` | `blok_scan:273` | home, services, region pages | Free-marketing-scan call to action |
| `PageHead` | `pagehead:394` | all non-home pages | Breadcrumb + H1 + lead |
| `TodoNotice` | `todo:401` | 13 pages | Renders `af_te_werken` **visibly to visitors**. See Q4 in `02`. |

### Shared chrome

- **Topbar** — tagline left, phone + email right
- **Nav** — logo, 6 links, CTA button ("Maak een afspraak"). Order is deliberate:
  `Over Niels · Diensten · Referenties · Prijzen · Blog · Contact`.
  "Over Niels" comes first because the person is the product.
- **Footer** — white logo, navigation, socials, legal strip
- **Skip link** — `<a class="skip" href="#main">Naar de inhoud</a>`. Keep it.

### The mobile menu — port this carefully

Current implementation is 3 lines of inline JS: the button toggles `.open` on `#nav` and
mirrors it to `aria-expanded`. The visual effect comes entirely from CSS
(`assets/style.css:86` — `.nav.open ul { display: flex }`).

In Svelte this becomes a `$state` boolean bound to both the class and `aria-expanded`.
**Keep `aria-expanded` and `aria-controls` correct** — they are there for screen readers,
not decoration.

## Accessibility — already correct today, keep it

- Skip link to `#main`
- `aria-label` on nav and on the logo link
- Every image has a real `alt` (except the 22 logos still named "Klant" — a content bug,
  not a markup bug)
- All form inputs have associated `<label>` elements
- `prefers-reduced-motion` respected

## Form fields — reproduce exactly

**Contact form** (`formulier: "contact"`): Naam\*, Bedrijf, E-mail\* (email), Telefoon (tel),
Waarover gaat het? (select), message textarea.

**Scan form** (`formulier: "scan"`): Naam\*, Bedrijf\*, Website\* (url, placeholder `https://`),
Gemeente\*, E-mail\* (email), Telefoon (tel, marked optional), "Waar loop je vooral op vast?"
(textarea), newsletter checkbox. Submit label: *"Vraag je scan aan"*.

\* = `required`
