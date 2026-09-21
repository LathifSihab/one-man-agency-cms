import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Dashboard state: what still needs attention, and whether the live site is in
 * sync with the database.
 *
 * Every item here is derived from real data. A hardcoded checklist would go
 * stale the moment Niels fixed something.
 */

export interface Outstanding {
	key: string;
	label: string;
	count: number;
	href: string;
	detail: string;
}

/** One edited item waiting to be published. */
export interface PendingChange {
	kind: string;
	label: string;
	href: string | null;
	updatedAt: string;
}

export interface PublishState {
	/**
	 * 'stale' is the one worth explaining: the build finished, but the site
	 * visitors get is still the previous one. That happens when a deployment
	 * succeeds without becoming the production deployment, and it used to be
	 * reported as success — the editor published, saw green, and nothing changed.
	 */
	status: 'live' | 'pending' | 'building' | 'failed' | 'stale' | 'unknown';
	/** When the copy of the site visitors actually get was built. */
	liveBuiltAt: string | null;
	pendingChanges: number;
	/** What actually changed, newest first, so the editor can see it before publishing. */
	pending: PendingChange[];
	lastEditedAt: string | null;
	lastBuild: {
		status: string;
		triggered_at: string;
		finished_at: string | null;
		detail: string | null;
	} | null;
}

/** Placeholder testimonial text carried over from the reference content. */
const PLACEHOLDER_NAMES = ['Voornaam Naam'];

/**
 * After this long, a build that still says 'building' is treated as failed.
 *
 * Only two things ever move a build out of 'building': tools/mark-build-live.mjs
 * at the end of a successful build, and /api/publish when the deploy hook itself
 * refuses. A build that Vercel starts and then fails writes nothing at all — so
 * the row stayed 'building' forever, the banner span forever, and the Publish
 * button stayed disabled. On 20 September a prerender error left the CMS stuck
 * like that for twenty hours with no way out from inside the CMS.
 *
 * Deploys here take about thirty seconds and the banner already calls sixty
 * "longer than usual", so ten minutes is far past anything legitimate.
 */
const BUILD_DEADLINE_MS = 10 * 60 * 1000;

const TIMED_OUT_DETAIL =
	'De bouwopdracht heeft niets meer teruggemeld. Waarschijnlijk is het opbouwen ' +
	'bij de hosting mislukt.';

function timedOut(build: { status: string; triggered_at: string } | null): boolean {
	if (!build || build.status !== 'building') return false;
	return Date.now() - Date.parse(build.triggered_at) > BUILD_DEADLINE_MS;
}

export async function getOutstanding(db: SupabaseClient): Promise<Outstanding[]> {
	const [logos, pages, settings] = await Promise.all([
		db.from('logos').select('id, name'),
		db.from('pages').select('id, slug, type, todo_note, testimonials'),
		db.from('settings').select('formspree_id').maybeSingle()
	]);

	const items: Outstanding[] = [];

	const unnamed = (logos.data ?? []).filter((l) => l.name === 'Klant').length;
	if (unnamed) {
		items.push({
			key: 'logos',
			label: 'Logo’s zonder klantnaam',
			count: unnamed,
			href: '/admin/logos',
			detail:
				'Deze logo’s hebben geen echte naam. De alt-tekst blijft daardoor leeg voor Google.'
		});
	}

	const todos = (pages.data ?? []).filter((p) => p.todo_note);
	if (todos.length) {
		items.push({
			key: 'todo',
			label: 'Pagina’s met een openstaande notitie',
			count: todos.length,
			href: '/admin/pages',
			detail: 'Deze notitie staat zichtbaar op de live pagina, voor bezoekers.'
		});
	}

	const placeholders = (pages.data ?? []).flatMap((p) =>
		((p.testimonials as { naam?: string }[] | null) ?? []).filter((t) =>
			PLACEHOLDER_NAMES.includes((t.naam ?? '').trim())
		)
	);
	if (placeholders.length) {
		items.push({
			key: 'testimonials',
			label: 'Citaten met een voorbeeldnaam',
			count: placeholders.length,
			href: '/admin/pages',
			detail: 'Deze citaten staan nog op "Voornaam Naam" en zijn zichtbaar op de startpagina.'
		});
	}

	return items;
}

/**
 * The newest change in the media bucket.
 *
 * Images are content too: replacing one changes the published site, but it
 * touches no table, so without this the dashboard reported everything up to
 * date and never offered to publish. Replacing an image then looked like
 * nothing had happened at all.
 */
