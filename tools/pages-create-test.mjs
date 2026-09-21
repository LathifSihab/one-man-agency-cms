/**
 * Proof that adding a page from the CMS produces a valid, sane page.
 *
 * Pages could be edited but never created, so every new service meant a row
 * written by hand and a code change to the menu. The create action fills in the
 * columns the database will not accept empty — seo_title has a 62 character
 * limit, meta_description 158, intro and body are NOT NULL — which is exactly
 * the kind of thing that works for a short title and fails for a real one.
 *
 *   npm run test:pages-create
 *
 * Runs the real action against the real database and deletes what it makes.
 * Every page it creates carries a slug starting "zz-test-", and the run fails
 * loudly if any survive.
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

const PREFIX = 'zz-test-';
let failures = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const mod = await server.ssrLoadModule('/src/routes/admin/pages/+page.server.ts');
const create = mod.actions.create;

/** The action takes a request; nothing else about the event is touched. */
const call = (fields) => {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	return create({ request: new Request('http://localhost/admin/pages?/create', { method: 'POST', body }) });
};

/** A thrown Redirect is how SvelteKit signals success here. */
const isRedirect = (e) => e && typeof e === 'object' && 'status' in e && 'location' in e;

const slug = `${PREFIX}${Date.now().toString(36)}`;

try {
	// ── refusals ────────────────────────────────────────────────────────────
	check('an unknown kind is refused', (await call({ type: 'nonsense', title: 'X', slug })).status === 400);
	check('a missing title is refused', (await call({ type: 'service', title: '  ', slug })).status === 400);

	const bad = await call({ type: 'service', title: 'X', slug: 'Met Spaties' });
	check('an invalid address is refused', bad.status === 400, bad.data?.message ?? '');

	const dup = await call({ type: 'service', title: 'X', slug: 'webdesign' });
	check('an address already in use is refused', dup.status === 400, dup.data?.message ?? '');

	// ── the real thing, with a title long enough to break the limits ────────
	const longTitle =
		'Videomarketing en videoproductie voor kmo’s in Oost-Vlaanderen en ruimer Vlaanderen';
	let redirected = null;
	try {
		await call({ type: 'service', title: longTitle, slug });
	} catch (e) {
		if (isRedirect(e)) redirected = e;
		else throw e;
	}
	check('creating a service redirects into the editor', redirected?.location === `/admin/pages/service/${slug}`);

	const { data: made, error } = await db
		.from('pages')
		.select('*')
		.eq('type', 'service')
		.eq('slug', slug)
		.maybeSingle();
	check('the page exists', Boolean(made) && !error);

	if (made) {
		check('the long title is kept in full', made.title === longTitle);
		check('seo_title fits the 62 character limit', made.seo_title.length <= 62, `${made.seo_title.length}`);
		check('meta_description fits the 158 limit', made.meta_description.length <= 158);
		check('intro and body are present, not null', made.intro === '' && made.body === '');
		check('a new service joins the services list', made.in_services === true);
		check('with a heading to sit under', Boolean(made.menu_group));
		check('and a position after the others', typeof made.menu_order === 'number' && made.menu_order > 10);
		check('it is kept out of Google until written', made.noindex === true);
		check('and flagged as needing work', Boolean(made.todo_note));
	}

	// A plain page is not a service.
	const pageSlug = `${slug}-p`;
	try {
		await call({ type: 'page', title: 'Tijdelijke testpagina', slug: pageSlug });
	} catch (e) {
		if (!isRedirect(e)) throw e;
	}
	const { data: plain } = await db
		.from('pages')
		.select('in_services, menu_group')
		.eq('type', 'page')
		.eq('slug', pageSlug)
		.maybeSingle();
	check('a plain page does not join the services list', plain?.in_services === false);
} finally {
	await server.close();
	const { data: leftovers } = await db.from('pages').select('id, slug').like('slug', `${PREFIX}%`);
	for (const row of leftovers ?? []) await db.from('pages').delete().eq('id', row.id);
	const { data: after } = await db.from('pages').select('id').like('slug', `${PREFIX}%`);
	const clean = (after ?? []).length === 0;
	if (!clean) failures++;
	console.log(`${clean ? 'PASS' : 'FAIL'}  every test page is removed again`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
