# Delivery report — One Man Agency

**Written for: the developer who maintains this next.** For how to run and deploy
it, see [README.md](README.md). This document covers what was done, why, what was
decided along the way, and what is still open.

---

## What was asked for

Port a finished 42-page Dutch marketing site from a Python static-site generator
to SvelteKit + TypeScript + Supabase, with a custom CMS, without losing any of
the search and AI visibility the site exists for.

## What was delivered

| | |
|---|---|
| Public site | 41 indexable routes + a `noindex` 404, fully prerendered, no runtime database access |
| CMS | `/admin` — pages, services, sectors, regions, blog, logos, media, form submissions, settings, publishing |
| Database | Supabase: 6 tables, RLS on every one, no `anon` policy |
| Content | 35 pages, 7 posts, 53 logos, 1 settings row — migrated and verified |
| Hosting | Vercel, one serverless function, static HTML on the CDN |
| Statistics | Cookieless visitor numbers on the dashboard |

---

## The part worth knowing about first

**The content source did not exist.** The handover named `content/`, `preview/`,
`scripts/` and `docs/` as the specification. Only `dist/` (the rendered output)
and `handover/` were delivered; `build.py` arrived separately.

So `content/` — 42 Markdown files, `settings.yml`, `logos.yml` — was
**reconstructed from the rendered HTML** by [tools/extract.py](tools/extract.py).

That is not asserted, it is proven. Feeding the reconstruction back through the
original `build.py` reproduces **all 113 files byte-for-byte**, including every
page's JSON-LD, `sitemap.xml`, `robots.txt`, `llms.txt` and `_redirects`:

```bash
python tools/extract.py    # dist-original/ -> content/
python build.py            # the original generator, on the reconstruction
python tools/verify.py     # byte-compare against dist-original/
```

Two facts in the handover the data contradicts: there are **6** posts with an
`oude_url`, not 7 (10 static + 6 post rules = the 16 redirects), and **42**
Markdown files, not 44 — any unpublished drafts left no trace in the rendered
output and are unrecoverable.

`dist-original/` is the immutable reference. Do not edit it.

---

## How "nothing broke" is proven

Three harnesses, all runnable:

| Command | What it establishes |
|---|---|
| `npm run parity` | The rendered site still matches the original, page by page |
| `npm run verify` | The acceptance criteria in `handover/10-ACCEPTANCE.md` |
| `npm run responsive` | Every page at six viewports in a real browser |
| `npm run e2e:admin` | The CMS driven in a real browser |

`tools/parity.py` compares, for all 42 pages: the head SEO set, the JSON-LD graph
as parsed objects, every heading, every link, every image and the visible text of
`<main>`. Whitespace and attribute order are ignored, as the handover allows.

**Parity is a migration-time gate, not a permanent test.** It proved the port
changed nothing. Once the client edits content it correctly reports those edits
as differences. Read it as "what has changed since the original build".

`tools/verify.py` currently passes 30/30: 41 indexable routes, sitemap priorities,
the AI-crawler allowances, 16 redirects, and the JSON-LD counts (`Service` on 20
pages, `FAQPage` on 13, `BlogPosting` on 7).

---

## Decisions

### The five open questions

| | Question | Resolution |
|---|---|---|
| Q1 | Contact forms | Supabase. `/api/submit` writes with the service role; submissions appear under **Berichten** |
| Q2 | Images | Supabase Storage, baked into the static output at build time |
| Q3 | Host | Vercel |
| Q4 | `af_te_werken` notices | Still rendered visibly, as before, and editable. **Worth confirming with the client** |
| Q5 | `_headers` | Not written. CSP, HSTS and cache-control are decisions, not defaults to guess. **Still open** |

### Departures from the handover, and why

- **`adapter-vercel`, not `adapter-static`.** The handover assumed Cloudflare
  Pages. Every public route is still prerendered; only `/admin` and `/api` run as
  functions, which `adapter-static` cannot host.
- **Redirects injected at build time** rather than a Cloudflare `_redirects` file,
  which Vercel ignores. A `_redirects` file is still written as a portable record.
  A new post with a `legacy_url` is covered automatically.
- **The mobile nav stays inline JavaScript.** The handover suggested a `$state`
  boolean, which needs hydration; shipping the Svelte runtime for one button
  would break the performance budget the same document sets.
- **Two new `noindex` pages**, `/bedankt` and `/formulier-fout`. Moving forms off
  Formspree needs somewhere to land. Both are excluded from the sitemap, so the
  indexable count is unchanged. **Their Dutch copy is new and should be reviewed.**
- **Visual enhancements** (`static/assets/enhance.css`) were added at the client's
  request: hero motion, a decorative backdrop, hover cues. Deliberately a separate
  file — `assets/style.css` is the delivered design system and stays verifiable.

---

## Defects found and fixed

Several were inherited from the reference build rather than introduced here.

**Missing page gutter (inherited).** `build.py` closed the prose wrapper before
emitting a shortcode block, so `{{blogindex}}`, `{{pakketten}}`, `{{projecten}}`,
`{{faq}}` and `{{agenda}}` landed outside any `.wrap` — the element that supplies
the page margin. Text ran into the right edge on `/blog`, `/prijzen`,
`/veelgestelde-vragen` and `/afspraak`. `verify.py` now fails if anything sits
outside a `.wrap`, and that check fails against `dist-original`, which is how the
diagnosis was confirmed.

