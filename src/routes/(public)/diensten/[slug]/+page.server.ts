import { error } from '@sveltejs/kit';
import { getContent, getPagesOfType } from '$lib/server/content';
import type { EntryGenerator, PageServerLoad } from './$types';

/** Without this, prerendering skips every page in this family. */
export const entries: EntryGenerator = async () => {
	const pages = await getPagesOfType('service');
	return pages.map((p) => ({ slug: p.slug }));
};

export const load: PageServerLoad = async ({ params }) => {
	const { pages } = await getContent();
	const found = pages.find((p) => p.type === 'service' && p.slug === params.slug);
	if (!found) throw error(404, `No service page with slug "${params.slug}"`);
	return { page: found };
};
