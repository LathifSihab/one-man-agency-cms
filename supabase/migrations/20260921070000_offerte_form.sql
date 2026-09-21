-- Add an 'offerte' form variant.
--
-- The `prijzen` page became `offerte` on 20 September 2026: a quote request
-- rather than a price list. It was given the contact form, which collects the
-- right fields but is headed "Stuur je vraag door" — contact wording on a page
-- that asks for a quote. This adds a variant of its own so the copy can match,
-- and so quote requests can be told apart from general questions in Berichten.
--
-- Both checks are dropped by name first: they were created inline, so Postgres
-- named them <table>_<column>_check. `if exists` keeps this re-runnable.

alter table pages drop constraint if exists pages_form_variant_check;
alter table pages
  add constraint pages_form_variant_check
  check (form_variant in ('contact', 'scan', 'offerte'));

alter table submissions drop constraint if exists submissions_variant_check;
alter table submissions
  add constraint submissions_variant_check
  check (variant in ('contact', 'scan', 'offerte'));