async function newestMediaChange(
	db: SupabaseClient
): Promise<{ at: string | null; files: { key: string; at: string }[] }> {
	const folders = await Promise.all(
		['site', 'logos', 'blog'].map(async (prefix) => {
			const { data } = await db.storage.from('media').list(prefix, { limit: 500 });
			return (data ?? [])
				.filter((f) => f.id)
				.map((f) => ({
					key: `${prefix}/${f.name}`,
					at: f.updated_at ?? f.created_at ?? ''
				}))
				.filter((f) => f.at);
		})
	);

	const files = folders.flat();
	const at = files.length ? files.map((f) => f.at).sort().at(-1)! : null;
	return { at, files };
}

export async function getPublishState(db: SupabaseClient): Promise<PublishState> {
	const [pages, posts, logos, settings, build, media, liveBuiltAt] = await Promise.all([
		db.from('pages').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('posts').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('logos').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('settings').select('updated_at').maybeSingle(),
		// More than one, so a failed build can still be measured against the last
		// one that actually reached the live site.
		db.from('builds').select('*').order('triggered_at', { ascending: false }).limit(20),
		newestMediaChange(db),
		liveBuildStamp()
	]);

	const stamps = [
		pages.data?.[0]?.updated_at,
		posts.data?.[0]?.updated_at,
		logos.data?.[0]?.updated_at,
		settings.data?.updated_at,
		media.at
	].filter(Boolean) as string[];

	const lastEditedAt = stamps.length ? stamps.sort().at(-1)! : null;
	const builds = build.data ?? [];
	let lastBuild = builds[0] ?? null;

	// Close off a build that never reported back, so the record matches what the
	// editor is told and one failed deploy cannot wedge the CMS.
	if (timedOut(lastBuild)) {
		lastBuild = {
			...lastBuild,
			status: 'failed',
			finished_at: new Date(Date.parse(lastBuild.triggered_at) + BUILD_DEADLINE_MS).toISOString(),
			detail: TIMED_OUT_DETAIL
		};
		await db
			.from('builds')
			.update({
				status: lastBuild.status,
				finished_at: lastBuild.finished_at,
				detail: lastBuild.detail
			})
			.eq('id', builds[0].id);
	}

	let status: PublishState['status'] = 'unknown';
	if (!lastBuild) {
		status = lastEditedAt ? 'pending' : 'unknown';
	} else if (lastBuild.status === 'building') {
		status = 'building';
	} else if (lastBuild.status === 'failed') {
		status = 'failed';
	} else if (lastEditedAt && lastBuild.finished_at && lastEditedAt > lastBuild.finished_at) {
		status = 'pending';
	} else if (lastBuild.status === 'live') {
		/*
		 * The build finished — but did the site change? A deployment can succeed
		 * without becoming the one production serves, and reporting that as
		 * success is the failure this whole flow exists to avoid.
		 */
		const served = liveBuiltAt ? Date.parse(liveBuiltAt) : NaN;
		const triggered = Date.parse(lastBuild.triggered_at);
		status = Number.isNaN(served) || served >= triggered ? 'live' : 'stale';
	}

	// List what changed since the last successful build. A bare count does not
	// tell the editor what they are about to put live.
	let pending: PendingChange[] = [];
	if (status === 'pending' || status === 'failed') {
		// Measured from the last build that actually went live, not from the last
		// build attempted. A failed build published nothing, so everything edited
		// before it is still waiting too — dating from the failure itself hid
		// exactly the changes the editor was trying to publish.
		const since = builds.find((b) => b.status === 'live' && b.finished_at)?.finished_at ?? '1970-01-01';
		pending = await getPendingChanges(db, since);

		for (const file of media.files.filter((f) => f.at > since)) {
			pending.push({
				kind: 'Afbeelding',
				label: file.key.split('/').pop() ?? file.key,
				href: '/admin/media',
				updatedAt: file.at
			});
		}
		pending.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
	}

	return { status, pendingChanges: pending.length, pending, lastEditedAt, lastBuild, liveBuiltAt };
}

const PAGE_KIND: Record<string, string> = {
	page: 'Pagina',
	service: 'Dienst',
	sector: 'Sector',
	region: 'Regio'
};

