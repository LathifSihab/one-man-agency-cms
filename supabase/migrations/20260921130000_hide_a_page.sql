-- Let a page be taken off the site without being destroyed.
--
-- Pages could be created but not removed, and deleting was the obvious thing to
-- add next. It is also the wrong thing: the site is prerendered, so a page that
-- is linked from anywhere takes the whole build with it, and a delete cannot be
-- undone by the person who made the mistake. Hiding is reversible, and is
-- already how the blog works — posts have is_published and the public build
-- filters them out.
--
-- A hidden page is not built at all: no file, so its address returns the 404
-- page. It is not merely noindex, which leaves the page reachable.
--
-- The home page is the site root and cannot be hidden. That is enforced here as
-- well as in the CMS, because a constraint cannot be forgotten.

alter table pages add column if not exists is_published boolean not null default true;

alter table pages drop constraint if exists pages_home_always_published;
alter table pages
  add constraint pages_home_always_published
  check (is_published or type <> 'page' or slug <> 'home');

comment on column pages.is_published is
  'False keeps the page out of the build entirely; its address then 404s.';
