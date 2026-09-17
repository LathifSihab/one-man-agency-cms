-- Visitor statistics for the CMS dashboard.
--
-- Deliberately anonymous. No cookies, no browser storage, no identifiers, and
-- the visitor's IP address is never written down — it is read from the request
-- to derive a coarse country and then discarded. Nothing here can be tied back
-- to a person, which is why the site needs no consent banner for it under GDPR
-- and ePrivacy. The cost of that choice is honest: there is no "unique
-- visitors" figure, because measuring one means identifying someone.

create table if not exists page_views (
  id             bigint generated always as identity primary key,
  path           text not null,
  -- Host only ("google.com"), never the full referring URL, which can carry
  -- search terms and other personal detail.
  referrer_host  text,
  device         text check (device in ('mobile', 'tablet', 'desktop')),
  country        text,
  -- An entry is a view that did not come from this site: a visit starting.
  is_entry       boolean not null default false,
  viewed_on      date not null default (now() at time zone 'utc')::date,
  created_at     timestamptz not null default now()
);

create index if not exists page_views_viewed_on_idx on page_views (viewed_on desc);
create index if not exists page_views_path_idx on page_views (path);

alter table page_views enable row level security;

-- Written by the tracking route with the service role, read by the dashboard.
-- The anon role gets no policy: nobody can read the statistics or forge rows.
drop policy if exists "authenticated full access" on page_views;
create policy "authenticated full access" on page_views
  for all to authenticated using (true) with check (true);

-- ── aggregates ───────────────────────────────────────────────────────────────
-- Counting in the database rather than shipping rows to the dashboard: a busy
-- month is tens of thousands of views, and the dashboard only ever needs totals.

create or replace function analytics_daily(days integer default 30)
returns table (day date, views bigint, entries bigint)
language sql
stable
as $$
  select
    d::date as day,
    count(v.id) as views,
    count(v.id) filter (where v.is_entry) as entries
  from generate_series(
         (now() at time zone 'utc')::date - (days - 1),
         (now() at time zone 'utc')::date,
         interval '1 day'
       ) as d
  left join page_views v on v.viewed_on = d::date
  group by d
  order by d;
$$;

create or replace function analytics_top_paths(days integer default 30, lim integer default 10)
returns table (path text, views bigint)
language sql
stable
as $$
  select path, count(*) as views
  from page_views
  where viewed_on > (now() at time zone 'utc')::date - days
  group by path
  order by views desc, path
  limit lim;
$$;

create or replace function analytics_top_referrers(days integer default 30, lim integer default 8)
returns table (referrer_host text, views bigint)
language sql
stable
as $$
  select referrer_host, count(*) as views
  from page_views
  where viewed_on > (now() at time zone 'utc')::date - days
    and referrer_host is not null
  group by referrer_host
  order by views desc, referrer_host
  limit lim;
$$;

create or replace function analytics_breakdown(days integer default 30)
returns table (device text, country text, views bigint)
language sql
stable
as $$
  select device, country, count(*) as views
  from page_views
  where viewed_on > (now() at time zone 'utc')::date - days
  group by device, country;
$$;
