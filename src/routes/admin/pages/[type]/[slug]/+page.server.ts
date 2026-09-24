import { error, fail, redirect } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { requireConfirmation } from '$lib/server/confirm';
import { linksBlockingDelete, linksTo, readContentForCheck, withoutMenuLinks } from '$lib/server/links';
import { MENU_FOR, addToMenu } from '$lib/server/menus';
import { readPagePatch } from '$lib/server/pageForm';
import { pagePath } from '$lib/site';
import type { Page } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const TYPES = new Set(['page', 'service', 'sector', 'region']);

/**
 * Pages the site cannot do without. The home page is the site's own address and
 * the 404 page is what every missing address renders; neither is linked from
 * anywhere, so the link check below would let them go.
 */
const UNDELETABLE = new Set(['page/home', 'page/404']);

export const load: PageServerLoad = async ({ params }) => {
	if (!TYPES.has(params.type)) throw error(404, 'Onbekende soort pagina');

	const { data, error: dbError } = await adminDb()
		.from('pages')
		.select('*')
		.eq('type', params.type)
		.eq('slug', params.slug)
		.maybeSingle();

	if (dbError) throw error(500, dbError.message);
	if (!data) throw error(404, 'Pagina niet gevonden');

	// The headings already in use, offered as suggestions so a typo does not
	// silently create a second group that looks the same.
	const { data: grouped } = await adminDb()
		.from('pages')
		.select('menu_group')
		.not('menu_group', 'is', null);
	const groups = [...new Set((grouped ?? []).map((g) => g.menu_group).filter(Boolean))].sort();

	// Where the page can be reached from, so a page nobody can find says so.
	const content = await readContentForCheck(adminDb());
	const linkedFrom = linksTo(content, data as Page);
	const path = pagePath(data as Page);
	const menuOptions = Object.entries(MENU_FOR[data.type as Page['type']] ?? {})
		.filter(([, list]) => !(content.settings[list] ?? []).some((item) => item.link === path))
		.map(([placement, list]) => ({
			placement,
			label:
				list === 'navigation'
					? 'Zet in het hoofdmenu'
					: `Zet in de voettekst, kolom ${list === 'footer_sectors' ? 'Sectoren' : 'Regio'}`
		}));

	return { page: data, groups, linkedFrom, menuOptions };
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const form = await request.formData();
		const read = readPagePatch(form);
		if ('message' in read) return fail(400, read);
		const patch = read.patch;

		// The site root cannot be taken off the site. The database refuses it too;
		// this is so the refusal reads like a sentence.
		if (patch.is_published === false && params.type === 'page' && params.slug === 'home') {
			return fail(400, {
				message:
					'De startpagina kan niet verborgen worden — dat is het adres van de site zelf.'
			});
		}

		// Mirror the database constraints so the editor reports the problem
		// rather than surfacing a raw Postgres error.
		const title = String(patch.title ?? '').trim();
		const seo = String(patch.seo_title ?? '');
		const meta = String(patch.meta_description ?? '');

		if (!title) return fail(400, { message: 'De titel mag niet leeg zijn.' });
		if (!seo.trim()) return fail(400, { message: 'De SEO-titel mag niet leeg zijn.' });
		if (!meta.trim()) return fail(400, { message: 'De meta-omschrijving mag niet leeg zijn.' });
		if (seo.length > 62)
			return fail(400, { message: `De SEO-titel is ${seo.length} tekens; maximaal 62.` });
		if (meta.length > 158)
			return fail(400, {
				message: `De meta-omschrijving is ${meta.length} tekens; maximaal 158.`
			});

		const newSlug = String(form.get('slug') ?? '').trim();
		if (newSlug && newSlug !== params.slug) {
			if (!/^[a-z0-9-]+$/.test(newSlug)) {
				return fail(400, {
					message: 'Een adres mag enkel kleine letters, cijfers en koppeltekens bevatten.'
				});
			}
			patch.slug = newSlug;
		}

		const { error: dbError } = await adminDb()
			.from('pages')
			.update(patch)
			.eq('type', params.type)
			.eq('slug', params.slug);

		if (dbError) {
			// A check constraint means the database has not caught up with this
			// build — the offerte form variant, say, before its migration is
			// applied. Raw Postgres text helps nobody who sees it.
			if (/violates check constraint/i.test(dbError.message)) {
				return fail(400, {
					message:
						'Deze keuze wordt door de database nog niet aanvaard. Waarschijnlijk moet er ' +
						'nog een databank-update uitgevoerd worden. De rest van je wijzigingen is niet ' +
						'opgeslagen; kies iets anders en probeer opnieuw.'
				});
			}
			return fail(500, { message: `Opslaan mislukt: ${dbError.message}` });
		}

		return { saved: true, slug: patch.slug ?? params.slug };
	},

	/** Link the page from the menu or its footer column, from the editor. */
	placeInMenu: async ({ request, params }) => {
		const placement = String((await request.formData()).get('placement') ?? '');
		const db = adminDb();
		const { data: page } = await db
			.from('pages')
			.select('type, slug, title')
			.eq('type', params.type)
			.eq('slug', params.slug)
			.maybeSingle();
		if (!page) return fail(404, { message: 'Pagina niet gevonden.' });

		const menuError = await addToMenu(db, page as Page, placement);
		if (menuError) return fail(500, { message: `Toevoegen mislukt: ${menuError}` });
		return { placed: true };
	},

	/**
	 * Copy the page, as last saved, to a new address, and open the copy.
	 *
	 * Sector and region pages are mostly the same page with a different name, and
	 * each new one used to start from an empty form. The copy starts off the site
	 * and out of the services list, so it cannot show up half-edited or next to
	 * its original in a menu; it goes live when it is switched on under
	 * Zichtbaarheid, like any other hidden page.
	 */
	duplicate: async ({ params }) => {
		const db = adminDb();
		const { data: page } = await db
			.from('pages')
			.select('*')
			.eq('type', params.type)
			.eq('slug', params.slug)
			.maybeSingle();
		if (!page) return fail(404, { message: 'Pagina niet gevonden.' });

		// services-kopie, then services-kopie-2, and so on.
		const base = `${page.slug}-kopie`;
		const { data: taken } = await db
			.from('pages')
			.select('slug')
			.eq('type', page.type)
			.like('slug', `${base}%`);
		const used = new Set((taken ?? []).map((t) => t.slug));
		let slug = base;
		for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

		const { data: last } = await db
			.from('pages')
			.select('sort_order')
			.eq('type', page.type)
			.order('sort_order', { ascending: false })
			.limit(1)
			.maybeSingle();

		const { id: _id, created_at: _created, updated_at: _updated, ...rest } = page;
		const title = `${page.title} (kopie)`;
		const { error: dbError } = await db.from('pages').insert({
			...rest,
			slug,
			title,
			sort_order: (last?.sort_order ?? -1) + 1,
			is_published: false,
			in_services: false,
			menu_label: page.menu_label ? `${page.menu_label} (kopie)`.slice(0, 40) : null,
			todo_note:
				`Kopie van “${page.title}” (${pagePath(page as Page)}). Pas het adres, de titel en de ` +
				'SEO-teksten aan en zet de pagina daarna aan onder Zichtbaarheid.'
		});
		if (dbError) return fail(500, { message: `Dupliceren mislukt: ${dbError.message}` });

		throw redirect(303, `/admin/pages/${page.type}/${slug}`);
	},

	/**
	 * Delete a page for good.
	 *
	 * The public build refuses any link to a page that does not exist, so a
	 * delete that left one behind would fail the next publish instead. Menu and
	 * footer entries for the page are removed along with it; links anywhere else
	 * stop the delete and are listed, so they can be fixed first.
	 */
	delete: async ({ request, params }) => {
		const stop = requireConfirmation(await request.formData());
		if (stop) return stop;

		if (UNDELETABLE.has(`${params.type}/${params.slug}`)) {
			return fail(400, { message: 'Deze pagina hoort bij de site zelf en kan niet verwijderd worden.' });
		}

		const db = adminDb();
		const { data: page } = await db
			.from('pages')
			.select('*')
			.eq('type', params.type)
			.eq('slug', params.slug)
			.maybeSingle();
		if (!page) throw redirect(303, '/admin/pages');

		const content = await readContentForCheck(db);
		const blocking = linksBlockingDelete(content, page as Page);
		if (blocking.length) {
			const places = [...new Set(blocking.map((b) => b.where))];
			return fail(400, {
				message:
					`Er wordt nog naar ${pagePath(page as Page)} gelinkt vanuit ${places.join(', ')}. ` +
					'Haal die links eerst weg, of zet de pagina uit onder Zichtbaarheid in plaats van ' +
					'ze te verwijderen. Er is niets verwijderd.'
			});
		}

		// Menus first: if this fails the page is still there and nothing points
		// at nothing. The other order could leave a menu link to a deleted page.
		const { navigation, footer_sectors, footer_regions } = withoutMenuLinks(
			content.settings,
			pagePath(page as Page)
		);
		const { error: menuError } = await db
			.from('settings')
			.update({ navigation, footer_sectors, footer_regions })
			.eq('id', true);
		if (menuError) return fail(500, { message: `Verwijderen mislukt: ${menuError.message}` });

		const { error: dbError } = await db.from('pages').delete().eq('id', page.id);
		if (dbError) return fail(500, { message: `Verwijderen mislukt: ${dbError.message}` });

		throw redirect(303, '/admin/pages');
	}
};
