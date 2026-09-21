/**
 * Proof that a link to a missing page cannot reach the build.
 *
 * The public site is prerendered with handleHttpError: 'fail', so one dead
 * internal link stops the whole deploy. On 20 September 2026 a slug was renamed
 * from `prijzen` to `offerte` in the CMS while the menu still pointed at the old
 * address; the build died with `404 /prijzen (linked from /)` and the only
 * notice was a Vercel build-failure email. $lib/server/links.ts catches that in
 * the CMS instead; this checks that it stays caught.
 *
 * Run with `npm run test:links`; add `--live` to check the real database as the
 * publish endpoint would.
 *
 * Loaded through the project's own Vite config so the $lib alias and the $env
 * virtual modules resolve exactly as they do in the app.
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { findBrokenLinks, explainBrokenLinks, findMissingImages, explainMissingImages } =
	await server.ssrLoadModule('/src/lib/server/links.ts');
const { renderMarkdown } = await server.ssrLoadModule('/src/lib/markdown.ts');

const page = (over = {}) => ({
	type: 'page', slug: 'x', title: 'X', seo_title: '', meta_description: '',
	intro: '', body: '', noindex: false, todo_note: null, sort_order: 0,
	faq: null, prices: null, packages: null, projects: null, figures: null,
	testimonials: null, sector_list: null, form_variant: null, booking_url: null,
	portrait_url: null, portrait_alt: null, header_image_url: null, header_alt: null,
	cta_primary: null, cta_secondary: null, ...over
});

// Every slug the components hardcode, so a baseline fixture is actually valid.
const REQUIRED = [
	['page', 'home'], ['page', 'afspraak'], ['page', 'diensten'], ['page', 'offerte'],
	['page', 'referenties'], ['page', 'gratis-marketingscan'], ['page', 'contact'],
	['page', 'blog'], ['page', 'veelgestelde-vragen'], ['page', 'privacybeleid'],
	['page', 'cookiebeleid'], ['page', 'algemene-voorwaarden'],
	...['dendermonde', 'lebbeke', 'aalst', 'sint-niklaas', 'wetteren', 'zele'].map((r) => [
		'region', `marketingbureau-${r}`
	]),
	...['verzekeringsmakelaars', 'garages-en-autobedrijven', 'bouw-en-renovatie', 'horeca-en-retail'].map(
		(s) => ['sector', s]
	),
	...['marketingstrategie', 'branding-en-huisstijl', 'webdesign', 'seo-en-geo', 'google-ads',
		'social-media', 'e-mailmarketing', 'grafische-vormgeving-en-drukwerk', 'foto-en-video',
		'ai-voor-kmo'].map((s) => ['service', s])
];

const base = () => ({
	pages: REQUIRED.map(([type, slug]) => page({ type, slug, title: slug })),
	posts: [],
	logos: [],
	settings: {
		navigation: [{ label: 'Prijzen', link: '/offerte' }],
		header_cta: { label: 'Maak een afspraak', link: '/afspraak' },
		company: {}, formspree_id: null, socials: []
	}
});

let failures = 0;
const check = (name, got, want) => {
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
	if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
};

// 1. A healthy site passes.
check('healthy content has no broken links', findBrokenLinks(base()).map((b) => b.link), []);

// 2. The exact failure that broke the build: nav points at a renamed slug.
{
	const c = base();
	c.settings.navigation = [{ label: 'Prijzen', link: '/prijzen' }];
	const broken = findBrokenLinks(c);
	check('renamed slug in the menu is caught', broken.map((b) => b.link), ['/prijzen']);
	console.log('        where:', broken[0]?.where);
	console.log('        message:', explainBrokenLinks(broken));
}

// 3. A markdown link in a page body, named by the page's own title.
{
	const c = base();
	c.pages.find((p) => p.slug === 'contact').body = 'Zie [Prijzen](/prijzen) voor meer.';
	const broken = findBrokenLinks(c);
	check('markdown link in a body is caught', broken.map((b) => b.link), ['/prijzen']);
	check('body link names the page', broken[0]?.where, 'de pagina "contact"');
}

// 4. A slug the components hardcode: renaming /contact breaks SectorList.svelte.
{
	const c = base();
	c.pages = c.pages.filter((p) => p.slug !== 'contact');
	c.settings.navigation = [];
	check('hardcoded component link is caught', findBrokenLinks(c).map((b) => b.link), ['/contact']);
}

// 5. An unpublished post has no /blog/<slug>, so linking to one is broken.
{
	const c = base();
	c.pages.find((p) => p.slug === 'blog').body = '[Nieuw](/blog/concept)';
	check('link to an unpublished post is caught', findBrokenLinks(c).map((b) => b.link), ['/blog/concept']);
}

// 6. Trailing slashes, anchors and external links must not raise false alarms.
{
	const c = base();
	c.pages.find((p) => p.slug === 'contact').body =
		'[a](/offerte/) [b](/offerte#prijs) [c](https://example.com/prijzen) [d](mailto:x@y.be)';
	check('slashes, anchors and external links are fine', findBrokenLinks(c).map((b) => b.link), []);
}

// 7. Several at once, reported one per place.
{
	const c = base();
	c.settings.navigation = [{ label: 'Prijzen', link: '/prijzen' }];
	c.pages.find((p) => p.slug === 'home').body = '[Prijzen](/prijzen)';
	const broken = findBrokenLinks(c);
	check('same dead link in two places is listed twice', broken.length, 2);
	console.log('        message:', explainBrokenLinks(broken));
}

// ── images in bodies ────────────────────────────────────────────────────────

// 8. A media key resolves to the baked path; a repo path is left alone.
{
	check(
		'a media key resolves to the published path',
		renderMarkdown('![gevel](site/gevel.jpg)'),
		'<p><img alt="gevel" src="/assets/media/site/gevel.jpg" /></p>'
	);
	check(
		'a repo path is left as it is',
		renderMarkdown('![niels](/assets/niels.jpg)'),
		'<p><img alt="niels" src="/assets/niels.jpg" /></p>'
	);
}

// 9. An image the library no longer holds is caught before it fails the build.
{
	const c = base();
	c.pages.find((p) => p.slug === 'contact').body = 'Kom langs\n\n![gevel](site/weg.jpg)';
	c.pages.find((p) => p.slug === 'home').header_image_url = 'site/aanwezig.jpg';
	const available = new Set(['site/aanwezig.jpg']);
	const missing = findMissingImages(c, available);
	check('a deleted image is caught', missing.map((m) => m.value), ['site/weg.jpg']);
	check('and named by its page', missing[0]?.where, 'de pagina "contact"');
	check('an image that is still there is fine', findMissingImages({ ...c, pages: c.pages.filter((p) => p.slug === 'home') }, available).length, 0);
	console.log('        message:', explainMissingImages(missing));
}

// 10. Repo images are not in the bucket and must not be reported as missing.
{
	const c = base();
	c.pages.find((p) => p.slug === 'contact').body = '![niels](/assets/niels.jpg)';
	check('a repo image is never reported missing', findMissingImages(c, new Set()).length, 0);
}

// 11. Optionally: the live database, checked exactly as publishing would.
if (process.argv.includes('--live')) {
	const { readContentForCheck } = await server.ssrLoadModule('/src/lib/server/links.ts');
	const { createClient } = await import('@supabase/supabase-js');
	const { readFileSync } = await import('node:fs');

	const env = { ...process.env };
	try {
		for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
			const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
			if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
		}
	} catch {
		/* .env is optional; real environment variables win either way. */
	}

	const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false }
	});
	const { readMediaKeys } = await server.ssrLoadModule('/src/lib/server/links.ts');
	const content = await readContentForCheck(db);

	const broken = findBrokenLinks(content);
	check('live content has no broken links', broken.map((b) => b.link), []);
	if (broken.length) console.log('        ' + explainBrokenLinks(broken));

	const missing = findMissingImages(content, await readMediaKeys(db));
	check('live content has no missing images', missing.map((m) => m.value), []);
	if (missing.length) console.log('        ' + explainMissingImages(missing));
}

await server.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
