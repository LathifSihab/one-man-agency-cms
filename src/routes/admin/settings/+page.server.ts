import { fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { findBrokenLinks, readContentForCheck } from '$lib/server/links';
import { pagePath } from '$lib/site';
import type { Page } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = adminDb();
	const [{ data }, { data: pages }] = await Promise.all([
		db.from('settings').select('*').maybeSingle(),
		db
			.from('pages')
			.select('type, slug, title')
			.in('type', ['sector', 'region'])
			.neq('is_published', false)
			.order('sort_order')
	]);

	// What the footer columns can point at, so a link is picked rather than guessed.
	const choices = (type: string) =>
		(pages ?? [])
			.filter((p) => p.type === type)
			.map((p) => ({ title: p.title, link: pagePath(p as Page) }));

	return { settings: data, sectorPages: choices('sector'), regionPages: choices('region') };
};

const COMPANY_KEYS = [
	'naam', 'juridisch', 'straat', 'postcode', 'stad', 'btw',
	'telefoon', 'telefoon_link', 'email', 'slogan'
];

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();

		const company: Record<string, string> = {};
		for (const key of COMPANY_KEYS) company[key] = String(form.get(`company.${key}`) ?? '').trim();

		if (!company.naam || !company.email) {
			return fail(400, { message: 'Bedrijfsnaam en e-mailadres zijn verplicht.' });
		}

		let navigation, socials, footer_sectors, footer_regions;
		try {
			navigation = JSON.parse(String(form.get('navigation') ?? '[]'));
			socials = JSON.parse(String(form.get('socials') ?? '[]'));
			footer_sectors = links(JSON.parse(String(form.get('footer_sectors') ?? '[]')));
			footer_regions = links(JSON.parse(String(form.get('footer_regions') ?? '[]')));
		} catch {
			return fail(400, { message: 'Kon de navigatie, de voettekst of de sociale media niet opslaan.' });
		}

		const patch = {
			company,
			navigation,
			socials,
			footer_sectors,
			footer_regions,
			header_cta: {
				label: String(form.get('cta.label') ?? ''),
				link: String(form.get('cta.link') ?? '')
			},
			formspree_id: String(form.get('formspree_id') ?? '') || null
		};

		const db = adminDb();
		const { error } = await db.from('settings').update(patch).eq('id', true);
		if (error) return fail(500, { message: `Opslaan mislukt: ${error.message}` });

		// Saved either way, but said now rather than when Publish refuses: a
		// link here that points nowhere will stop the next publish.
		const broken = findBrokenLinks(await readContentForCheck(db))
			.filter((b) => /^(het menu|de knop bovenaan|de voettekst, kolom)/.test(b.where))
			.map((b) => `${b.link} in ${b.where}`);

		return { saved: true, broken };
	}
};

/** Label and link, trimmed; a row with neither is an empty row left behind. */
function links(rows: unknown): { label: string; link: string }[] {
	if (!Array.isArray(rows)) throw new Error('not a list');
	return rows
		.map((r) => ({ label: String(r?.label ?? '').trim(), link: String(r?.link ?? '').trim() }))
		.filter((r) => r.label || r.link);
}
