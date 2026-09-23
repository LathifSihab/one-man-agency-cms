/**
 * Write the 301 redirects into the build output.
 *
 * Q3 resolved to Cloudflare, where `_redirects` is native: the file is read
 * from the assets directory and applied before the static handler, so there is
 * nothing to inject into a config. (Under Vercel this same file was only a
 * portable record, and the real rules were patched into
 * `.vercel/output/config.json`. That inversion is the whole diff here.)
 *
 * Ten static legacy paths plus one per post `legacy_url`, so a new post with a
 * legacy URL is covered automatically without anyone editing a config file.
 * Run as part of `npm run build`, after the build.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

import { OUTPUT_DIR } from './output.mjs';

/** One newline. Written this way so a patch script cannot mangle the escape. */
const NL = String.fromCharCode(10);

/**
 * Slugs that were renamed after the site went live. The old path was indexed
 * and linked to from outside, so it keeps working rather than 404-ing.
 *
 * `/prijzen` became `/offerte` on 20 September 2026, when the page changed from
 * a price list into a quote request.
 */
const RENAMED = [['/prijzen', '/offerte']];

/**
 * The legacy paths from the old Zyro site. Two of them pointed at /prijzen and
 * follow the rename above — a redirect to a redirect would cost a hop and lose
 * a little link equity.
 */
const STATIC_RULES = [
	['/diensten-one-man-agency', '/diensten'],
	['/marketingbureau-prijzen', '/offerte'],
	['/pakketten', '/offerte'],
	['/marketingbureau-kmo', '/over-niels'],
	['/referenties', '/referenties'],
	['/vragen', '/veelgestelde-vragen'],
	['/offerte-or-contact', '/contact'],
	['/gratis-marketing-scan', '/gratis-marketingscan'],
	['/webdesign', '/diensten/webdesign']
];

/**
 * Pages from the older Wix site that Search Console still reported as 404 in
 * September 2026 (deployment/Tabel.csv), each sent to the page that replaced
 * it. The rest of that report is left to 404 on purpose: /fullscreen-page/*
 * gallery viewers, /test, /leadinfo, /marketingcalculator and /nieuwsbrief have
 * no counterpart, and redirecting them to something unrelated would only be
 * reported back as a soft 404.
 */
const WIX_PAGES = [
	['/projecten', '/referenties'],
	['/contacteer-one-man-agency', '/contact'],
	['/generativeengineoptimization', '/diensten/seo-en-geo'],
	['/geoscore', '/gratis-marketingscan'],
	['/nieuws-one-man-agency', '/blog']
];

/**
 * Wix posts whose article was rewritten under a new title, so no `legacy_url`
 * points at them. Wix truncated long slugs and kept accents (`én`), so these
 * are the paths exactly as Search Console reported them.
 */
const WIX_POSTS = [
	[
		'/post/een-consistente-huisstijl-verhoogt-herkenbaarheid-én-vertrouwen-leer-hoe-je-met-kleuren-fonts-en-b',
		'/blog/consistente-huisstijl-bouwen'
	],
	[
		'/post/verlaag-niet-je-prijs-maar-verhoog-de-waarde-van-jouw-product-of-dienst',
		'/blog/verhoog-de-waarde-van-je-dienst-of-product'
	],
	['/post/conversieoptimalisatie-hoe-je-website-meer-klanten-oplevert', '/blog/website-conversie-verhogen'],
	[
		'/post/e-mailmarketing-voor-kmo-s-hoe-je-nieuwsbrieven-effectief-inzet',
		'/blog/emailmarketing-voor-lokale-ondernemers'
	],
	[
		'/post/marketing-op-90-minuten-per-week-zo-bouwt-elke-kmo-een-mini-systeem',
		'/blog/marketing-basics-voor-ondernemers-met-weinig-tijd'
	],
	['/post/hoe-adverteren-op-facebook', '/blog/social-media-adverteren-voor-lokale-ondernemers'],
	[
		'/post/lokale-seo-hoe-je-bovenaan-in-google-komt-als-lokale-ondernemer',
		'/blog/lokale-seo-zonder-dure-advertenties'
	]
];

