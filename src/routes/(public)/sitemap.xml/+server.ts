import { getContent } from '$lib/server/content';
import { SITE, priorityFor } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

/** All 41 indexable routes with their priorities. /404 is excluded. */
export const GET: RequestHandler = async () => {
	const { pages, posts } = await getContent();
	const today = new Date().toISOString().slice(0, 10);

	/*
	 * A real last-modified date per URL, not today's date on all 41.
	 *
	 * Stamping every URL with the build date tells Google that the whole site
	 * changed every time anything is published, which is how a sitemap trains a
	 * crawler to ignore its own lastmod. The database keeps updated_at per row;
	 * a post with no date falls back to its publication date, and anything
	 * without either (the seed fallback has no timestamps) falls back to today.
	 */
	const stamp = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : today);

	// Emission order mirrors the reference build: posts (newest first), then each
	// page family alphabetically, then the fixed pages.
	const routes: Array<{ path: string; lastmod: string }> = posts.map((post) => ({
		path: `/blog/${post.slug}`,
		lastmod: stamp(post.updated_at ?? post.published_on)
	}));

	const prefix: Record<string, string> = {
		service: '/diensten/',
		sector: '/sectoren/',
		region: '/regio/'
	};
	for (const type of ['service', 'sector', 'region', 'page'] as const) {
		const family = pages
			.filter((p) => p.type === type && !p.noindex && p.slug !== '404')
			.sort((a, b) => a.slug.localeCompare(b.slug));
		for (const p of family) {
			routes.push({
				path:
					type === 'page' ? (p.slug === 'home' ? '/' : `/${p.slug}`) : prefix[type] + p.slug,
				lastmod: stamp(p.updated_at)
			});
		}
	}

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...routes.map(
			(r) =>
				`  <url><loc>${SITE}${r.path}</loc>` +
				`<lastmod>${r.lastmod}</lastmod><priority>${priorityFor(r.path)}</priority></url>`
		),
		'</urlset>'
	].join('\n');

	return new Response(body, { headers: { 'content-type': 'application/xml' } });
};
