import { adminDb } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data } = await adminDb()
		.from('pages')
		.select('type, slug, title, todo_note, updated_at, noindex')
		.order('type')
		.order('sort_order');

	return { pages: data ?? [] };
};
