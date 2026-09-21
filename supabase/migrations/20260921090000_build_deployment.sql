-- Record which deployment a build produced.
--
-- Whether the live site is the thing you just built was decided by comparing
-- timestamps: the live site's build-info.json stamp against the build row's
-- triggered_at. That works for a build started from the Publish button, whose
-- row is written before the build begins, but not for one started by a git
-- push: tools/mark-build-live.mjs writes that row at the END of the build, so
-- its triggered_at is always a few seconds LATER than the stamp baked in
-- during prerendering. The comparison then failed for a perfectly good
-- deployment and the CMS reported, permanently, that the site had not been
-- made live.
--
-- Vercel already answers the question exactly. build-info.json carries the
-- deployment id, so the build can record the one it produced and the two can be
-- compared for identity rather than raced on the clock.
--
-- Nullable on purpose: rows written before this, and any build running outside
-- Vercel, have no id, and the dashboard falls back to the timestamp check.

alter table builds add column if not exists deployment_id text;

comment on column builds.deployment_id is
  'VERCEL_DEPLOYMENT_ID of the deployment this build produced; null when unknown.';
