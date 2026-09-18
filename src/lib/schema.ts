import { SITE } from '$lib/site';
import { resolveImage } from '$lib/images';
import type { FaqItem, Page, Post, Settings } from '$lib/types';

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

/** An absolute URL for an image value, or the site-wide fallback. */
export function absoluteImage(value: string | null | undefined): string {
	if (!value) return `${SITE}/assets/og-image.png`;
	if (value.startsWith('http')) return value;
	return SITE + resolveImage(value);
}

/**
 * Article markup for one blog post.
 *
 * Beyond the four fields the reference build emitted, this carries what Google
 * actually uses to build a rich result: an image (a post without one falls back
 * to the site card, so the node is never imageless), the modification date, the
 * category as articleSection, and a word count. `isPartOf` ties the post to the
 * blog, which is what keeps the 7 posts reading as one publication rather than
 * seven loose pages.
 */
export function blogPostingSchema(post: Post) {
	const url = `${SITE}/blog/${post.slug}`;
	// A body is Markdown; words are close enough for wordCount and Google treats
	// it as a hint, not a measurement.
	const wordCount = post.body ? post.body.trim().split(/\s+/).length : 0;

	return {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: post.title,
		description: post.meta_description,
		datePublished: post.published_on,
		dateModified: (post.updated_at ?? post.published_on).slice(0, 10),
		inLanguage: 'nl-BE',
		image: absoluteImage(post.image_url),
		...(post.category ? { articleSection: post.category } : {}),
		...(wordCount ? { wordCount } : {}),
		author: { '@id': PERSON_ID },
		publisher: { '@id': ORG_ID },
		isPartOf: { '@type': 'Blog', '@id': `${SITE}/blog#blog`, name: 'Blog — One Man Agency' },
		url,
		mainEntityOfPage: url
	};
}

/**
 * The trail Google prints above a result instead of the raw URL.
 *
 * Every page below the root gets one. The crumbs must match the visible
 * breadcrumb in the page header — markup that disagrees with the page is an
 * invitation to have the rich result dropped.
 */
export function breadcrumbSchema(crumbs: ReadonlyArray<{ name: string; path: string }>) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.name,
			item: SITE + c.path
		}))
	};
}

/** The blog index as a Blog node listing its posts, newest first. */
export function blogSchema(posts: Post[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Blog',
		'@id': `${SITE}/blog#blog`,
		name: 'Blog — One Man Agency',
		url: `${SITE}/blog`,
		inLanguage: 'nl-BE',
		publisher: { '@id': ORG_ID },
		blogPost: posts.map((post) => ({
			'@type': 'BlogPosting',
			headline: post.title,
			description: post.meta_description,
			datePublished: post.published_on,
			image: absoluteImage(post.image_url),
			author: { '@id': PERSON_ID },
			url: `${SITE}/blog/${post.slug}`
		}))
	};
}

/** The site itself, so search engines have a name for the domain. */
export function websiteSchema(settings: Settings) {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${SITE}/#website`,
		name: settings.company.naam,
		url: SITE,
		inLanguage: 'nl-BE',
		publisher: { '@id': ORG_ID }
	};
}

/**
 * The page-as-a-thing node, which is what carries the language, the primary
 * image and the last-modified date for an ordinary content page.
 */
export function webPageSchema(page: Page, path: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		'@id': `${SITE}${path}#webpage`,
		url: SITE + path,
		name: page.seo_title,
		description: page.meta_description,
		inLanguage: 'nl-BE',
		isPartOf: { '@id': `${SITE}/#website` },
		about: { '@id': ORG_ID },
		...(page.updated_at ? { dateModified: page.updated_at.slice(0, 10) } : {}),
		...(page.header_image_url || page.portrait_url
			? { primaryImageOfPage: absoluteImage(page.header_image_url || page.portrait_url) }
			: {})
	};
}

/**
 * Serialise for embedding in a <script type="application/ld+json"> block.
 * `<` is escaped so a value can never close the script element early.
 */
export function ldJson(obj: unknown): string {
	return JSON.stringify(obj).replace(/</g, '\\u003c');
}
