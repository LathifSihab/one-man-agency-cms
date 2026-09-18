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

## Search Console and SEO (added after the first delivery)

**Ownership is in place.** The Search Console HTML token lives at
`static/google1943806656245000.html` and is served from the site root. Verify the
property in Search Console as a URL prefix on `https://www.onemanagency.be/`
using the HTML file method, then submit `/sitemap.xml` under *Sitemaps*. The file
must never be deleted: removing it un-verifies the property.

Note the ordering. Verification reads the live domain, and the domain still
points at the old Hostinger site, so this can only succeed against the Vercel
deployment URL or after the cutover.

**On the site.** Every page already carried a title, a description, a canonical
and the JSON-LD graph. Added: preview directives (`max-image-preview:large`,
without which Google shows a thumbnail instead of a card), a per-page social
image with the twitter set, `og:type=article` with publication and modification
dates on posts, BreadcrumbList on every page below the root, WebSite and WebPage
nodes, a richer BlogPosting (image, modification date, category, word count,
tied to the Blog), a Blog node on `/blog` listing its posts, `Disallow: /admin`
in robots.txt, and a real `lastmod` per URL in the sitemap instead of the build
date on all 41.

**In the CMS.** Under the blog editor and the page editor there is now a
**Vindbaarheid** panel: the Google result as it will actually render, truncation
and all, plus a checklist that updates while typing — title and description
length, whether the subject of the SEO title comes back in the text, the
description and a subheading, word count, internal links, intro, image, URL.
Nothing there can block a save; the 62/158 limits are still the hard ones.

The dashboard runs the same rules over every page and post and shows the average
with the weakest items, each linking to the editor that fixes it. Today that
average is 76/100 — the recurring complaints are page length and SEO titles whose
subject never returns in the body. That is real, pre-existing content work, now
visible instead of invisible.

## Flagged by Google as phishing, and what was done about it

Search Console reported a security issue on
`one-man-agency-impact-5d90.vercel.app`: *Phishing Kemungkinan Terdeteksi pada
Login Pengguna*. Nothing was hacked. The CMS login is a branded credential form
on a generic `*.vercel.app` subdomain, which is exactly what a phishing kit
looks like to an automated classifier — and because `onemanagency.be` still
points at Hostinger, there is no legitimate domain tying that branding to that
host.

The `Disallow: /admin` added earlier does not address this: robots.txt governs
indexing, and Safe Browsing scans regardless.

Fixed by putting an HTTP Basic gate in front of `/admin`
(`src/lib/server/gate.ts`, wired into `hooks.server.ts` before anything else).
An anonymous request now gets a 25-byte plain-text 401 — no company name, no
logo, no input fields. Verified on both production aliases. The public site, the
sitemap, robots.txt and the Search Console token file are untouched.

Niels needs the gate credentials as well as his CMS login: one browser prompt,
which the browser then remembers. They live in the Vercel project's environment
variables, not in the repository.

Next step, once this is live: **Request review** in Search Console. Reviews take
a few days. After the domain cutover the gate can stay or go — on the real
domain the phishing signal largely disappears, but the gate costs nothing.

## Defect fixed after delivery: deleting skipped its own confirmation

While testing the SEO work, the blog post *Lokale SEO, AI-tools en de
Google-update* was deleted without anything asking first. It was restored from
`supabase/seed.json` — every field matched what the live build had rendered
minutes earlier, so no content was lost.

The cause: the confirmation dialog was an `onsubmit` handler on a hydrated
component, while the admin renders server-side first. Any submit that landed
before hydration went straight through to `?/delete`. The same hole existed for
logos, images and messages.

Fixed in `src/lib/server/confirm.ts`: answering the dialog attaches a field, and
every destructive action now refuses without it. A delete that does not go
through the question is rejected with an explanation and nothing is removed.
`tools/confirm-guard-e2e.mjs` proves it, on a throwaway draft it creates itself.

One caveat worth stating plainly: `tools/admin-e2e.mjs` and the new guard test
act on whatever database they are pointed at, and the e2e suite's delete step
targets the newest real post. Point them at a throwaway project.

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
  browser session. The JSON-LD is structurally verified (every blob parses, the
  type counts are asserted) but not validated by Google.
- Search Console verification itself has not been performed: it needs the live
  domain and the Google account. The token file is in place and served.

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
src/lib/seo.ts             the SEO rules, shared by both editors and the dashboard
src/lib/server/seo-health.ts  those rules over every page and post at once
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
