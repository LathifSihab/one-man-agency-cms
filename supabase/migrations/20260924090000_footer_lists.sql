-- Let the footer's Sectoren and Regio columns be edited in the CMS.
--
-- Both columns were written into Chrome.svelte, so the client could rename a
-- sector page but not the footer link pointing at it. The link check then
-- refused every publish ("verwijzen naar een pagina die niet meer bestaat …
-- in het menu") with nothing in the CMS that could fix it. Stored beside
-- `navigation`, in the same {label, link} shape, and edited the same way.
--
-- Filled once, when the column is added: sectors from the sector pages as they
-- stand (their titles without the "Marketing voor" every one of them starts
-- with), regions from the six links the footer carried until now.

alter table settings add column if not exists footer_sectors jsonb;
alter table settings add column if not exists footer_regions jsonb;

update settings set footer_sectors = coalesce((
  select jsonb_agg(
           jsonb_build_object(
             'label', upper(left(t.label, 1)) || substr(t.label, 2),
             'link', '/sectoren/' || t.slug
           ) order by t.sort_order)
  from (
    select slug, sort_order, regexp_replace(title, '^Marketing voor\s+', '', 'i') as label
    from pages
    where type = 'sector' and is_published
  ) t
), '[]'::jsonb)
where footer_sectors is null;

update settings set footer_regions = '[
  {"label": "Dendermonde", "link": "/regio/marketingbureau-dendermonde"},
  {"label": "Lebbeke", "link": "/regio/marketingbureau-lebbeke"},
  {"label": "Aalst", "link": "/regio/marketingbureau-aalst"},
  {"label": "Sint-Niklaas", "link": "/regio/marketingbureau-sint-niklaas"},
  {"label": "Wetteren", "link": "/regio/marketingbureau-wetteren"},
  {"label": "Zele", "link": "/regio/marketingbureau-zele"}
]'::jsonb
where footer_regions is null;

alter table settings alter column footer_sectors set default '[]'::jsonb;
alter table settings alter column footer_sectors set not null;
alter table settings alter column footer_regions set default '[]'::jsonb;
alter table settings alter column footer_regions set not null;

comment on column settings.footer_sectors is
  'The footer''s Sectoren column: [{label, link}], in display order.';
comment on column settings.footer_regions is
  'The footer''s Regio column: [{label, link}], in display order.';
