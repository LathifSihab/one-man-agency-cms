/**
 * Proof that a quote request arrives intact.
 *
 * The form asks about twenty-five things, only some of which apply to any one
 * visitor, and the services question can be ticked several times. /api/submit
 * accepts a fixed list of names and drops everything else, so a field renamed on
 * the form and not here is lost silently — the visitor sees the thank-you page
 * and the answer is simply gone.
 *
 *   npm run test:quote-form
 *
 * Posts to the real endpoint against the real database and deletes what it
 * makes. Every test submission is written under a marker name and the run fails
 * if any survive.
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

const MARKER = 'ZZ-TEST-AANVRAAG';
let failures = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const api = await server.ssrLoadModule('/src/routes/api/submit/+server.ts');
const { FIELDS } = await server.ssrLoadModule('/src/lib/server/submissions.ts');

/** Every name the form actually puts on the wire. */
const formNames = () => {
	const html = readFileSync('src/lib/components/QuoteForm.svelte', 'utf8');
	return [...html.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]);
};

const post = (fields) => {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) {
		for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
	}
	return api.POST({
		request: new Request('http://localhost/api/submit', { method: 'POST', body }),
		getClientAddress: () => `10.0.0.${Math.floor(Math.random() * 250)}`
	});
};

const isRedirect = (e) => e && typeof e === 'object' && 'status' in e && 'location' in e;
const send = async (fields) => {
	try {
		await post(fields);
		return null;
	} catch (e) {
		if (isRedirect(e)) return e.location;
		throw e;
	}
};

const full = {
	variant: 'offerte',
	diensten: ['Website of webshop', 'Social media', 'Foto & video'],
	huidige_website: 'www.testzaak.be',
	website_soort: 'Een webshop',
	website_materiaal: 'Deels klaar',
	social_kanalen: 'Facebook en Instagram',
	social_soort: 'Volledig beheer',
	fotovideo_onderwerp: 'De werkplaats',
	fotovideo_vorm: 'Allebei',
	start_termijn: 'Binnen een maand',
	budget: 'Er is ruimte voor een degelijk traject',
	bedrijf: 'Testzaak BV',
	btw: 'BE 0123.456.789',
	naam: MARKER,
	functie: 'Zaakvoerder',
	email: 'test@example.invalid',
	telefoon: '0495 00 00 00',
	adres: 'Teststraat 1',
	postcode_gemeente: '9200 Dendermonde',
	hoe_gevonden: 'Via Google of een AI-assistent',
	opmerkingen: 'Dit is een test.',
	privacy: 'ja'
};

try {
	// ── every name on the form is a name the endpoint keeps ─────────────────
	const accepted = new Set(FIELDS.offerte);
	const ignored = ['variant', 'website_url']; // the hidden variant and the honeypot
	const onForm = [...new Set(formNames().filter((n) => !ignored.includes(n)))];
	const dropped = onForm.filter((n) => !accepted.has(n));
	check('no field on the form is dropped by the endpoint', dropped.length === 0, dropped.join(', '));
	const unused = [...accepted].filter((n) => !onForm.includes(n));
	check('and the endpoint expects nothing the form does not send', unused.length === 0, unused.join(', '));

	// ── a full request round-trips ──────────────────────────────────────────
	check('a complete request is accepted', (await send(full)) === '/bedankt');

	const { data: rows } = await db
		.from('submissions')
		.select('id, variant, payload')
		.order('created_at', { ascending: false })
		.limit(5);
	const mine = (rows ?? []).find((r) => r.payload?.naam === MARKER);
	check('it is stored', Boolean(mine));

	if (mine) {
		check('under the offerte variant', mine.variant === 'offerte');
		check('the ticked services are kept as a list', Array.isArray(mine.payload.diensten));
		check('with all three of them', (mine.payload.diensten ?? []).length === 3, JSON.stringify(mine.payload.diensten));
		check('the conditional answers survive', mine.payload.website_soort === 'Een webshop');
		check('and so do the contact details', mine.payload.postcode_gemeente === '9200 Dendermonde');
		check('the btw number is kept for the quote', mine.payload.btw === 'BE 0123.456.789');
		const missing = onForm.filter((n) => full[n] !== undefined && mine.payload[n] === undefined);
		check('nothing sent is missing from the record', missing.length === 0, missing.join(', '));
	}

	// ── the guards still apply ──────────────────────────────────────────────
	check(
		'a request without a name is refused',
		(await send({ ...full, naam: '' })) === '/formulier-fout'
	);
	check(
		'the honeypot is still a trap',
		(await send({ ...full, naam: `${MARKER}-bot`, website_url: 'http://spam' })) === '/bedankt'
	);
	const { data: bot } = await db.from('submissions').select('id').eq('payload->>naam', `${MARKER}-bot`);
	check('and a caught bot stores nothing', (bot ?? []).length === 0);
} finally {
	await server.close();
	const { data: leftovers } = await db
		.from('submissions')
		.select('id, payload')
		.like('payload->>naam', `${MARKER}%`);
	for (const row of leftovers ?? []) await db.from('submissions').delete().eq('id', row.id);
	const { data: after } = await db.from('submissions').select('id').like('payload->>naam', `${MARKER}%`);
	const clean = (after ?? []).length === 0;
	if (!clean) failures++;
	console.log(`${clean ? 'PASS' : 'FAIL'}  every test request is removed again`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
