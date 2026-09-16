import { error } from '@sveltejs/kit';
import { getContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { pages, posts, logos } = await getContent();
	const home = pages.find((p) => p.type === 'page' && p.slug === 'home');
	if (!home) throw error(500, 'The home page is missing from the database');
	return { page: home, posts, logos };
};
