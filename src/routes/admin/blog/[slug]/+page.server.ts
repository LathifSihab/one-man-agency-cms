import { error, fail, redirect } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { data, error: dbError } = await adminDb()
		.from('posts')
		.select('*')
		.eq('slug', params.slug)
		.maybeSingle();

	if (dbError) throw error(500, dbError.message);
	if (!data) throw error(404, 'Artikel niet gevonden');
	return { post: data };
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const form = await request.formData();

		const title = String(form.get('title') ?? '').trim();
		const seo = String(form.get('seo_title') ?? '');
		const meta = String(form.get('meta_description') ?? '');

		if (!title) return fail(400, { message: 'De titel mag niet leeg zijn.' });
		if (seo.length > 62)
			return fail(400, { message: `De SEO-titel is ${seo.length} tekens; maximaal 62.` });
		if (meta.length > 158)
			return fail(400, {
				message: `De meta-omschrijving is ${meta.length} tekens; maximaal 158.`
			});

		const patch: Record<string, unknown> = {
			title,
			seo_title: seo,
			meta_description: meta,
			intro: String(form.get('intro') ?? ''),
			body: String(form.get('body') ?? ''),
			published_on: String(form.get('published_on') ?? ''),
			category: String(form.get('category') ?? '') || null,
			image_url: String(form.get('image_url') ?? '') || null,
			is_published: form.get('is_published') === 'on'
		};

		/*
		 * Only write fields the form actually submitted.
		 *
		 * legacy_url lives behind the "Geavanceerd" toggle, so when that panel is
		 * collapsed the input is not in the DOM and reading it gives nothing.
		 * Writing that back set the column to null and silently destroyed a 301
		 * redirect — on the one field the handover says must not be dropped.
		 * A control that is not on screen must never erase what it holds.
		 */
		if (form.has('legacy_url')) {
			patch.legacy_url = String(form.get('legacy_url') ?? '') || null;
		}

		const newSlug = String(form.get('slug') ?? '').trim();
		if (newSlug && newSlug !== params.slug) {
			if (!/^[a-z0-9-]+$/.test(newSlug)) {
				return fail(400, {
					message: 'Een adres mag enkel kleine letters, cijfers en koppeltekens bevatten.'
				});
			}
			patch.slug = newSlug;
		}

		const { error: dbError } = await adminDb().from('posts').update(patch).eq('slug', params.slug);
		if (dbError) return fail(500, { message: `Opslaan mislukt: ${dbError.message}` });

		if (patch.slug) throw redirect(303, `/admin/blog/${patch.slug}`);
		return { saved: true };
	},

	delete: async ({ params }) => {
		const { error: dbError } = await adminDb().from('posts').delete().eq('slug', params.slug);
		if (dbError) return fail(500, { message: `Verwijderen mislukt: ${dbError.message}` });
		throw redirect(303, '/admin/blog');
	}
};
