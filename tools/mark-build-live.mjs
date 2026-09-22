/**
 * Close out the build record once a build has finished.
 *
 * Clicking Publish inserts a `builds` row with status 'building'. Nothing else
 * would ever close it, so the CMS banner would spin forever. This runs at the
 * end of a successful build — inside the build that Publish triggered — and
 * marks any open rows as live.
 *
 * Honest about what it proves: the build completed and read Supabase. It does
 * not prove the deploy was served. If a deploy fails after a successful build,
 * Cloudflare keeps the previous version and the banner will have said "live" a
 * little early. A deployment webhook would close that gap; this is the useful
 * 90% without extra infrastructure.
 *
 * Skipped silently when Supabase is not configured (the seed-file build path).
 */
import { createClient } from '@supabase/supabase-js';

// Only a real deployment publishes anything. A local `npm run build` with
// credentials in the shell must never tell the CMS the site went live.
if (!process.env.WORKERS_CI) {
	console.log('[builds] Not a Workers Builds run — leaving build records untouched.');
	process.exit(0);
}

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
	console.log('[builds] Supabase not configured — leaving build records untouched.');
	process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const finishedAt = new Date().toISOString();

/*
 * Which deployment this build produced. The CMS compares it against the id the
 * live site reports, so "is the site serving what I just built?" is answered by
 * identity rather than by racing two clocks — which it used to lose, because
 * this file runs at the end of a build and build-info.json is stamped during
 * prerendering, several seconds earlier.
 */
const deploymentId = process.env.WORKERS_CI_BUILD_UUID ?? null;

const { data, error } = await db
	.from('builds')
	.update({
		status: 'live',
		finished_at: finishedAt,
		deployment_id: deploymentId,
		detail: 'Build voltooid en gepubliceerd.'
	})
	.eq('status', 'building')
	.select('id');

if (error) {
	// Never fail the build over bookkeeping: the site itself is fine.
	console.warn(`[builds] Could not update build records: ${error.message}`);
	process.exit(0);
}

if (data?.length) {
	console.log(`[builds] Marked ${data.length} build record(s) live.`);
} else {
	// A build from a git push rather than the Publish button. Nobody is waiting
	// on it in the CMS, and its triggered_at is necessarily the moment this runs
	// — the end of the build — so it must not be compared against a stamp taken
	// earlier in the same build. deployment_id is what makes that safe.
	await db.from('builds').insert({
		status: 'live',
		triggered_at: finishedAt,
		finished_at: finishedAt,
		deployment_id: deploymentId,
		detail: 'Build zonder publicatieknop (rechtstreeks vanuit de code).'
	});
	console.log('[builds] Recorded a build that was not started from the CMS.');
}
