-- One Man Agency — database schema
-- Derived from handover/05-SUPABASE-SCHEMA.md, with the resolved open questions:
--   Q1 forms  -> stored in Supabase (submissions table below)
--   Q2 images -> Supabase Storage, baked into the static output at build time
--
-- Apply with:  supabase db push   (or paste into the SQL editor)

-- ─────────────────────────────────────────────────────────── extensions
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────── updated_at
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────── page families
do $$ begin
  create type page_type as enum ('page', 'service', 'sector', 'region');
exception when duplicate_object then null;
end $$;

create table if not exists pages (
  id                uuid primary key default gen_random_uuid(),
  type              page_type   not null,
  slug              text        not null,
  title             text        not null,                              -- titel
  seo_title         text        not null check (char_length(seo_title) <= 62),
  meta_description  text        not null check (char_length(meta_description) <= 158),
  intro             text        not null,
  body              text        not null default '',                   -- Markdown, may contain {{tokens}}
  noindex           boolean     not null default false,
  todo_note         text,                                              -- af_te_werken
  sort_order        integer     not null default 0,

  -- Services navigation, edited in the CMS. The list used to be a hardcoded
  -- array in src/lib/site.ts, so only a developer could add a service.
  in_services       boolean     not null default false,                -- shown under Diensten
  menu_label        text,                                              -- short name for menus
  menu_summary      text,                                              -- one line under it
  menu_group        text,                                              -- heading it sits under
  menu_order        integer,                                           -- position in that list

  -- type-specific, nullable
  faq               jsonb,      -- [{vraag, antwoord}]
  prices            jsonb,      -- [{wat, vanaf}]                       services
  packages          jsonb,      -- [{naam, voor_wie, prijs, periode, uitgelicht, inbegrepen[]}]
  projects          jsonb,      -- [{wat, vanaf, link}]
  figures           jsonb,      -- [{getal, label}]                     home
  testimonials      jsonb,      -- [{tekst, naam, functie}]             home
  sector_list       jsonb,      -- [text]                               home
  form_variant      text check (form_variant in ('contact', 'scan', 'offerte')),
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

create index if not exists pages_type_sort_idx on pages (type, sort_order);

drop trigger if exists pages_updated_at on pages;
create trigger pages_updated_at before update on pages
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────── blog
create table if not exists posts (
  id                uuid primary key default gen_random_uuid(),
  slug              text        not null unique,
  title             text        not null,
  seo_title         text        not null check (char_length(seo_title) <= 62),
  meta_description  text        not null check (char_length(meta_description) <= 158),
  intro             text        not null,
  body              text        not null default '',
  published_on      date        not null,                              -- datum
  category          text,                                              -- categorie
  image_url         text,
  is_published      boolean     not null default true,                 -- gepubliceerd
  legacy_url        text,                                              -- oude_url -> 301. Do not drop.
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists posts_published_on_idx on posts (published_on desc);

drop trigger if exists posts_updated_at on posts;
create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────── logos
create table if not exists logos (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null default 'Klant',    -- becomes the image alt text
  file_path   text    not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists logos_sort_idx on logos (sort_order);

drop trigger if exists logos_updated_at on logos;
create trigger logos_updated_at before update on logos
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────── settings (singleton)
create table if not exists settings (
  id           boolean primary key default true check (id),  -- enforces exactly one row
  company      jsonb not null,   -- naam, juridisch, straat, postcode, stad, btw,
                                 -- telefoon, telefoon_link, email, slogan
  navigation   jsonb not null,   -- [{label, link}]
  header_cta   jsonb not null,   -- {label, link}
  formspree_id text,             -- retained: legacy fallback, unused now forms post to Supabase
  socials      jsonb not null,   -- [{naam, url}]
  updated_at   timestamptz not null default now()
);

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────── form submissions (Q1)
create table if not exists submissions (
  id         uuid primary key default gen_random_uuid(),
  variant    text not null check (variant in ('contact', 'scan', 'offerte')),
  payload    jsonb not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists submissions_created_idx on submissions (created_at desc);

-- ─────────────────────────────────────────────────────────── publish state
-- Backs the CMS "X changes not yet on the live site" banner and the honest
-- build-state reporting required by handover/07-CMS-SPEC.md.
create table if not exists builds (
  id           uuid primary key default gen_random_uuid(),
  status       text not null check (status in ('pending', 'building', 'live', 'failed')),
  triggered_at timestamptz not null default now(),
  finished_at  timestamptz,
  detail       text,
  -- The deployment this build produced, so "is the live site what I just
  -- built?" can be answered by identity instead of by comparing clocks.
  deployment_id text
);

create index if not exists builds_triggered_idx on builds (triggered_at desc);

-- ─────────────────────────────────────────────────────────── RLS
-- The public site is prerendered at build time and the build reads with the
-- service role key, server-side. The anon role therefore needs no read access
-- at runtime and is deliberately granted no policy.
alter table pages       enable row level security;
alter table posts       enable row level security;
alter table logos       enable row level security;
alter table settings    enable row level security;
alter table submissions enable row level security;
alter table builds      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pages', 'posts', 'logos', 'settings', 'submissions', 'builds']
  loop
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end $$;

-- Note: submissions are inserted by a server route using the service role key,
-- which bypasses RLS. No anon insert policy is created on purpose — an open
-- insert policy would let anyone write rows directly from a browser.

-- ─────────────────────────────────────────────────────────── storage (Q2)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select to public using (bucket_id = 'media');

drop policy if exists "authenticated write media" on storage.objects;
create policy "authenticated write media" on storage.objects
  for all to authenticated
  using (bucket_id = 'media') with check (bucket_id = 'media');
