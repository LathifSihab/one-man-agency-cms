/**
 * Inject the 301 redirects into the Vercel build output.
 *
 * Q3 resolved to Vercel, so the reference's Cloudflare `_redirects` file does
 * nothing here. The rules are generated at build time instead — ten static
 * legacy paths plus one per post `legacy_url`, so a new post with a legacy URL
 * is covered automatically without anyone editing a config file.
 *
 * They are prepended to the adapter's route list so they run before the
 * filesystem handler. Run as `postbuild`.
 *
 * A plain-text `_redirects` is written alongside them purely as a portable
 * record of the same rules (and so the acceptance check can read them).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const CONFIG = '.vercel/output/config.json';
const STATIC = '.vercel/output/static';

/** The ten legacy paths from the old Zyro site. Order matters: /post/* is last. */
const STATIC_RULES = [
	['/diensten-one-man-agency', '/diensten'],
	['/marketingbureau-prijzen', '/prijzen'],
	['/pakketten', '/prijzen'],
	['/marketingbureau-kmo', '/over-niels'],
	['/referenties', '/referenties'],
	['/vragen', '/veelgestelde-vragen'],
	['/offerte-or-contact', '/contact'],
	['/gratis-marketing-scan', '/gratis-marketingscan'],
	['/webdesign', '/diensten/webdesign'],
	['/post/*', '/blog']
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
		.map((p) => [p.legacy_url, `/blog/${p.slug}`]);
}

const rules = [...STATIC_RULES, ...(await legacyPostRules())];

// ── Vercel routes ───────────────────────────────────────────────────────────
if (!existsSync(CONFIG)) {
	throw new Error(`${CONFIG} not found — run this after the build.`);
}
const config = JSON.parse(readFileSync(CONFIG, 'utf8'));

const routes = rules.map(([from, to]) => ({
	// `/post/*` is a prefix match; everything else is exact.
	src: from.endsWith('/*') ? `^${from.slice(0, -2)}/.*$` : `^${from}$`,
	status: 301,
	headers: { Location: to }
}));

// Drop any previously injected rules so repeated runs stay idempotent.
const existing = (config.routes ?? []).filter((r) => !r.__redirect);
for (const r of routes) r.__redirect = true;
config.routes = [...routes, ...existing];

writeFileSync(CONFIG, JSON.stringify(config, null, 1), 'utf8');

// ── portable record of the same rules ───────────────────────────────────────
const text = rules.map(([from, to]) => `${from.padEnd(70)} ${to}  301`).join('\n') + '\n';
writeFileSync(`${STATIC}/_redirects`, text, 'utf8');

console.log(`Injected ${rules.length} redirects (${STATIC_RULES.length} static, ${rules.length - STATIC_RULES.length} legacy post URLs).`);
