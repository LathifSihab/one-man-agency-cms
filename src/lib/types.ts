export type PageType = 'page' | 'service' | 'sector' | 'region';

export interface FaqItem {
	vraag: string;
	antwoord: string;
}

export interface PriceRow {
	wat: string;
	vanaf: string;
}

export interface ProjectRow extends PriceRow {
	link: string;
}

export interface Package {
	naam: string;
	voor_wie: string;
	prijs: string;
	periode: string;
	uitgelicht: boolean;
	inbegrepen: string[];
}

export interface Figure {
	getal: string;
	label: string;
}

export interface Testimonial {
	tekst: string;
	naam: string;
	functie: string;
}

export interface Cta {
	label: string;
	link: string;
}

export interface Page {
	type: PageType;
	slug: string;
	title: string;
	seo_title: string;
	meta_description: string;
	intro: string;
	body: string;
	noindex: boolean;
	todo_note: string | null;
	sort_order: number;
	faq: FaqItem[] | null;
	prices: PriceRow[] | null;
	packages: Package[] | null;
	projects: ProjectRow[] | null;
	figures: Figure[] | null;
	testimonials: Testimonial[] | null;
	sector_list: string[] | null;
	form_variant: 'contact' | 'scan' | null;
	booking_url: string | null;
	portrait_url: string | null;
	portrait_alt: string | null;
	header_image_url: string | null;
	header_alt: string | null;
	cta_primary: Cta | null;
	cta_secondary: Cta | null;
}

export interface Post {
	slug: string;
	title: string;
	seo_title: string;
	meta_description: string;
	intro: string;
	body: string;
	published_on: string;
	category: string | null;
	image_url: string | null;
	is_published: boolean;
	legacy_url: string | null;
}

export interface Logo {
	name: string;
	file_path: string;
	sort_order: number;
}

export interface Company {
	naam: string;
	juridisch: string;
	straat: string;
	postcode: number | string;
	stad: string;
	btw: string;
	telefoon: string;
	telefoon_link: string;
	email: string;
	slogan: string;
}

export interface NavItem {
	label: string;
	link: string;
}

export interface Social {
	naam: string;
	url: string;
}

export interface Settings {
	company: Company;
	navigation: NavItem[];
	header_cta: Cta;
	formspree_id: string | null;
	socials: Social[];
}

export interface SiteContent {
	pages: Page[];
	posts: Post[];
	logos: Logo[];
	settings: Settings;
}