**A dead nav script.** Svelte's SSR wraps component output in empty HTML comment
markers. Inside a `<script>` those are not comments — JavaScript reads `<!--` as a
line comment and swallowed the first line, so the mobile menu threw on every
page. The script moved to `app.html`, outside the component tree.

**A skipped delete confirmation.** Putting delete in the editor form with
`formaction` and choosing in `onsubmit` which question to ask does not work:
`use:enhance` handles the submit first, so the first click deleted a post with no
confirmation. Both buttons now sit outside the forms, bound with the `form`
attribute.

**A collapsed panel erasing data.** Saving a post with "Geavanceerd" closed set
`legacy_url` to null, because the input is not in the DOM when the panel is shut.
That silently destroys a 301 redirect — the one field the handover singles out as
must-not-drop. Saves now only write fields the form actually submitted.

**The media library was an orphan.** It wrote to Storage while every image field
stored a repository path the site rendered directly. Nothing read Storage, so an
uploaded logo never appeared. Three separate gaps, all closed: `src/lib/images.ts`
resolves the two kinds of value, `tools/fetch-media.mjs` bakes referenced objects
into the output, and `tools/apply-media-overrides.mjs` lets a replaced image
override the copy that ships with the repo.

**Media changes were invisible to publishing.** Replacing an image changes the
published site but touches no table, so the dashboard reported everything up to
date and never offered to publish. Storage timestamps now feed the publish state.

**A view-level sort corrupting data.** The logo screen grouped unnamed logos first
for visibility, then wrote that display order back as `sort_order` — opening the
screen and pressing Save silently reshuffled the live logo wall. The grouping is
now a view only.

---

## Statistics

Anonymous by construction: no cookies, no browser storage, no identifier. The
beacon sends a path and a referrer; device, country and whether the view begins a
visit are derived server-side. The IP is read to derive a country and discarded.
Only the referring host is kept, never the full URL, which can carry search terms.

Public-site JavaScript is now **1.1KB total, inline, with no external request** —
the nav toggle (579 bytes) and the beacon (515 bytes).

The trade is stated on the panel rather than hidden: **there is no unique-visitors
figure**, because producing one means identifying people, and the site would then
need a consent banner. Views, visits, top pages, referrers, devices and countries
are aggregated in Postgres.

Obvious crawlers and `/admin` paths are never counted.

---

## Delivering access

```bash
python tools/send_invite.py --check                          # can mail be delivered?
python tools/send_invite.py --email niels@onemanagency.be    # send a set-password link
```

It emails a **one-time link**, never a password. A credential mailed in plain text
stays in an inbox, gets forwarded, and is the only way into a single-account CMS.

**Before relying on it:** Supabase's built-in SMTP only delivers to addresses on
the project team. Sending to a client address needs custom SMTP under
*Authentication → Emails*. Without it the invite is accepted and never arrives —
`--check` reports which of the two you have.

---

## Still open

**Blocking the cutover**

- `www.onemanagency.be` still points at the old Hostinger site. Attaching the
  domain is the irreversible step and should be last.
- Custom SMTP is not configured, so invite and reset mail will not reach the
  client's address yet.
- **Two accounts exist** (`lathif@test.be` and `lathif.sihab-dewantoro@…`). The
  CMS is designed for one (decision D5). Neither is Niels. Use
  `tools/seed_account.py --delete` once his account exists.

**Not verified**

- Google's Rich Results Test and Lighthouse have not been run — both need a
  browser session. The JSON-LD is structurally verified but not validated by
  Google.

**Client decisions**

- Q4 (the visible "nog aan te vullen" notices on 13 pages) and Q5 (`_headers`).
- The Dutch copy on `/bedankt` and `/formulier-fout` is new and unreviewed.

**Content gaps carried over deliberately** — surfaced on the CMS dashboard, not
invented away: logos still named "Klant", 13 pages with a visible unfinished
note, three placeholder testimonials attributed to "Voornaam Naam", and a business
address that conflicted between sources in the original material.

---

## Repository map

```
src/lib/images.ts          repo path vs Storage key — the only place that knows
src/lib/markdown.ts        Markdown -> HTML, matched to the original renderer
src/lib/schema.ts          JSON-LD; the @id cross-references are the point
src/lib/shortcodes.ts      {{tokens}} in page bodies
src/routes/(public)/       prerendered, no client JavaScript beyond 1.1KB inline
src/routes/admin/          the CMS; never prerendered, requires login
tools/extract.py           dist-original/ -> content/   (how content was recovered)
tools/migrate.py           content/ -> Supabase          (idempotent, self-verifying)
tools/parity.py            the no-regression gate
tools/verify.py            the acceptance criteria
tools/responsive.mjs       every page, six viewports, real browser
tools/admin-e2e.mjs        the CMS, real browser
tools/seed_account.py      create or reset the single account
tools/send_invite.py       email access as a one-time link
dist-original/             the original build. Immutable reference
```
