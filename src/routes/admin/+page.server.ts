import { adminDb } from '$lib/server/admin';
import { getOutstanding, getPublishState } from '$lib/server/dashboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = adminDb();

	const [outstanding, publish, recent, counts, submissions] = await Promise.all([
		getOutstanding(db),
		getPublishState(db),
		db
			.from('pages')
			.select('slug, type, title, updated_at')
			.order('updated_at', { ascending: false })
			.limit(6),
		Promise.all([
			db.from('pages').select('id', { count: 'exact', head: true }),
			db.from('posts').select('id', { count: 'exact', head: true }),
			db.from('logos').select('id', { count: 'exact', head: true })
		]),
		db.from('submissions').select('id', { count: 'exact', head: true }).eq('is_read', false)
	]);

	return {
		outstanding,
		publish,
		recent: recent.data ?? [],
		counts: {
			pages: counts[0].count ?? 0,
			posts: counts[1].count ?? 0,
			logos: counts[2].count ?? 0,
			unread: submissions.count ?? 0
		}
	};
};
