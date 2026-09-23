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
const editor = await server.ssrLoadModule('/src/routes/admin/pages/[type]/[slug]/+page.server.ts');

/** Delete a page through the real action. `confirmed` is what the dialog adds. */
const remove = async (type, slug, confirmed = true) => {
	const body = new FormData();
	if (confirmed) body.set('confirmed', 'yes');
	try {
		return await editor.actions.delete({
			request: new Request('http://localhost/admin/pages?/delete', { method: 'POST', body }),
			params: { type, slug }
		});
	} catch (e) {
		if (isRedirect(e)) return e;
		throw e;
	}
};

// Placement writes to the live menus; they are put back exactly as found.
const { data: settingsBefore } = await db
	.from('settings')
	.select('navigation, footer_sectors, footer_regions')
	.eq('id', true)
	.single();

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

	const navNow = async () =>
		(await db.from('settings').select('navigation, footer_sectors').eq('id', true).single()).data;
	check('a page left unlinked stays out of the menu',
		!(await navNow()).navigation.some((n) => n.link === `/${pageSlug}`));

	// ── "gelinkt vanuit" ────────────────────────────────────────────────────
	const load = (type, s) => editor.load({ params: { type, slug: s } });
	const lonely = await load('page', pageSlug);
	check('an unlinked page says it is linked from nowhere', lonely.linkedFrom.length === 0);
	check('and offers the main menu', lonely.menuOptions.some((o) => o.placement === 'menu'));

	const service = await load('service', slug);
	check('a service is linked from the services overview',
		service.linkedFrom.some((w) => w.startsWith('het dienstenoverzicht')), service.linkedFrom.join(' | '));
	check('and is offered no menu', service.menuOptions.length === 0);

	const placeBody = new FormData();
	placeBody.set('placement', 'menu');
	const placed = await editor.actions.placeInMenu({
		request: new Request('http://localhost/?/placeInMenu', { method: 'POST', body: placeBody }),
		params: { type: 'page', slug: pageSlug }
	});
	check('"zet in het hoofdmenu" reports success', placed?.placed === true);
	const after = await load('page', pageSlug);
	check('the page is now linked from the menu', after.linkedFrom.some((w) => w.startsWith('het menu')));
	check('and the button is gone', after.menuOptions.length === 0);
	await editor.actions.placeInMenu({
		request: new Request('http://localhost/?/placeInMenu', { method: 'POST', body: placeBody }),
		params: { type: 'page', slug: pageSlug }
	});
	check('placing it twice adds it once',
		(await navNow()).navigation.filter((n) => n.link === `/${pageSlug}`).length === 1);

	// ── live preview ────────────────────────────────────────────────────────
	const previewMod = await server.ssrLoadModule('/src/routes/admin/preview/+server.ts');
	const previewBody = new FormData();
	previewBody.set('type', 'page');
	previewBody.set('slug_saved', pageSlug);
	previewBody.set('title', 'Voorbeeldtitel');
	previewBody.set('body', 'Nog **niet** opgeslagen.\n\n{{stappen}}');
	const html = await (
		await previewMod.POST({
			request: new Request('http://localhost/admin/preview', { method: 'POST', body: previewBody }),
			url: new URL('http://localhost/admin/preview')
		})
	).text();
	check('the preview shows what is typed', html.includes('Voorbeeldtitel') && html.includes('<strong>niet</strong>'));
	check('with the real blocks, not placeholders', html.includes('Kennismaking van 30 minuten'));
	check('inside the real site chrome', html.includes('Hoofdnavigatie'));
	check('and without the analytics beacon', !html.includes('/api/track'));
	const { data: untouched } = await db.from('pages').select('title').eq('type', 'page').eq('slug', pageSlug).single();
	check('previewing saves nothing', untouched.title === 'Tijdelijke testpagina');

	// ── placement ───────────────────────────────────────────────────────────
	const menuSlug = `${slug}-m`;
	try {
		await call({ type: 'page', title: 'Testpagina in het menu', slug: menuSlug, placement: 'menu' });
	} catch (e) {
		if (!isRedirect(e)) throw e;
	}
	check('"in het hoofdmenu" adds it to the menu',
		(await navNow()).navigation.some((n) => n.link === `/${menuSlug}` && n.label === 'Testpagina in het menu'));

	const sectorSlug = `${slug}-s`;
	try {
		await call({ type: 'sector', title: 'Marketing voor bakkers', slug: sectorSlug, placement: 'footer' });
	} catch (e) {
		if (!isRedirect(e)) throw e;
	}
	check('a sector goes into the footer, without "Marketing voor"',
		(await navNow()).footer_sectors.some((n) => n.link === `/sectoren/${sectorSlug}` && n.label === 'Bakkers'));

	// ── delete ──────────────────────────────────────────────────────────────
	const exists = async (type, s) =>
		Boolean((await db.from('pages').select('id').eq('type', type).eq('slug', s).maybeSingle()).data);

	check('delete without the confirmation is refused', (await remove('page', menuSlug, false)).status === 400);
	check('and the page is still there', await exists('page', menuSlug));

	check('the home page cannot be deleted', (await remove('page', 'home')).status === 400);
	check('nor the 404 page', (await remove('page', '404')).status === 400);

	// A link in another page's text blocks the delete.
	await db.from('pages').update({ body: `Zie [hier](/sectoren/${sectorSlug}).` }).eq('type', 'page').eq('slug', pageSlug);
	const blocked = await remove('sector', sectorSlug);
	check('a page linked from another page’s text is not deleted',
		blocked.status === 400 && (await exists('sector', sectorSlug)), blocked.data?.message ?? '');
	await db.from('pages').update({ body: '' }).eq('type', 'page').eq('slug', pageSlug);

	const gone = await remove('page', menuSlug);
	check('a confirmed delete returns to the page list', gone?.location === '/admin/pages');
	check('the page is gone', !(await exists('page', menuSlug)));
	check('and so is its menu entry', !(await navNow()).navigation.some((n) => n.link === `/${menuSlug}`));

	await remove('sector', sectorSlug);
	check('a deleted sector leaves the footer too',
		!(await navNow()).footer_sectors.some((n) => n.link === `/sectoren/${sectorSlug}`));
} finally {
	await server.close();
	await db.from('settings').update(settingsBefore).eq('id', true);
	const { data: leftovers } = await db.from('pages').select('id, slug').like('slug', `${PREFIX}%`);
	for (const row of leftovers ?? []) await db.from('pages').delete().eq('id', row.id);
	const { data: after } = await db.from('pages').select('id').like('slug', `${PREFIX}%`);
	const clean = (after ?? []).length === 0;
	if (!clean) failures++;
	console.log(`${clean ? 'PASS' : 'FAIL'}  every test page is removed again`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
