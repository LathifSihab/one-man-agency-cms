import { env } from '$env/dynamic/public';
import type { Page, PageType, ServiceLink } from '$lib/types';

/** Canonical origin. Always absolute in canonical/og:url — never relative. */
export const SITE = env.PUBLIC_SITE_URL || 'https://www.onemanagency.be';

/**
 * Where a page lives on the site.
 *
 * The one place that turns a page's type and slug into a path. The home page is
 * served at / rather than /home.
 */
export const PATH_PREFIX: Record<PageType, string> = {
	page: '',
	service: '/diensten',
	sector: '/sectoren',
	region: '/regio'
};

export function pagePath(p: { type: PageType; slug: string }): string {
	if (p.type === 'page' && p.slug === 'home') return '/';
	return `${PATH_PREFIX[p.type]}/${p.slug}`;
}

/**
 * The services navigation, built from the content.
 *
 * This was a hardcoded array of ten, and the overview grouped it by slicing that
 * array at fixed positions — so adding a service took a code change and a
 * deploy, and the person who writes the content could not do it. It now follows
 * whatever is flagged in the CMS, in the order set there.
 *
 * Membership is a flag rather than "type is service": the free marketing scan
 * belongs in this list but keeps its own address, which is linked and indexed,
 * and a service can be taken out of the navigation without being deleted.
 */
export function serviceMenu(pages: Page[]): ServiceLink[] {
	return pages
		.filter((p) => p.in_services)
		.slice()
		.sort((a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0))
		.map((p) => ({
			link: pagePath(p),
			// The page's own heading is written for the page and is usually too
			// long for a menu; the short name falls back to it rather than to
			// nothing.
			label: p.menu_label?.trim() || p.title,
			summary: p.menu_summary?.trim() || '',
			group: p.menu_group?.trim() || 'Diensten'
		}));
}

/** The services in the order they appear, gathered under their headings. */
export function serviceGroups(services: ServiceLink[]): { name: string; items: ServiceLink[] }[] {
	const groups: { name: string; items: ServiceLink[] }[] = [];
	for (const service of services) {
		const existing = groups.find((g) => g.name === service.group);
		if (existing) existing.items.push(service);
		else groups.push({ name: service.group, items: [service] });
	}
	return groups;
}

/** The four fixed steps on the homepage (build.py:STAPPEN). */
export const STEPS: ReadonlyArray<readonly [string, string]> = [
	[
		'Kennismaking van 30 minuten, gratis',
		'Ik luister. Jij vertelt wat er scheelt. We kijken of het klikt.'
	],
	['Voorstel op maat', 'Eén pagina. Wat ik doe, wat het kost, wanneer het klaar is.'],
	['Uitvoering', 'Ik werk. Jij doet je job.'],
	[
		'Opvolging',
		'Elke maand een kort rapport in mensentaal: wat werkte, wat niet, wat we aanpassen.'
	]
] as const;

const MONTHS = [
	'januari', 'februari', 'maart', 'april', 'mei', 'juni',
	'juli', 'augustus', 'september', 'oktober', 'november', 'december'
];

/** Dutch long-form date, e.g. "14 september 2026" (build.py:nl_datum). */
export function nlDate(iso: string): string {
	const [year, month, day] = iso.split('-').map(Number);
	return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Sitemap priority per route family (handover/06 route map). */
export function priorityFor(pathname: string): string {
	if (pathname === '/') return '1.0';
	if (['/diensten', '/offerte', '/referenties', '/gratis-marketingscan'].includes(pathname))
		return '0.9';
	if (pathname.startsWith('/diensten/')) return '0.8';
	if (pathname.startsWith('/blog/')) return '0.6';
	return '0.7';
}
