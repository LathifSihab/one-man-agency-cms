# 07 — Custom CMS Spec

A SvelteKit admin application at `/admin`, for **one user** (D5). Built as part of this
project (D2).

## Non-negotiable framing

Niels is a marketer, not a developer. He is replacing a Git-based CMS specifically to get
something simpler. If editing a page requires understanding Markdown, slugs, JSON or
schema, the CMS has failed regardless of how clean the code is.

Design rule: **the editor never sees an implementation detail he cannot act on.**

## Auth

- Email + password, Supabase Auth. Public sign-up disabled.
- `/admin/*` guarded in `hooks.server.ts`; unauthenticated requests redirect to `/admin/login`.
- Sessions in httpOnly cookies via `@supabase/ssr`.
- Password reset by email. There is exactly one account, so a lockout is a real outage.
- The admin app is **not prerendered** — `export const prerender = false` on `/admin`.

## Screens

### `/admin` — dashboard
- Publish status: whether the live site is in sync, or has unpublished changes
- **Publish button** (see below)
- Last build: time and result
- **Outstanding items list**, driven by real data, not a hardcoded checklist:
  - logos still named `"Klant"` (currently 22)
  - pages with a `todo_note` (currently 13)
  - testimonials still containing placeholder text
  - `formspree_id` still unset
- Recent edits

### `/admin/pages` — page families
- Grouped by type: Pages (15), Services (10), Sectors (4), Regions (6)
- Editor form:
  - Title, intro — plain text
  - **SEO title** with a **live character counter, red past 62**
  - **Meta description** with a counter, red past 158
  - Body — Markdown editor with a formatting toolbar and live preview.
    Do not require raw Markdown syntax knowledge.
  - **Shortcode insertion as buttons**, not typed tokens. Present them by name
    ("Insert: services grid"), render them in the preview as a labelled placeholder block.
  - Repeating fields (FAQ, prices, packages, figures, testimonials) as
    **add / remove / reorder row editors**. Never a raw JSON textarea.
- Slug is editable but warns loudly: changing it breaks the live URL and existing links.

### `/admin/blog`
- List sorted by date descending, with published/draft state visible at a glance
- Same editor, plus: date picker, category select (fixed list from `04`), cover image,
  published toggle
- `legacy_url` in an "Advanced" section with an explanation: *"Redirects an old site URL to
  this post. Do not change unless you know why."*

### `/admin/logos`
- Grid of all 53, **the 22 named "Klant" surfaced first with a warning badge** — this is a
  real SEO defect and the CMS should make it obvious
- Inline rename, drag to reorder, upload, delete

### `/admin/settings`
- Company details, navigation, header CTA, Formspree ID, socials
- **Warning on this screen:** these values appear in the structured data on all 41 pages.
- Navigation items: add / remove / reorder

### `/admin/media` (depends on Q2)
- Upload, browse, delete, copy path. Show dimensions and file size.

## Publishing — the part to get right

With static prerendering, a save does not change the live site. Only a rebuild does. This
is the single biggest usability risk in the whole design, because the client's mental model
will be "I saved it, so it's live."

Requirements:

1. Saving writes to Supabase immediately and is **never** called "publishing".
2. A persistent banner states: *"X changes not yet on the live site."*
3. **One explicit Publish button** triggers the deploy hook (`09-DEPLOYMENT.md`).
4. Build state is shown honestly: building / live / failed, with the completion time.
   Poll the host's deploy API or record the webhook result.
5. On failure, say so plainly and keep the changes pending. Never show a green state you
   have not verified.
6. Preview before publishing, ideally via the host's preview deployment.

Expect roughly a minute from Publish to live. Say so in the UI rather than leaving the
client guessing.

## Validation — enforce in the CMS, not only in the database

- `seo_title` ≤ 62, `meta_description` ≤ 158 (these mirror the DB `check` constraints)
- Required: title, seo_title, meta_description, intro
- Slug: lowercase, `a-z0-9-`, unique within its type
- Warn on unknown `{{tokens}}` in a body
- Warn when a shortcode's backing data is empty (e.g. `{{citaten}}` with no testimonials
  renders nothing — silently, today)

## Explicitly out of scope

Multi-user, roles, comments, workflow/approvals, scheduled publishing, revision history
with rollback. If you believe one is essential, ask before building it.
