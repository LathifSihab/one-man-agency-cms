import { fail, redirect } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data } = await adminDb()
		.from('pages')
		.select('type, slug, title, todo_note, updated_at, noindex, in_services')
		.order('type')
		.order('sort_order');

	return { pages: data ?? [] };
};

const TYPES = ['page', 'service', 'sector', 'region'] as const;

/**
 * Where each kind of page lives, for the "this will be its address" preview.
 * Mirrors pagePath() in $lib/site.
 */
const PREFIX: Record<string, string> = {
	page: '',
	service: '/diensten',
	sector: '/sectoren',
	region: '/regio'
};

export const actions: Actions = {
	/**
	 * Add a page.
	 *
	 * There was no way to do this at all: pages could be edited but never
	 * created, so every new service meant a database row written by hand and a
	 * code change to the menu. The columns that cannot be empty are seeded with
	 * something honest and short rather than left blank, because the database
	 * rejects empty ones and a half-made page is worse than a plain one.
	 */
	create: async ({ request }) => {
		const form = await request.formData();
		const type = String(form.get('type') ?? '');
		const title = String(form.get('title') ?? '').trim();
		const slug = String(form.get('slug') ?? '')
			.trim()
			.toLowerCase();

		if (!TYPES.includes(type as (typeof TYPES)[number])) {
			return fail(400, { message: 'Kies eerst een soort pagina.' });
		}
		if (!title) return fail(400, { message: 'Geef de pagina een titel.' });
		if (!/^[a-z0-9-]+$/.test(slug)) {
			return fail(400, {
				message: 'Een webadres mag enkel kleine letters, cijfers en koppeltekens bevatten.'
			});
		}

		const db = adminDb();

		const { data: clash } = await db
			.from('pages')
			.select('id')
			.eq('type', type)
			.eq('slug', slug)
			.maybeSingle();
		if (clash) {
			return fail(400, { message: `Er bestaat al een pagina op ${PREFIX[type]}/${slug}.` });
		}

		// New pages go last within their kind.
		const { data: last } = await db
			.from('pages')
			.select('sort_order')
			.eq('type', type)
			.order('sort_order', { ascending: false })
			.limit(1)
			.maybeSingle();

		const { data: lastMenu } = await db
			.from('pages')
			.select('menu_order')
			.not('menu_order', 'is', null)
			.order('menu_order', { ascending: false })
			.limit(1)
			.maybeSingle();

		const isService = type === 'service';

		const { error: dbError } = await db.from('pages').insert({
			type,
			slug,
			title,
			// Kept inside the database's length limits, and obviously provisional.
			seo_title: title.slice(0, 62),
			meta_description: `${title}.`.slice(0, 158),
			intro: '',
			body: '',
			sort_order: (last?.sort_order ?? -1) + 1,
			// A new service belongs in the list by default; anything else does not.
			in_services: isService,
			menu_label: isService ? title.slice(0, 40) : null,
			menu_group: isService ? 'Nieuw' : null,
			menu_order: isService ? (lastMenu?.menu_order ?? -1) + 1 : null,
			// Out of Google until it has been written.
			noindex: true,
			todo_note: 'Deze pagina is net aangemaakt en moet nog ingevuld worden.'
		});

		if (dbError) return fail(500, { message: `Aanmaken mislukt: ${dbError.message}` });

		throw redirect(303, `/admin/pages/${type}/${slug}`);
	}
};
