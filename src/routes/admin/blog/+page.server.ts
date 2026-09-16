import { fail, redirect } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data } = await adminDb()
		.from('posts')
		.select('slug, title, published_on, category, is_published, legacy_url')
		.order('published_on', { ascending: false });

	return { posts: data ?? [] };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { message: 'Geef het artikel een titel.' });

		const slug = String(form.get('slug') ?? '')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');

		if (!slug) return fail(400, { message: 'Geef een geldig webadres op.' });

		const db = adminDb();
		const { data: existing } = await db.from('posts').select('slug').eq('slug', slug).maybeSingle();
		if (existing) return fail(400, { message: `Er bestaat al een artikel met adres "${slug}".` });

		// A new post starts as a draft: it is excluded from the build until
		// published, so creating one can never change the live site by accident.
		const { error } = await db.from('posts').insert({
			slug,
			title,
			seo_title: title.slice(0, 62),
			meta_description: 'Nog in te vullen.',
			intro: '',
			body: '',
			published_on: new Date().toISOString().slice(0, 10),
			is_published: false
		});

		if (error) return fail(500, { message: `Aanmaken mislukt: ${error.message}` });
		throw redirect(303, `/admin/blog/${slug}`);
	}
};