export async function getPendingChanges(
	db: SupabaseClient,
	since: string
): Promise<PendingChange[]> {
	const [pages, posts, logos, settings] = await Promise.all([
		db.from('pages').select('type, slug, title, updated_at').gt('updated_at', since),
		db.from('posts').select('slug, title, updated_at').gt('updated_at', since),
		db.from('logos').select('name, updated_at').gt('updated_at', since),
		db.from('settings').select('updated_at').gt('updated_at', since).maybeSingle()
	]);

	const items: PendingChange[] = [
		...(pages.data ?? []).map((p) => ({
			kind: PAGE_KIND[p.type] ?? 'Pagina',
			label: p.title,
			href: `/admin/pages/${p.type}/${p.slug}`,
			updatedAt: p.updated_at
		})),
		...(posts.data ?? []).map((p) => ({
			kind: 'Blog',
			label: p.title,
			href: `/admin/blog/${p.slug}`,
			updatedAt: p.updated_at
		})),
		...(logos.data ?? []).map((l) => ({
			kind: 'Logo',
			label: l.name === 'Klant' ? 'Logo zonder naam' : l.name,
			href: '/admin/logos',
			updatedAt: l.updated_at
		})),
		...(settings.data
			? [
					{
						kind: 'Instellingen',
						label: 'Bedrijfsgegevens, navigatie of socials',
						href: '/admin/settings',
						updatedAt: settings.data.updated_at
					}
				]
			: [])
	];

	return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

// ── visitor statistics ───────────────────────────────────────────────────────

export interface Analytics {
	available: boolean;
	days: number;
	daily: { day: string; views: number; entries: number }[];
	totalViews: number;
	totalEntries: number;
	previousViews: number;
	topPaths: { path: string; views: number }[];
	topReferrers: { referrer_host: string; views: number }[];
	devices: { device: string; views: number }[];
	countries: { country: string; views: number }[];
}

/**
 * When the site visitors are served was built.
 *
 * Fetched from the live address rather than from this process: the admin runs
 * inside a deployment that may not be the one production points at, so asking
 * ourselves would answer the wrong question.
 */
async function liveBuildStamp(): Promise<string | null> {
	const base =
		env.VERCEL_PROJECT_PRODUCTION_URL
			? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
			: (env.ADMIN_URL ?? publicEnv.PUBLIC_SITE_URL ?? '');

	if (!base) return null;

	try {
		const response = await fetch(`${base.replace(/\/$/, '')}/build-info.json`, {
			headers: { 'cache-control': 'no-cache' },
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) return null;
		const body = await response.json();
		return typeof body?.builtAt === 'string' ? body.builtAt : null;
	} catch {
		// The site being unreachable is not a reason to break the dashboard.
		return null;
	}
}

const EMPTY: Analytics = {
	available: false,
	days: 30,
	daily: [],
	totalViews: 0,
	totalEntries: 0,
	previousViews: 0,
	topPaths: [],
	topReferrers: [],
	devices: [],
	countries: []
};

/**
 * Visitor numbers for the dashboard.
 *
 * Counting happens in the database: a busy month is tens of thousands of rows
 * and the dashboard only ever shows totals. If the analytics migration has not
 * been applied the RPCs are missing, and the dashboard says so rather than
 * failing — the rest of it is more important than a chart.
 */
export async function getAnalytics(db: SupabaseClient, days = 30): Promise<Analytics> {
	const [daily, paths, referrers, breakdown, previous] = await Promise.all([
		db.rpc('analytics_daily', { days }),
		db.rpc('analytics_top_paths', { days, lim: 10 }),
		db.rpc('analytics_top_referrers', { days, lim: 8 }),
		db.rpc('analytics_breakdown', { days }),
		// The window before this one, for the trend.
		db.rpc('analytics_daily', { days: days * 2 })
	]);

	if (daily.error) return { ...EMPTY, days };

	const rows = (daily.data ?? []) as Analytics['daily'];
	const earlier = ((previous.data ?? []) as Analytics['daily']).slice(0, days);

	const sum = (list: { views: number }[]) => list.reduce((n, r) => n + Number(r.views), 0);

	const tally = new Map<string, number>();
	const byCountry = new Map<string, number>();
	for (const row of (breakdown.data ?? []) as { device: string; country: string; views: number }[]) {
		if (row.device) tally.set(row.device, (tally.get(row.device) ?? 0) + Number(row.views));
		if (row.country) byCountry.set(row.country, (byCountry.get(row.country) ?? 0) + Number(row.views));
	}

	const rank = (m: Map<string, number>, key: 'device' | 'country') =>
		[...m.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([name, views]) => ({ [key]: name, views }) as never);

	return {
		available: true,
		days,
		daily: rows.map((r) => ({ ...r, views: Number(r.views), entries: Number(r.entries) })),
		totalViews: sum(rows),
		totalEntries: rows.reduce((n, r) => n + Number(r.entries), 0),
		previousViews: sum(earlier),
		topPaths: ((paths.data ?? []) as Analytics['topPaths']).map((r) => ({
			...r,
			views: Number(r.views)
		})),
		topReferrers: ((referrers.data ?? []) as Analytics['topReferrers']).map((r) => ({
			...r,
			views: Number(r.views)
		})),
		devices: rank(tally, 'device'),
		countries: rank(byCountry, 'country').slice(0, 6)
	};
}
