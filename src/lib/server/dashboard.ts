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

export interface PublishState {
	status: 'live' | 'pending' | 'building' | 'failed' | 'unknown';
	pendingChanges: number;
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

export async function getPublishState(db: SupabaseClient): Promise<PublishState> {
	const [pages, posts, logos, settings, build] = await Promise.all([
		db.from('pages').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('posts').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('logos').select('updated_at').order('updated_at', { ascending: false }).limit(1),
		db.from('settings').select('updated_at').maybeSingle(),
		db
			.from('builds')
			.select('*')
			.order('triggered_at', { ascending: false })
			.limit(1)
			.maybeSingle()
	]);

	const stamps = [
		pages.data?.[0]?.updated_at,
		posts.data?.[0]?.updated_at,
		logos.data?.[0]?.updated_at,
		settings.data?.updated_at
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

	// Count the rows edited since the last successful build.
	let pendingChanges = 0;
	if (status === 'pending' || status === 'failed') {
		const since = lastBuild?.finished_at ?? '1970-01-01';
		const counts = await Promise.all([
			db.from('pages').select('id', { count: 'exact', head: true }).gt('updated_at', since),
			db.from('posts').select('id', { count: 'exact', head: true }).gt('updated_at', since),
			db.from('logos').select('id', { count: 'exact', head: true }).gt('updated_at', since)
		]);
		pendingChanges = counts.reduce((n, c) => n + (c.count ?? 0), 0);
	}

	return { status, pendingChanges, lastEditedAt, lastBuild };
}
