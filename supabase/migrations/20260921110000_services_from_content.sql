-- Let the services list come from the content instead of from the code.
--
-- The ten services were a hardcoded array in src/lib/site.ts, and the overview
-- grouped them by slicing that array at fixed positions. Adding a service meant
-- a database row AND a code change in two places AND a deploy, so the person who
-- writes the content could not add one. These columns move that list into the
-- pages table, where they can edit it.
--
--   in_services   whether the page appears in the services navigation. An
--                 explicit flag rather than "type = service", so a page can be
--                 listed there without moving — which is what the free marketing
--                 scan needed — and a service can be taken out of the list
--                 without being deleted.
--   menu_label    the short name. Pages carry a full heading ("Website laten
--                 maken") that is too long for a menu ("Webdesign").
--   menu_summary  the one-line description under it in the overview.
--   menu_group    the heading it sits under. Free text: a new heading is a new
--                 group, which is how a category gets created now.
--   menu_order    position in that navigation. Not sort_order, which orders the
--                 whole page list and is alphabetical for services today —
--                 reusing it would have reordered the site.

alter table pages add column if not exists in_services  boolean not null default false;
alter table pages add column if not exists menu_label   text;
alter table pages add column if not exists menu_summary text;
alter table pages add column if not exists menu_group   text;
alter table pages add column if not exists menu_order   integer;

-- The ten services, carried over exactly as SERVICES and SERVICE_GROUPS had
-- them, so the live site does not move when this takes effect.
update pages set in_services = true, menu_order = v.ord, menu_label = v.label,
                 menu_summary = v.summary, menu_group = v.grp
from (values
  ('marketingstrategie',               0, 'Marketingstrategie',    'Weten waar je naartoe gaat, voor je geld uitgeeft.',            'Strategie en merk'),
  ('branding-en-huisstijl',            1, 'Branding & huisstijl',  'Een merk dat blijft hangen, van logo tot toon.',                'Strategie en merk'),
  ('webdesign',                        2, 'Webdesign',             'Een website die vragen beantwoordt en klanten oplevert.',       'Online zichtbaar'),
  ('seo-en-geo',                       3, 'SEO & GEO',             'Gevonden worden in Google én in AI-antwoorden.',                'Online zichtbaar'),
  ('google-ads',                       4, 'Google Ads',            'Bovenaan staan op het moment dat iemand koopklaar zoekt.',      'Online zichtbaar'),
  ('social-media',                     5, 'Social media',          'Een contentkalender die doorloopt, ook als jij het druk hebt.', 'Content en contact'),
  ('e-mailmarketing',                  6, 'E-mailmarketing',       'Je bestaande klanten zijn je goedkoopste omzet.',               'Content en contact'),
  ('grafische-vormgeving-en-drukwerk', 7, 'Vormgeving & drukwerk', 'Van visitekaartje tot gevelreclame.',                           'Content en contact'),
  ('foto-en-video',                    8, 'Foto & video',          'Echte beelden van jouw zaak, geen stockfoto''s.',               'Content en contact'),
  ('ai-voor-kmo',                      9, 'AI voor KMO''s',        'Tijd winnen op administratie, offertes en klantcommunicatie.',  'Nieuw')
) as v(slug, ord, label, summary, grp)
where pages.type = 'service' and pages.slug = v.slug;

-- The free marketing scan joins the list without moving: it keeps its own
-- address, which is linked from the site and indexed, and simply appears among
-- the services. Its own heading, because it is an offer rather than a service.
update pages
   set in_services  = true,
       menu_order   = 10,
       menu_label   = 'Gratis marketingscan',
       menu_summary = 'Waar laat je nu omzet liggen? Ik kijk het na en zeg het je.',
       menu_group   = 'Gratis kennismaking'
 where type = 'page' and slug = 'gratis-marketingscan';
