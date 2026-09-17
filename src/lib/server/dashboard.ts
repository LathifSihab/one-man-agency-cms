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
	status: 'live' | 'pending' | 'building' | 'failed' | 'unknown';
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
	const [pages, posts, logos, settings, build, media] = await Promise.all([
		db.from('pages').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('posts').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('logos').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('settings').select('updated_at').maybeSingle(),
		db
			.from('builds')
			.select('*')
			.order('triggered_at', { ascending: false })
			.limit(1)
			.maybeSingle(),
		newestMediaChange(db)
	]);

	const stamps = [
		pages.data?.[0]?.updated_at,
		posts.data?.[0]?.updated_at,
		logos.data?.[0]?.updated_at,
		settings.data?.updated_at,
		media.at
	].filter(Boolean) as string[];

	const lastEditedAt = stamps.length ? stamps.sort().at(-1)! : null;
	const lastBuild = build.data ?? null;

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
		status = 'live';
	}

	// List what changed since the last successful build. A bare count does not
	// tell the editor what they are about to put live.
	let pending: PendingChange[] = [];
	if (status === 'pending' || status === 'failed') {
		const since = lastBuild?.finished_at ?? '1970-01-01';
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

	return { status, pendingChanges: pending.length, pending, lastEditedAt, lastBuild };
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
