# 05 — Supabase Schema, Auth and Storage

A proposed schema, derived field-by-field from `04-CONTENT-MODEL.md`. Adjust naming or
normalisation if you have a better structure, but the **fields and constraints must cover
everything in `04`** — nothing may be dropped.

## Design notes

- **One `pages` table with a `type` discriminator**, not five near-identical tables. The
  four page families (`paginas`, `diensten`, `sectoren`, `regio`) share 5 of their fields;
  splitting them would mean four copies of every query. Blog posts get their own table —
  they have genuinely different fields and their own sort order.
- **Repeating structures as `jsonb`** (`faq`, `prijzen`, `pakketten`, `cijfers`, `citaten`).
  They are always read as a whole with their parent and never queried across rows.
  Child tables would add joins for no benefit at this scale.
- **Ordering is explicit** via `sort_order`. Never rely on insertion order.

## Tables

```sql
-- ── Page families ────────────────────────────────────────────────────────────
create type page_type as enum ('page', 'service', 'sector', 'region');

create table pages (
  id                uuid primary key default gen_random_uuid(),
  type              page_type   not null,
  slug              text        not null,
  title             text        not null,               -- titel
  seo_title         text        not null check (char_length(seo_title) <= 62),
  meta_description  text        not null check (char_length(meta_description) <= 158),
  intro             text        not null,
  body              text        not null default '',    -- Markdown, may contain {{tokens}}
  noindex           boolean     not null default false,
  todo_note         text,                               -- af_te_werken
  sort_order        integer     not null default 0,
  -- type-specific, nullable
  faq               jsonb,      -- [{vraag, antwoord}]
  prices            jsonb,      -- [{wat, vanaf}]           services
  packages          jsonb,      -- [{naam, voor_wie, prijs, periode, uitgelicht, inbegrepen[]}]
  projects          jsonb,      -- [{wat, vanaf, link}]
  figures           jsonb,      -- [{getal, label}]         home
  testimonials      jsonb,      -- [{tekst, naam, functie}] home
  sector_list       jsonb,      -- [text]                   home
  form_variant      text check (form_variant in ('contact','scan')),
  booking_url       text,
  portrait_url      text,
  portrait_alt      text,
  header_image_url  text,
  header_alt        text,
  cta_primary       jsonb,      -- {label, link}
  cta_secondary     jsonb,      -- {label, link}
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (type, slug)
);

-- ── Blog ─────────────────────────────────────────────────────────────────────
create table posts (
  id                uuid primary key default gen_random_uuid(),
  slug              text        not null unique,
  title             text        not null,
  seo_title         text        not null check (char_length(seo_title) <= 62),
  meta_description  text        not null check (char_length(meta_description) <= 158),
  intro             text        not null,
  body              text        not null default '',
  published_on      date        not null,               -- datum
  category          text,                               -- categorie
  image_url         text,
  is_published      boolean     not null default true,  -- gepubliceerd
  legacy_url        text,                               -- oude_url -> 301. Do not drop.
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on posts (published_on desc);

-- ── Logos ────────────────────────────────────────────────────────────────────
create table logos (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null default 'Klant',   -- becomes alt text
  file_path   text    not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Settings (singleton) ─────────────────────────────────────────────────────
create table settings (
  id           boolean primary key default true check (id),  -- enforces one row
  company      jsonb not null,   -- naam, juridisch, straat, postcode, stad, btw,
                                 -- telefoon, telefoon_link, email, slogan
  navigation   jsonb not null,   -- [{label, link}]
  header_cta   jsonb not null,   -- {label, link}
  formspree_id text,
  socials      jsonb not null,   -- [{naam, url}]
  updated_at   timestamptz not null default now()
);
```

`updated_at` should be maintained by a standard `moment_updated_at` trigger on all four tables.

### If Q1 resolves to "forms in Supabase"

```sql
create table submissions (
  id         uuid primary key default gen_random_uuid(),
  variant    text not null check (variant in ('contact','scan')),
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
```
Insert via an **edge function or server route**, never with the anon key from the browser,
and rate-limit it. Do not expose this table to the anon role.

## Auth — single user (D5)

- Supabase Auth, **email + password**. No social providers.
- **Disable public sign-up** in the Supabase dashboard. Create Niels's account manually.
  An open sign-up endpoint on a single-user CMS is the obvious way in.
- No roles table and no `is_admin` column: any authenticated user *is* the admin. If a
  second user is ever added this must be revisited (see D5).
- Session handling via `@supabase/ssr` with httpOnly cookies. Do not persist sessions in
  `localStorage` in the admin app.

## RLS — enable on every table

Because the public site is **prerendered at build time**, the anon role does not need read
access at runtime. The build reads with the service role key, server-side.

```sql
alter table pages      enable row level security;
alter table posts      enable row level security;
alter table logos      enable row level security;
alter table settings   enable row level security;

-- Authenticated user (Niels) has full control via the CMS.
create policy "authenticated full access" on pages
  for all to authenticated using (true) with check (true);
-- repeat for posts, logos, settings
```

**Grant no policy to `anon`.** If you later add client-side reads, add narrow read-only
policies then — not pre-emptively.

The **service role key** is used only by the build process and only server-side. It must
never appear in client bundles, in `PUBLIC_*` env vars, or in the repository.

## Storage (depends on Q2)

If images move to Supabase Storage:

- Bucket `media`, **public read** (images are on a public marketing site), authenticated write.
- Suggested prefixes: `logos/`, `site/`, `blog/`.
- Keep the existing filenames — they are already referenced in content.
- At build time, prerendering can download images to the static output, which keeps the
  published site free of any runtime dependency on Supabase. Recommended.

If images stay in the repo, `logos.file_path` and the `*_url` columns hold repo-relative
paths such as `/assets/logos/<file>.png`, and no bucket is needed.
