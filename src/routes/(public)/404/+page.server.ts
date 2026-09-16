import { error } from '@sveltejs/kit';
import { getContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { pages } = await getContent();
	const page = pages.find((p) => p.type === 'page' && p.slug === '404');
	if (!page) throw error(500, 'The 404 page is missing from the database');
	return { page };
};
