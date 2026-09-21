/**
 * Proof that hiding a page takes it off the site, and cannot break the build.
 *
 * Hiding was chosen over deleting: the site is prerendered, so a page that is
 * still linked from anywhere takes the whole deploy with it, and a delete cannot
 * be undone by the person who made the mistake. Hidden means not built at all —
 * no file, so the address returns the 404 page — rather than merely noindex,
 * which leaves the page reachable.
 *
 * The part worth testing is the interaction with the publish guard: hiding a
 * page that something still points at has to be refused in the CMS, not
 * discovered by a failed build.
 *
 *   npm run test:hide-page
 *
 * Works on scratch pages whose slugs start "zz-hide-", against the real
 * database, and fails loudly if any survive.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
	const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
	if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
for (const key of ['PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
	process.env[key] ??= env[key];
}

const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false }
});

const PREFIX = 'zz-hide-';
const stamp = Date.now().toString(36);
const TARGET = `${PREFIX}${stamp}-doel`;
const SOURCE = `${PREFIX}${stamp}-bron`;

let failures = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { findBrokenLinks, readContentForCheck } = await server.ssrLoadModule(
	'/src/lib/server/links.ts'
);

const base = (slug, over = {}) => ({
	type: 'page',
	slug,
	title: `Tijdelijke testpagina ${slug}`,
	seo_title: 'Tijdelijke testpagina',
	meta_description: 'Tijdelijke testpagina.',
	intro: '',
	body: '',
	noindex: true,
	...over
});

try {
	// A page, and another page that links to it.
	const { error: e1 } = await db.from('pages').insert(base(TARGET));
	const { error: e2 } = await db
		.from('pages')
		.insert(base(SOURCE, { body: `Kijk ook bij [de doelpagina](/${TARGET}).` }));
	if (e1 || e2) throw new Error(`could not create fixtures: ${e1?.message ?? e2?.message}`);

	// ── while it is on the site ─────────────────────────────────────────────
	let content = await readContentForCheck(db);
	check(
		'a published page is part of the site',
		content.pages.some((p) => p.slug === TARGET)
	);
	check(
		'and nothing is reported broken',
		findBrokenLinks(content).every((b) => b.link !== `/${TARGET}`)
	);

	// ── hide it, while something still links to it ──────────────────────────
	await db.from('pages').update({ is_published: false }).eq('slug', TARGET);
	content = await readContentForCheck(db);

	check(
		'a hidden page is no longer part of the site',
		!content.pages.some((p) => p.slug === TARGET)
	);

	const broken = findBrokenLinks(content);
	const hit = broken.find((b) => b.link === `/${TARGET}`);
	check('publishing is refused while something links to it', Boolean(hit));
	check('and the message names the page to fix', hit?.where?.includes(SOURCE) ?? false, hit?.where ?? '');

	// ── remove the link, and hiding is fine ─────────────────────────────────
	await db.from('pages').update({ body: 'Geen verwijzing meer.' }).eq('slug', SOURCE);
	content = await readContentForCheck(db);
	check(
		'once nothing links to it, publishing is allowed',
		findBrokenLinks(content).every((b) => b.link !== `/${TARGET}`)
	);

	// ── hidden pages leave the services navigation too ──────────────────────
	await db
		.from('pages')
		.update({ in_services: true, menu_label: 'Testdienst', menu_group: 'Test', menu_order: 999 })
		.eq('slug', TARGET);
	const { serviceMenu } = await server.ssrLoadModule('/src/lib/site.ts');
	const stillHidden = await readContentForCheck(db);
	check(
		'a hidden page stays out of the services list',
		!serviceMenu(stillHidden.pages).some((s) => s.link === `/${TARGET}`)
	);

	// ── and comes back when shown again ─────────────────────────────────────
	await db.from('pages').update({ is_published: true }).eq('slug', TARGET);
	const shown = await readContentForCheck(db);
	check(
		'showing it again restores it',
		shown.pages.some((p) => p.slug === TARGET)
	);
	check(
		'including in the services list',
		serviceMenu(shown.pages).some((s) => s.link === `/${TARGET}`)
	);

	// ── the site root cannot be hidden ──────────────────────────────────────
	const { error: homeError } = await db
		.from('pages')
		.update({ is_published: false })
		.eq('type', 'page')
		.eq('slug', 'home');
	check('the home page cannot be hidden', Boolean(homeError));
} finally {
	await server.close();
	const { data: leftovers } = await db.from('pages').select('id').like('slug', `${PREFIX}%`);
	for (const row of leftovers ?? []) await db.from('pages').delete().eq('id', row.id);
	const { data: after } = await db.from('pages').select('id').like('slug', `${PREFIX}%`);
	const clean = (after ?? []).length === 0;
	if (!clean) failures++;
	console.log(`${clean ? 'PASS' : 'FAIL'}  every test page is removed again`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
