/**
 * Close a build record that never reported back.
 *
 * Only two things move a build out of 'building': tools/mark-build-live.mjs at
 * the end of a successful build, and /api/publish when the deploy hook itself
 * refuses. A build that Vercel starts and then fails writes nothing — so the row
 * stays 'building', the dashboard banner spins, and the Publish button stays
 * disabled. On 20 September 2026 a prerender error left the CMS wedged that way
 * for twenty hours.
 *
 * $lib/server/dashboard.ts now settles these automatically after ten minutes.
 * This is the same repair, runnable against an environment whose deployment does
 * not have that code yet, or where someone wants to clear it by hand.
 *
 *   node tools/unstick-build.mjs            # report only
 *   node tools/unstick-build.mjs --write    # close the overdue rows
 *
 * Reads PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment,
 * falling back to .env. Real environment variables win.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/** Keep in step with BUILD_DEADLINE_MS in src/lib/server/dashboard.ts. */
const DEADLINE_MS = 10 * 60 * 1000;
const DETAIL =
	'De bouwopdracht heeft niets meer teruggemeld. Waarschijnlijk is het opbouwen ' +
	'bij de hosting mislukt.';

const env = { ...process.env };
try {
	for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
		const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
	}
} catch {
	/* .env is optional. */
}

if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
	console.error('Set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or provide a .env).');
	process.exit(1);
}

const write = process.argv.includes('--write');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false }
});

const { data: stuck, error } = await db
	.from('builds')
	.select('*')
	.eq('status', 'building')
	.order('triggered_at', { ascending: false });
if (error) throw new Error(error.message);

const overdue = stuck.filter((b) => Date.now() - Date.parse(b.triggered_at) > DEADLINE_MS);

console.log(`${stuck.length} build(s) still marked 'building'; ${overdue.length} past the deadline.`);
for (const b of stuck) {
	const mins = Math.round((Date.now() - Date.parse(b.triggered_at)) / 60000);
	console.log(`  ${b.triggered_at}  ${mins} min ago${overdue.includes(b) ? '  <- overdue' : ''}`);
}

/* No process.exit past this point: the Supabase client keeps a handle open, and
   tearing the process down under it aborts with a libuv assertion on Windows. */
if (!overdue.length) {
	console.log('\nNothing to do.');
} else if (!write) {
	console.log('\nRun again with --write to close these as failed.');
} else {
	for (const b of overdue) {
		const finished = new Date(Date.parse(b.triggered_at) + DEADLINE_MS).toISOString();
		const { error: updateError } = await db
			.from('builds')
			.update({ status: 'failed', finished_at: finished, detail: DETAIL })
			.eq('id', b.id);
		if (updateError) throw new Error(updateError.message);
		console.log(`closed ${b.id} (triggered ${b.triggered_at}) -> failed`);
	}
	console.log('\nDone. The CMS will offer the Publish button again.');
}