/**
 * Catch-alls, emitted LAST. Cloudflare applies the first rule that matches, in
 * file order — verified with `wrangler dev` — so a splat above a specific rule
 * silently wins. That is how every legacy post once landed on /blog instead of
 * its own article.
 */
const SPLAT_RULES = [
	['/post/*', '/blog'],
	['/blog/page/*', '/blog'],
	['/blog/hashtags/*', '/blog']
];

async function legacyPostRules() {
	const url = process.env.PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

	let posts;
	if (url && key) {
		const db = createClient(url, key, { auth: { persistSession: false } });
		const { data, error } = await db
			.from('posts')
			.select('slug, legacy_url, is_published, published_on')
			.order('slug');
		if (error) throw new Error(`Could not read posts for redirects: ${error.message}`);
		posts = data;
	} else {
		posts = JSON.parse(readFileSync('supabase/seed.json', 'utf8')).posts;
	}

	// Newest first, matching the order posts are rendered in.
	return posts
		.filter((p) => p.is_published !== false && p.legacy_url)
		.sort((a, b) =>
			a.published_on === b.published_on ? 0 : a.published_on < b.published_on ? 1 : -1
		)
		.flatMap((p) => {
			const to = `/blog/${p.slug}`;
			// The Zyro site served posts at the root and the Wix site before it under
			// /post/, and Google still has both. A legacy_url is stored root-level.
			if (p.legacy_url.startsWith('/post/')) return [[p.legacy_url, to]];
			return [
				[p.legacy_url, to],
				[`/post${p.legacy_url}`, to]
			];
		});
}

const rules = [
	...RENAMED,
	...STATIC_RULES,
	...WIX_PAGES,
	...WIX_POSTS,
	...(await legacyPostRules()),
	...SPLAT_RULES
];

// ── write the file ───────────────────────────────────────────────
if (!existsSync(OUTPUT_DIR)) {
	throw new Error(`${OUTPUT_DIR} not found — run this after the build.`);
}

/*
 * A rule pointing at its own path is dropped. `/referenties` → `/referenties`
 * is one, inherited from the reference `_redirects` in dist-original.
 *
 * The previous version of this file claimed such a rule was "a no-op on
 * Cloudflare" and filtered it only out of the Vercel routes. That is not true,
 * and it was never tested: `wrangler dev` answers `/referenties` with a 301 to
 * itself and the browser gives up after ~20 hops. It is a real page, so the
 * result is a dead page rather than a cosmetic wart.
 *
 * This is why the emitted file carries 16 rules where dist-original has 17, and
 * why tools/verify.py expects 16.
 *
 * `/post/*` is a splat, which Cloudflare supports natively. Placeholders and
 * splats count against a limit of 100 dynamic rules (2000 static); this build
 * writes well under twenty.
 */
const emitted = rules.filter(([from, to]) => from !== to);
const selfReferencing = rules.length - emitted.length;
const text = emitted.map(([from, to]) => `${from.padEnd(70)} ${to}  301`).join(NL) + NL;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(`${OUTPUT_DIR}/_redirects`, text, 'utf8');

const dynamic = emitted.filter(([from]) => from.includes('*')).length;
console.log(
	`Wrote ${emitted.length} redirect rules to ${OUTPUT_DIR}/_redirects ` +
		`(${RENAMED.length} renamed, ${STATIC_RULES.length} static, ` +
		`${WIX_PAGES.length + WIX_POSTS.length} Wix, ` +
		`${rules.length - STATIC_RULES.length - RENAMED.length - WIX_PAGES.length - WIX_POSTS.length - SPLAT_RULES.length} legacy post URLs, ` +
		`${dynamic} dynamic` +
		(selfReferencing ? `; dropped ${selfReferencing} self-referencing rule` : '') +
		`).`
);
