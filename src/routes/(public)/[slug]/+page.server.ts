import { error } from '@sveltejs/kit';
import { getContent } from '$lib/server/content';
import type { EntryGenerator, PageServerLoad } from './$types';

/** Slugs handled by their own routes, or not part of this family. */
const EXCLUDED = new Set(['home', '404']);

/**
 * Every fixed page must be listed here or prerendering silently skips it.
 * Shipping a 30-page site instead of a 42-page one is the failure mode this
 * guards against.
 */
export const entries: EntryGenerator = async () => {
	const { pages } = await getContent();
	return pages
		.filter((p) => p.type === 'page' && !EXCLUDED.has(p.slug))
		.map((p) => ({ slug: p.slug }));
};

export const load: PageServerLoad = async ({ params }) => {
	const { pages, posts, logos } = await getContent();
	const found = pages.find((p) => p.type === 'page' && p.slug === params.slug);
	if (!found) throw error(404, `No page with slug "${params.slug}"`);
	return { page: found, posts, logos };
};
