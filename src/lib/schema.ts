import { SITE } from '$lib/site';
import type { FaqItem, Post, Settings } from '$lib/types';

/**
 * JSON-LD construction, ported from build.py.
 *
 * The point of the graph is the `@id` cross-references: one ProfessionalService
 * (#organisatie) and one Person (#niels), which every other node points at. Do
 * not inline duplicate organisation objects per page — that is what tells Google
 * and the AI crawlers that all 41 pages describe a single entity.
 */

export const ORG_ID = `${SITE}/#organisatie`;
export const PERSON_ID = `${SITE}/#niels`;

const DESCRIPTION =
	'One Man Agency is een eenmansmarketingbureau uit Dendermonde, opgericht door ' +
	"Niels Van de Meersch, dat KMO's in Oost-Vlaanderen begeleidt in marketingstrategie, " +
	'branding, webdesign, SEO, Google Ads, social media, e-mailmarketing, drukwerk en AI.';

const AREA_SERVED = [
	'Dendermonde', 'Lebbeke', 'Buggenhout', 'Zele', 'Berlare', 'Hamme', 'Temse',
	'Sint-Niklaas', 'Aalst', 'Wetteren', 'Londerzeel', 'Opwijk', 'Oost-Vlaanderen'
];

export function organisationSchema(settings: Settings) {
	const b = settings.company;
	const sameAs = settings.socials.map((s) => s.url);

	return {
		'@context': 'https://schema.org',
		'@type': 'ProfessionalService',
		'@id': ORG_ID,
		name: b.naam,
		alternateName: b.juridisch,
		description: DESCRIPTION,
		slogan: b.slogan,
		url: SITE,
		telephone: b.telefoon_link,
		email: b.email,
		vatID: b.btw.replace(/ /g, '').replace(/\./g, ''),
		priceRange: '€€',
		currenciesAccepted: 'EUR',
		image: `${SITE}/assets/og-image.png`,
		founder: {
			'@type': 'Person',
			'@id': PERSON_ID,
			name: 'Niels Van de Meersch',
			jobTitle: 'Zaakvoerder en marketingstrateeg',
			image: `${SITE}/assets/niels.jpg`,
			worksFor: { '@id': ORG_ID },
			sameAs
		},
		address: {
			'@type': 'PostalAddress',
			streetAddress: b.straat,
			postalCode: String(b.postcode),
			addressLocality: b.stad,
			addressRegion: 'Oost-Vlaanderen',
			addressCountry: 'BE'
		},
		areaServed: AREA_SERVED,
		openingHoursSpecification: [
			{
				'@type': 'OpeningHoursSpecification',
				dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
				opens: '08:30',
				closes: '18:00'
			}
		],
		sameAs
	};
}

export function serviceSchema(title: string, description: string, url: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Service',
		name: title,
		description,
		url,
		provider: { '@id': ORG_ID },
		areaServed: { '@type': 'State', name: 'Oost-Vlaanderen' }
	};
}

export function faqSchema(faq: FaqItem[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faq.map((q) => ({
			'@type': 'Question',
			name: q.vraag,
			acceptedAnswer: { '@type': 'Answer', text: q.antwoord }
		}))
	};
}

export function blogPostingSchema(post: Post) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: post.title,
		description: post.meta_description,
		datePublished: post.published_on,
		inLanguage: 'nl-BE',
		author: { '@id': PERSON_ID },
		publisher: { '@id': ORG_ID },
		mainEntityOfPage: `${SITE}/blog/${post.slug}`
	};
}

/**
 * Serialise for embedding in a <script type="application/ld+json"> block.
 * `<` is escaped so a value can never close the script element early.
 */
export function ldJson(obj: unknown): string {
	return JSON.stringify(obj).replace(/</g, '\\u003c');
}
