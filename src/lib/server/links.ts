import type { SupabaseClient } from '@supabase/supabase-js';
import { SERVICES } from '$lib/site';
import type { Logo, Page, Post, Settings, SiteContent } from '$lib/types';

/**
 * Catch a broken internal link before it reaches the build.
 *
 * The public site is prerendered with `handleHttpError: 'fail'` (see
 * svelte.config.js), so one link to a slug that no longer exists stops the whole
 * deploy. That is the right call for the live site — better a stale site than a
 * half-published one — but it surfaces as a Vercel build-failure email full of
 * stack traces, sent to whoever owns the project, not to the person who made
 * the edit.
 *
 * Renaming a slug is a perfectly ordinary thing to do in the CMS, and nothing in
 * the editor warns that the navigation still points at the old one. So the
 * publish endpoint runs this first and refuses in plain Dutch instead.
 */

/**
 * Read the content as the next build would see it.
 *
 * Deliberately not getContent(): that memoises into a module-level cache, and a
 * warm serverless instance would hand back whatever it read on an earlier
 * request — checking the edit before last and passing a build that then fails.
 */
export async function readContentForCheck(db: SupabaseClient): Promise<SiteContent> {
	const [pages, posts, settings] = await Promise.all([
		db.from('pages').select('*'),
		db.from('posts').select('*'),
		db.from('settings').select('*').single()
	]);

	for (const result of [pages, posts, settings]) {
		if (result.error) throw new Error(`Supabase read failed: ${result.error.message}`);
	}

	return {
		pages: pages.data as Page[],
		// Only published posts are prerendered, so only they have a /blog/<slug>.
		posts: (posts.data as Post[]).filter((p) => p.is_published),
		logos: [] as Logo[],
		settings: settings.data as Settings
	};
}

export interface BrokenLink {
	/** The path that has no page behind it, e.g. "/prijzen". */
	link: string;
	/** Where it was found, phrased for the person who has to fix it. */
	where: string;
}

/** Routes that exist as files rather than as content rows. */
const FIXED_ROUTES = [
	'/',
	'/bedankt',
	'/formulier-fout',
	'/404',
	'/robots.txt',
	'/sitemap.xml',
	'/llms.txt',
	'/build-info.json'
];

const PREFIX: Record<Page['type'], string> = {
	page: '',
	service: '/diensten',
	sector: '/sectoren',
	region: '/regio'
};

/**
 * Paths written straight into components, which no content edit can change.
 *
 * These are as fragile as the navigation is: rename `contact` in the CMS and the
 * footer link in SectorList.svelte breaks the build just the same. Keeping them
 * here means the CMS refuses the rename with a clear message rather than letting
 * the build discover it.
 *
 * Add to this list whenever a literal internal href is added to a component.
 * Links built from content — `/diensten/{slug}` in ServicesGrid, `/blog/{slug}`
 * in BlogIndex — do not belong here; they follow the content by construction.
 * The exception is SERVICES below, a hardcoded list of service slugs.
 */
const CODE_PATHS: ReadonlyArray<readonly [string, string]> = [
	['/afspraak', 'de knop "Maak een afspraak"'],
	['/diensten', 'de knop "Bekijk alle diensten"'],
	['/offerte', 'de knop "Bekijk de prijzen"'],
	['/referenties', 'de knop "Bekijk de referenties"'],
	['/gratis-marketingscan', 'de knop "Vraag je gratis scan aan"'],
	['/contact', 'de tekst onder "Ik werk vooral met"'],
	['/blog', 'de knop "Alle artikels"'],
	['/veelgestelde-vragen', 'de voettekst'],
	['/privacybeleid', 'de voettekst'],
	['/cookiebeleid', 'de voettekst'],
	['/algemene-voorwaarden', 'de voettekst'],
	// The menu lists these six regions and four sectors by name.
	['/regio/marketingbureau-dendermonde', 'het menu'],
	['/regio/marketingbureau-lebbeke', 'het menu'],
	['/regio/marketingbureau-aalst', 'het menu'],
	['/regio/marketingbureau-sint-niklaas', 'het menu'],
	['/regio/marketingbureau-wetteren', 'het menu'],
	['/regio/marketingbureau-zele', 'het menu'],
	['/sectoren/verzekeringsmakelaars', 'het menu'],
	['/sectoren/garages-en-autobedrijven', 'het menu'],
	['/sectoren/bouw-en-renovatie', 'het menu'],
	['/sectoren/horeca-en-retail', 'het menu'],
	...SERVICES.map(([slug, naam]) => [`/diensten/${slug}`, `het menu ("${naam}")`] as const)
];

