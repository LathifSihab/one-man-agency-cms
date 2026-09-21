import { getContent } from '$lib/server/content';
import { serviceMenu } from '$lib/site';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const { settings, pages } = await getContent();
	// Loaded here rather than per page: every public page shows it, in the
	// footer if nowhere else, and layout data is merged into each page's data.
	return { settings, services: serviceMenu(pages) };
};
