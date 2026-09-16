import { getContent } from '$lib/server/content';
import { SITE, priorityFor } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

/** All 41 indexable routes with their priorities. /404 is excluded. */
export const GET: RequestHandler = async () => {
	const { pages, posts } = await getContent();
	const today = new Date().toISOString().slice(0, 10);

	// Emission order mirrors the reference build: posts (newest first), then each
	// page family alphabetically, then the fixed pages.
	const routes: string[] = posts.map((post) => `/blog/${post.slug}`);

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
			routes.push(type === 'page' ? (p.slug === 'home' ? '/' : `/${p.slug}`) : prefix[type] + p.slug);
		}
	}

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...routes.map(
			(r) =>
				`  <url><loc>${SITE}${r}</loc>` +
				`<lastmod>${today}</lastmod><priority>${priorityFor(r)}</priority></url>`
		),
		'</urlset>'
	].join('\n');

	return new Response(body, { headers: { 'content-type': 'application/xml' } });
};