/** Trailing slashes and anchors do not make a different page. */
function normalise(link: string): string {
	const path = link.split('#')[0].split('?')[0];
	return path.replace(/\/+$/, '') || '/';
}

/** Only same-site paths are checked; mailto:, tel: and absolute URLs are not. */
function isInternal(link: string): boolean {
	return link.startsWith('/') && !link.startsWith('//');
}

/**
 * Every path that resolves to a prerendered page.
 *
 * Unpublished posts are deliberately absent: /blog/<slug> does not exist for
 * them, so a link to one is broken in exactly the way this guards against.
 */
function validPaths({ pages, posts }: SiteContent): Set<string> {
	const valid = new Set(FIXED_ROUTES);
	for (const page of pages) {
		// The home page is served at / and the 404 body is rendered by the error
		// page, so neither is reachable at /home or /404 as a crawled link.
		if (page.type === 'page' && page.slug === 'home') continue;
		valid.add(`${PREFIX[page.type]}/${page.slug}`);
	}
	for (const post of posts) valid.add(`/blog/${post.slug}`);
	return valid;
}

/** Markdown links: [label](/path). Bare paths in prose are not links. */
function markdownLinks(body: string | null): string[] {
	if (!body) return [];
	return [...body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
}

/** A page's own name, as it appears in the CMS page list. */
function pageLabel(page: Page): string {
	const family =
		page.type === 'page' ? 'pagina' : page.type === 'service' ? 'dienst' : page.type === 'sector' ? 'sector' : 'regio';
	return `de ${family} "${page.title}"`;
}

function postLabel(post: Post): string {
	return `het artikel "${post.title}"`;
}

/**
 * Collect every internal link that has no page behind it.
 *
 * Returned in the order a person would go looking: navigation first, then the
 * pages, then the blog, then the links baked into the design.
 */
export function findBrokenLinks(content: SiteContent): BrokenLink[] {
	const valid = validPaths(content);
	const broken: BrokenLink[] = [];
	const seen = new Set<string>();

	const check = (raw: string | null | undefined, where: string) => {
		if (!raw || !isInternal(raw)) return;
		const link = normalise(raw);
		if (valid.has(link)) return;
		// One entry per place, so fixing the navigation does not hide the 404 page.
		const key = `${link}\u0000${where}`;
		if (seen.has(key)) return;
		seen.add(key);
		broken.push({ link, where });
	};

	const { settings, pages, posts } = content;

	for (const item of settings.navigation ?? []) {
		check(item.link, `het menu ("${item.label}")`);
	}
	check(settings.header_cta?.link, `de knop bovenaan ("${settings.header_cta?.label}")`);

	for (const page of pages) {
		const where = pageLabel(page);
		for (const link of markdownLinks(page.body)) check(link, where);
		for (const link of markdownLinks(page.intro)) check(link, where);
		check(page.cta_primary?.link, `${where} (knop "${page.cta_primary?.label}")`);
		check(page.cta_secondary?.link, `${where} (knop "${page.cta_secondary?.label}")`);
		for (const project of page.projects ?? []) {
			check(project.link, `${where} (projectrij "${project.wat}")`);
		}
	}

	for (const post of posts) {
		const where = postLabel(post);
		for (const link of markdownLinks(post.body)) check(link, where);
		for (const link of markdownLinks(post.intro)) check(link, where);
	}

	for (const [link, where] of CODE_PATHS) check(link, where);

	return broken;
}

/**
 * One sentence a non-technical person can act on.
 *
 * Names the missing address and where it is used, because "a link is broken" is
 * not something you can go and fix.
 */
export function explainBrokenLinks(broken: BrokenLink[]): string {
	const list = broken.map((b) => `${b.link} (in ${b.where})`).join('; ');
	const opening =
		broken.length === 1
			? 'Publiceren is gestopt: er verwijst nog een link naar een pagina die niet meer bestaat'
			: `Publiceren is gestopt: er verwijzen nog ${broken.length} links naar pagina's die niet meer bestaan`;
	return (
		`${opening} — ${list}. ` +
		'Dit gebeurt meestal nadat het webadres van een pagina is gewijzigd. ' +
		'Pas de link aan, of zet het oude webadres terug, en publiceer opnieuw. ' +
		'Je wijzigingen blijven bewaard.'
	);
}
