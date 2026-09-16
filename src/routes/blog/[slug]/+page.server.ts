import { error } from '@sveltejs/kit';
import { getContent } from '$lib/server/content';
import type { EntryGenerator, PageServerLoad } from './$types';

/** Only published posts are built; `is_published = false` excludes a post entirely. */
export const entries: EntryGenerator = async () => {
	const { posts } = await getContent();
	return posts.map((p) => ({ slug: p.slug }));
};

export const load: PageServerLoad = async ({ params }) => {
	const { posts } = await getContent();
	const post = posts.find((p) => p.slug === params.slug);
	if (!post) throw error(404, `No post with slug "${params.slug}"`);
	return { post };
};
