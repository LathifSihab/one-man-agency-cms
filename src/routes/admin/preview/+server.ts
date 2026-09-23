import { error } from '@sveltejs/kit';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { env } from '$env/dynamic/public';
import PreviewDocument from '$components/admin/PreviewDocument.svelte';
import HomeRoute from '../../(public)/+page.svelte';
import PageRoute from '../../(public)/[slug]/+page.svelte';
import ServiceRoute from '../../(public)/diensten/[slug]/+page.svelte';
import SectorRoute from '../../(public)/sectoren/[slug]/+page.svelte';
import RegionRoute from '../../(public)/regio/[slug]/+page.svelte';
import { adminDb } from '$lib/server/admin';
import { readContentForCheck } from '$lib/server/links';
import { readPagePatch } from '$lib/server/pageForm';
import { MEDIA_OUTPUT_DIR } from '$lib/images';
import { pagePath, serviceMenu } from '$lib/site';
import type { Page } from '$lib/types';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * The page editor's live preview: the real public page, with what is typed in
 * the editor instead of what is saved.
 *
 * The editor posts its own form here, the same form Save posts, and gets back a
 * whole HTML document for an iframe. It is rendered by the very components the
 * build uses, so the preview cannot drift from the site the way a hand-drawn
 * imitation would. Sits under /admin, so hooks.server.ts has already required a
 * session.
 */

type RouteComponent = Component<{ data: Record<string, unknown> }>;

function routeFor(page: Page): RouteComponent {
	if (page.type === 'service') return ServiceRoute as unknown as RouteComponent;
	if (page.type === 'sector') return SectorRoute as unknown as RouteComponent;
	if (page.type === 'region') return RegionRoute as unknown as RouteComponent;
	if (page.slug === 'home') return HomeRoute as unknown as RouteComponent;
	return PageRoute as unknown as RouteComponent;
}

/** The stylesheets app.html loads for the public site. */
const STYLES = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
<link rel="stylesheet" href="/assets/enhance.css">`;

export const POST: RequestHandler = async ({ request, url }) => {
	const form = await request.formData();
	const type = String(form.get('type') ?? '');
	const slug = String(form.get('slug_saved') ?? '');

	const db = adminDb();
	const { data: saved } = await db
		.from('pages')
		.select('*')
		.eq('type', type)
		.eq('slug', slug)
		.maybeSingle();
	if (!saved) throw error(404, 'Pagina niet gevonden');

	// A field that does not parse yet (half a row being typed) previews as saved.
	const read = readPagePatch(form);
	const draft = { ...saved, ...('patch' in read ? read.patch : {}), slug: saved.slug } as Page;

	const content = await readContentForCheck(db);
	const pages = [...content.pages.filter((p) => !(p.type === draft.type && p.slug === draft.slug)), draft];
	const services = serviceMenu(pages.filter((p) => p.is_published !== false));

	const { head, body } = render(PreviewDocument, {
		props: {
			route: routeFor(draft),
			data: {
				page: draft,
				posts: content.posts,
				logos: content.logos,
				settings: content.settings,
				services
			},
			settings: content.settings,
			services,
			pathname: pagePath(draft)
		}
	});

	// Images chosen since the last publish are not under /assets/media yet;
	// Storage has all of them. Same reason as previewImage in $lib/images.
	const storage = env.PUBLIC_SUPABASE_URL
		? `${env.PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/media/`
		: null;
	const withImages = (html: string) =>
		storage ? html.replaceAll(`"/${MEDIA_OUTPUT_DIR}/`, `"${storage}`) : html;

	// <base> makes /assets resolve inside an srcdoc frame, and sends any link
	// that is clicked to a new tab instead of navigating the preview away.
	// No analytics beacon: a preview is not a visit.
	const html = `<!DOCTYPE html>
<html lang="nl-BE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<base href="${url.origin}/" target="_blank">
${STYLES}
${withImages(head)}
</head>
<body>${withImages(body)}</body>
</html>`;

	return new Response(html, {
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
	});
};
