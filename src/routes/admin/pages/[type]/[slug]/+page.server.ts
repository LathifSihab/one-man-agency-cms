import { error, fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

const TYPES = new Set(['page', 'service', 'sector', 'region']);

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

	return { page: data };
};

/** Fields the editor may write. Anything else is ignored. */
const JSON_FIELDS = [
	'faq',
	'prices',
	'packages',
	'projects',
	'figures',
	'testimonials',
	'sector_list',
	'cta_primary',
	'cta_secondary'
];

const TEXT_FIELDS = [
	'title',
	'seo_title',
	'meta_description',
	'intro',
	'body',
	'todo_note',
	'booking_url',
	'portrait_url',
	'portrait_alt',
	'header_image_url',
	'header_alt'
];

/**
 * Fields the database restricts to a fixed set of values.
 *
 * form_variant was readable and rendered but had no way in: it was set once
 * during the migration and never again. When a new page needed a form, there
 * was no switch to find — so the offerte page shipped asking visitors to fill
 * in a form that was not there. Empty means no form.
 */
const ENUM_FIELDS: Record<string, string[]> = {
	form_variant: ['contact', 'scan']
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const form = await request.formData();
		const patch: Record<string, unknown> = {};

		for (const field of TEXT_FIELDS) {
			if (form.has(field)) {
				const value = String(form.get(field) ?? '');
				patch[field] = value === '' && field !== 'body' && field !== 'title' ? null : value;
			}
		}

		for (const field of JSON_FIELDS) {
			if (form.has(field)) {
				const raw = String(form.get(field) ?? '');
				try {
					const parsed = raw ? JSON.parse(raw) : null;
					patch[field] = Array.isArray(parsed) && parsed.length === 0 ? null : parsed;
				} catch {
					return fail(400, { message: `Kon het veld "${field}" niet opslaan.` });
				}
			}
		}

		for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
			if (!form.has(field)) continue;
			const value = String(form.get(field) ?? '');
			if (value && !allowed.includes(value)) {
				return fail(400, { message: `"${value}" is geen geldige keuze voor "${field}".` });
			}
			patch[field] = value || null;
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

		if (dbError) return fail(500, { message: `Opslaan mislukt: ${dbError.message}` });

		return { saved: true, slug: patch.slug ?? params.slug };
	}
};
