/**
 * Proof that one failed deploy cannot wedge the CMS.
 *
 * A build row only leaves 'building' when tools/mark-build-live.mjs finishes a
 * successful build, or when /api/publish is turned away by the deploy hook. A
 * build that Vercel starts and then fails writes nothing, so the row used to
 * stay 'building' forever: the banner span, the Publish button stayed disabled,
 * and there was no way out from inside the CMS. On 20 September 2026 that left
 * the site unpublishable for twenty hours after a prerender error.
 *
 * getPublishState now settles a silent build as failed after ten minutes, and
 * counts pending changes from the last build that actually went live. This
 * checks both, against a stand-in database.
 *
 *   npm run test:publish-state
 *
 * Loaded through the project's own Vite config so $lib and $env resolve as they
 * do in the app.
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { getPublishState } = await server.ssrLoadModule('/src/lib/server/dashboard.ts');

const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

/**
 * A stand-in for the Supabase client: every builder method returns the builder,
 * and awaiting it hands the recorded query to the fixture.
 */
function fakeDb({ builds, pages = [], posts = [], logos = [], settings = null }) {
	const updates = [];

	const from = (table) => {
		const q = { table, op: 'select' };
		const b = {
			select: () => b,
			order: () => b,
			limit: () => b,
			eq: (_c, v) => ((q.eq = v), b),
			gt: (_c, v) => ((q.gt = v), b),
			maybeSingle: () => ((q.single = true), b),
			single: () => ((q.single = true), b),
			update: (payload) => ((q.op = 'update'), (q.payload = payload), b),
			then: (resolve, reject) => Promise.resolve(run(q)).then(resolve, reject)
		};
		return b;
	};

	const run = (q) => {
		if (q.op === 'update') {
			updates.push({ table: q.table, id: q.eq, payload: q.payload });
			return { data: null, error: null };
		}
		// A `gt` means getPendingChanges is asking what changed since a stamp.
		const rows = { builds, pages, posts, logos }[q.table] ?? [];
		if (q.table === 'settings') {
			const s = settings && (!q.gt || settings.updated_at > q.gt) ? settings : null;
			return { data: s, error: null };
		}
		const filtered = q.gt ? rows.filter((r) => r.updated_at && r.updated_at > q.gt) : rows;
		return { data: q.single ? (filtered[0] ?? null) : filtered, error: null };
	};

	return {
		from,
		updates,
		storage: { from: () => ({ list: async () => ({ data: [] }) }) }
	};
}

let failures = 0;
const check = (name, got, want) => {
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
	if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

// ── 1. The wedge: a build that never reported back ──────────────────────────
{
	const db = fakeDb({
		builds: [
			{ id: 'b2', status: 'building', triggered_at: minutesAgo(1232), finished_at: null, detail: null },
			{ id: 'b1', status: 'live', triggered_at: minutesAgo(1263), finished_at: minutesAgo(1262), detail: 'ok' }
		],
		pages: [{ type: 'page', slug: 'offerte', title: 'Offerte', updated_at: minutesAgo(1240) }]
	});
	const state = await getPublishState(db);
	check('a silent build is reported as failed', state.status, 'failed');
	check('and the record is closed', db.updates.map((u) => [u.table, u.id, u.payload.status]), [
		['builds', 'b2', 'failed']
	]);
	check('with a reason the editor can read', typeof state.lastBuild.detail === 'string' && state.lastBuild.detail.length > 20, true);
	check(
		'edits made before the failure are still listed as pending',
		state.pending.map((p) => p.label),
		['Offerte']
	);
}

// ── 2. A build that is genuinely still running must be left alone ───────────
{
	const db = fakeDb({
		builds: [{ id: 'b3', status: 'building', triggered_at: minutesAgo(1), finished_at: null, detail: null }]
	});
	const state = await getPublishState(db);
	check('a fresh build still reads as building', state.status, 'building');
	check('and is not closed early', db.updates.length, 0);
}

// ── 3. Just under and just over the ten-minute deadline ─────────────────────
{
	const near = fakeDb({
		builds: [{ id: 'b4', status: 'building', triggered_at: minutesAgo(9), finished_at: null, detail: null }]
	});
	check('nine minutes is still building', (await getPublishState(near)).status, 'building');

	const past = fakeDb({
		builds: [{ id: 'b5', status: 'building', triggered_at: minutesAgo(11), finished_at: null, detail: null }]
	});
	check('eleven minutes is failed', (await getPublishState(past)).status, 'failed');
}

// ── 4. Pending is measured from the last live build, not the last attempt ───
{
	const db = fakeDb({
		builds: [
			{ id: 'c3', status: 'failed', triggered_at: minutesAgo(30), finished_at: minutesAgo(29), detail: 'stuk' },
			{ id: 'c1', status: 'live', triggered_at: minutesAgo(120), finished_at: minutesAgo(119), detail: 'ok' }
		],
		pages: [
			// Edited before the failed build: published nowhere, so still pending.
			{ type: 'page', slug: 'cookiebeleid', title: 'Cookiebeleid', updated_at: minutesAgo(60) },
			// Edited after it.
			{ type: 'page', slug: 'contact', title: 'Contact', updated_at: minutesAgo(10) }
		]
	});
	const state = await getPublishState(db);
	check(
		'both sides of a failed build are pending',
		state.pending.map((p) => p.label).sort(),
		['Contact', 'Cookiebeleid']
	);
	check('and are counted', state.pendingChanges, 2);
}

await server.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
