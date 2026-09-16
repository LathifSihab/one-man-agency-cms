import { env } from '$env/dynamic/public';

/** Canonical origin. Always absolute in canonical/og:url — never relative. */
export const SITE = env.PUBLIC_SITE_URL || 'https://www.onemanagency.be';

/**
 * The ten services, in the order the design depends on. Copied verbatim from
 * build.py:DIENSTEN_KORT — slug, display name, one-line description.
 */
export const SERVICES: ReadonlyArray<readonly [string, string, string]> = [
	['marketingstrategie', 'Marketingstrategie', 'Weten waar je naartoe gaat, voor je geld uitgeeft.'],
	['branding-en-huisstijl', 'Branding & huisstijl', 'Een merk dat blijft hangen, van logo tot toon.'],
	['webdesign', 'Webdesign', 'Een website die vragen beantwoordt en klanten oplevert.'],
	['seo-en-geo', 'SEO & GEO', 'Gevonden worden in Google én in AI-antwoorden.'],
	['google-ads', 'Google Ads', 'Bovenaan staan op het moment dat iemand koopklaar zoekt.'],
	['social-media', 'Social media', 'Een contentkalender die doorloopt, ook als jij het druk hebt.'],
	['e-mailmarketing', 'E-mailmarketing', 'Je bestaande klanten zijn je goedkoopste omzet.'],
	[
		'grafische-vormgeving-en-drukwerk',
		'Vormgeving & drukwerk',
		'Van visitekaartje tot gevelreclame.'
	],
	['foto-en-video', 'Foto & video', 'Echte beelden van jouw zaak, geen stockfoto’s.'],
	['ai-voor-kmo', 'AI voor KMO’s', 'Tijd winnen op administratie, offertes en klantcommunicatie.']
] as const;

/** The four themed groups on /diensten (build.py:blok_diensten_volledig). */
export const SERVICE_GROUPS: ReadonlyArray<readonly [string, number, number]> = [
	['Strategie en merk', 0, 2],
	['Online zichtbaar', 2, 5],
	['Content en contact', 5, 9],
	['Nieuw', 9, 10]
] as const;

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
	if (['/diensten', '/prijzen', '/referenties', '/gratis-marketingscan'].includes(pathname))
		return '0.9';
	if (pathname.startsWith('/diensten/')) return '0.8';
	if (pathname.startsWith('/blog/')) return '0.6';
	return '0.7';
}
