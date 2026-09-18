/**
 * SEO analysis of one piece of content.
 *
 * Pure functions over the fields the editor already fills in, so the same rules
 * run in three places: live in the blog editor, live in the page editor, and
 * over the whole database on the dashboard. No network, no database, no Svelte —
 * that is what lets the dashboard grade 41 pages without loading an editor.
 *
 * The rules encode what the handover audit found on the old site: titles and
 * descriptions Google truncated, pages too thin to rank, bodies with no
 * subheadings and no internal links. They are advice, not validation: nothing
 * here can block a save. The two hard limits (62 and 158) are enforced by the
 * database and by the save actions; here they are only the last warning before
 * that happens.
 */

export type Status = 'ok' | 'warn' | 'fail';

export interface Check {
	key: string;
	label: string;
	status: Status;
	detail: string;
}

export interface Analysis {
	/** 0–100, weighted: a failed check costs twice what a warning costs. */
	score: number;
	checks: Check[];
	/** How the result renders in Google, after truncation. */
	preview: { title: string; description: string; url: string };
	words: number;
}

export interface Subject {
	kind: 'post' | 'page';
	title: string;
	seoTitle: string;
	metaDescription: string;
	intro: string;
	body: string;
	/** The public path, e.g. /blog/lokale-seo or /diensten/webdesign. */
	path: string;
	imageUrl?: string | null;
}

export const TITLE_LIMIT = 62;
export const META_LIMIT = 158;
/** Below this a page has too little text to rank for anything competitive. */
export const THIN_WORDS = 300;

/** Dutch stop words, so "de" and "een" never count as the subject of a page. */
const STOP = new Set([
	'de', 'het', 'een', 'en', 'of', 'van', 'voor', 'met', 'op', 'in', 'je', 'jouw', 'uw',
	'die', 'dat', 'te', 'aan', 'bij', 'is', 'zijn', 'wordt', 'worden', 'naar', 'als',
	'ook', 'niet', 'geen', 'meer', 'over', 'door', 'dan', 'wat', 'hoe', 'waarom', 'zo',
	'per', 'om', 'er', 'we', 'ik', 'jij', 'man', 'agency', 'one'
]);

function words(text: string): string[] {
	return (text.toLowerCase().match(/[a-zà-ÿ0-9']+/g) ?? []).filter((w) => w.length > 2);
}

/** The content words of the SEO title — what the page is trying to rank for. */
export function focusTerms(seoTitle: string): string[] {
	// Everything before the brand suffix: "Webdesign Dendermonde — One Man Agency".
	const head = (seoTitle ?? '').split(/[—|·]/)[0];
	return [...new Set(words(head).filter((w) => !STOP.has(w)))];
}

/** Markdown stripped back to the prose a reader actually sees. */
export function plainText(markdown: string): string {
	return (markdown ?? '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/\{\{[^}]*\}\}/g, ' ') // shortcode blocks are rendered, not written
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#>*_`~]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function wordCount(markdown: string): number {
	const text = plainText(markdown);
	return text ? text.split(' ').length : 0;
}

/** How Google truncates, roughly: at a word boundary, with an ellipsis. */
export function truncate(text: string, limit: number): string {
	if (text.length <= limit) return text;
	const cut = text.slice(0, limit);
	const space = cut.lastIndexOf(' ');
	return (space > 0 ? cut.slice(0, space) : cut).trimEnd() + '…';
}

function mark(status: Status, key: string, label: string, detail: string): Check {
	return { key, label, status, detail };
}

export function analyse(s: Subject): Analysis {
	const checks: Check[] = [];
	const body = s.body ?? '';
	const count = wordCount(body);
	const terms = focusTerms(s.seoTitle ?? '');
	const haystack = words(`${s.title ?? ''} ${s.intro ?? ''} ${plainText(body)}`);
	const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1]);

	// ── Title ──────────────────────────────────────────────────────────────
	const titleLen = (s.seoTitle ?? '').length;
	if (!titleLen) {
		checks.push(mark('fail', 'title', 'SEO-titel', 'Nog geen SEO-titel ingevuld.'));
	} else if (titleLen > TITLE_LIMIT) {
		checks.push(
			mark('fail', 'title', 'SEO-titel', `${titleLen} tekens. Google knipt af na ${TITLE_LIMIT}.`)
		);
	} else if (titleLen < 30) {
		checks.push(
			mark('warn', 'title', 'SEO-titel', `${titleLen} tekens. Kort — je laat ruimte liggen.`)
		);
	} else {
		checks.push(mark('ok', 'title', 'SEO-titel', `${titleLen} tekens. Past volledig.`));
	}

	// ── Meta description ───────────────────────────────────────────────────
	const metaLen = (s.metaDescription ?? '').length;
	if (!metaLen) {
		checks.push(mark('fail', 'meta', 'Meta-omschrijving', 'Nog geen omschrijving ingevuld.'));
	} else if (metaLen > META_LIMIT) {
		checks.push(
			mark(
				'fail',
				'meta',
				'Meta-omschrijving',
				`${metaLen} tekens. Google knipt af na ${META_LIMIT}.`
			)
		);
	} else if (metaLen < 80) {
		checks.push(
			mark('warn', 'meta', 'Meta-omschrijving', `${metaLen} tekens. Kort — vul aan tot 120 à 155.`)
		);
	} else {
		checks.push(mark('ok', 'meta', 'Meta-omschrijving', `${metaLen} tekens. Goede lengte.`));
	}

	// ── The subject of the page ────────────────────────────────────────────
	// There is no keyword field to fill in, on purpose: an unfilled one grades
	// everything as perfect. The subject is read from the SEO title, which the
	// editor writes anyway, and the checks ask whether the rest of the page
	// actually delivers on it.
	if (!terms.length) {
		checks.push(
			mark('warn', 'focus', 'Onderwerp', 'Uit de SEO-titel valt geen onderwerp af te leiden.')
		);
	} else {
		const missing = terms.filter((t) => !haystack.includes(t));
		if (missing.length === terms.length) {
			checks.push(
				mark(
					'fail',
					'focus',
					'Onderwerp in de tekst',
					`“${terms.join(' ')}” komt nergens in de tekst voor. Titel en inhoud gaan over iets anders.`
				)
			);
		} else if (missing.length) {
			checks.push(
				mark(
					'warn',
					'focus',
					'Onderwerp in de tekst',
					`“${missing.join(', ')}” uit de SEO-titel staat niet in de tekst.`
				)
			);
		} else {
			checks.push(
				mark('ok', 'focus', 'Onderwerp in de tekst', `“${terms.join(' ')}” komt terug in de tekst.`)
			);
		}

		const metaWords = words(s.metaDescription ?? '');
		checks.push(
			terms.some((t) => metaWords.includes(t))
				? mark(
						'ok',
						'focus-meta',
						'Onderwerp in de omschrijving',
						'Het onderwerp staat in de meta-omschrijving.'
					)
				: mark(
						'warn',
						'focus-meta',
						'Onderwerp in de omschrijving',
						'Het onderwerp uit de titel staat niet in de meta-omschrijving. Google zet die woorden vet.'
					)
		);
	}

	// ── Length ─────────────────────────────────────────────────────────────
	if (count < 150) {
		checks.push(mark('fail', 'length', 'Lengte', `${count} woorden. Te dun om op te ranken.`));
	} else if (count < THIN_WORDS) {
		checks.push(
			mark('warn', 'length', 'Lengte', `${count} woorden. Mik op minstens ${THIN_WORDS}.`)
		);
	} else {
		checks.push(mark('ok', 'length', 'Lengte', `${count} woorden.`));
	}

	// ── Structure ──────────────────────────────────────────────────────────
	if (!headings.length) {
		checks.push(
			mark(
				count < 250 ? 'warn' : 'fail',
				'headings',
				'Tussentitels',
				'Geen enkele tussentitel. Eén lange lap tekst leest slecht en scoort slecht.'
			)
		);
	} else {
		const withTerm = headings.some((h) => {
			const hw = words(h);
			return terms.some((t) => hw.includes(t));
		});
		checks.push(
			withTerm
				? mark(
						'ok',
						'headings',
						'Tussentitels',
						`${headings.length} tussentitels, met het onderwerp erin.`
					)
				: mark(
						'warn',
						'headings',
						'Tussentitels',
						`${headings.length} tussentitels, maar geen enkele noemt het onderwerp.`
					)
		);
	}

	// ── Internal links ─────────────────────────────────────────────────────
	// Only links to our own pages count: they are what spreads authority and
	// what keeps a reader on the site.
	const internal = [...body.matchAll(/\]\((\/[^)]*)\)/g)].length;
	checks.push(
		internal
			? mark(
					'ok',
					'links',
					'Interne links',
					`${internal} link${internal === 1 ? '' : 'en'} naar eigen pagina’s.`
				)
			: mark(
					'warn',
					'links',
					'Interne links',
					'Geen links naar andere pagina’s. Verwijs naar een dienst of een ander artikel.'
				)
	);

	// ── Intro ──────────────────────────────────────────────────────────────
	checks.push(
		(s.intro ?? '').trim().length >= 60
			? mark('ok', 'intro', 'Inleiding', 'De inleiding geeft het antwoord meteen.')
			: mark(
					'warn',
					'intro',
					'Inleiding',
					'Kort of leeg. Dit is net de alinea die AI-assistenten citeren.'
				)
	);

	// ── Image ──────────────────────────────────────────────────────────────
	// Posts only: a page's image is optional by design, a post's card is not.
	if (s.kind === 'post') {
		checks.push(
			s.imageUrl
				? mark('ok', 'image', 'Afbeelding', 'Deze afbeelding wordt de kaart bij een gedeelde link.')
				: mark(
						'warn',
						'image',
						'Afbeelding',
						'Geen afbeelding. Bij delen toont dit artikel de algemene sitekaart.'
					)
		);
	}

	// ── URL ────────────────────────────────────────────────────────────────
	const slug = s.path.split('/').filter(Boolean).at(-1) ?? '';
	checks.push(
		slug.length > 60
			? mark('warn', 'slug', 'Webadres', 'Lang webadres. Korter leest beter in een zoekresultaat.')
			: mark('ok', 'slug', 'Webadres', s.path)
	);

	const weight = { ok: 0, warn: 1, fail: 2 } as const;
	const lost = checks.reduce((n, c) => n + weight[c.status], 0);
	const worst = checks.length * 2;
	const score = worst ? Math.round(((worst - lost) / worst) * 100) : 100;

	return {
		score,
		checks,
		words: count,
		preview: {
			title: truncate(s.seoTitle || s.title || '', TITLE_LIMIT),
			description: truncate(s.metaDescription || s.intro || '', META_LIMIT),
			url: s.path
		}
	};
}

/** A one-word verdict for a badge. */
export function grade(score: number): { label: string; status: Status } {
	if (score >= 85) return { label: 'Goed', status: 'ok' };
	if (score >= 60) return { label: 'Kan beter', status: 'warn' };
	return { label: 'Werk aan de winkel', status: 'fail' };
}
