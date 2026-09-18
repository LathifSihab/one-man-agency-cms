/**
 * Proof that a destructive action cannot run without its confirmation.
 *
 * The CMS asks before it deletes, but that question used to live only in an
 * `onsubmit` handler on a hydrated component: a submit that reached the server
 * without passing through the dialog was obeyed. That deleted a real blog post
 * during testing. $lib/server/confirm.ts closed it; this checks that it stays
 * closed.
 *
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… node tools/confirm-guard-e2e.mjs --base <url>
 *
 * Like tools/admin-e2e.mjs this runs against a real database, so it brings its
 * own data: it creates a throwaway draft, tries to delete it the wrong way,
 * checks it survived, then deletes it the right way and checks it is gone. It
 * never touches a post it did not create.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const i = args.indexOf(name);
	return i === -1 ? fallback : args[i + 1];
};

function fromEnvFile(key) {
	if (process.env[key]) return process.env[key];
	if (!existsSync('.env')) return undefined;
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const t = line.trim();
		if (t && !t.startsWith('#') && t.includes('=')) {
			const [k, v] = t.split(/=(.*)/s);
			if (k.trim() === key) return v.trim().replace(/^["']|["']$/g, '');
		}
	}
}

const BASE = (flag('--base', process.env.BASE) ?? '').replace(/\/$/, '');
const EMAIL = fromEnvFile('ADMIN_EMAIL');
const PASSWORD = fromEnvFile('ADMIN_PASSWORD');

if (!BASE) {
	console.error('Pass --base <url>, e.g. --base http://localhost:5173');
	process.exit(2);
}
if (!EMAIL || !PASSWORD) {
	console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD, in the environment or .env.');
	process.exit(2);
}

const failures = [];
function check(label, ok, detail = '') {
	console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`);
	if (!ok) failures.push(label);
	return ok;
}

const SLUG = `guard-throwaway-${Date.now()}`;
/*
 * The admin sits behind an HTTP Basic gate on deployed hosts (see
 * $lib/server/gate.ts). Without these the browser gets a 401 and every check
 * below fails on a login screen that never rendered.
 */
const GATE_USER = fromEnvFile('ADMIN_GATE_USER');
const GATE_PASSWORD = fromEnvFile('ADMIN_GATE_PASSWORD');
const httpCredentials =
	GATE_USER && GATE_PASSWORD ? { username: GATE_USER, password: GATE_PASSWORD } : undefined;

const browser = await chromium.launch();
const page = await browser.newContext({ httpCredentials }).then((c) => c.newPage());

await page.goto(`${BASE}/admin/login`);
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL('**/admin', { timeout: 60000 });
check('sign in', true);

// ── bring our own data ─────────────────────────────────────────────────────
await page.goto(`${BASE}/admin/blog`);
// The create form is behind the "Nieuw artikel" toggle.
await page.getByRole('button', { name: /Nieuw artikel/i }).click();
await page.fill('input[name=title]', 'Guard throwaway');
await page.fill('input[name=slug]', SLUG);
await page.click('form[action="?/create"] button[type=submit]');
await page.waitForURL(new RegExp(`/admin/blog/${SLUG}`), { timeout: 30000 });
check('the throwaway draft was created', page.url().includes(SLUG), SLUG);

/** Does the post still exist? The editor 404s when it does not. */
async function exists() {
	const res = await page.request.get(`${BASE}/admin/blog/${SLUG}`);
	return res.status() === 200;
}

// ── the unguarded submit: exactly what a pre-hydration click sends ─────────
//
// A plain form post, with no dialog and no use:enhance in front of it. The
// status is not the assertion: SvelteKit answers an unenhanced submit by
// re-rendering the page with the failure on it, which is HTTP 200 and correct.
// What matters is that the row survived and the refusal was reported.
const raw = await page.request.post(`${BASE}/admin/blog/${SLUG}?/delete`, { form: {} });
const said = (await raw.text()).includes('bevestiging ontbrak');
check('an unconfirmed delete says why it refused', said, `HTTP ${raw.status()}`);
check('...and the post is still there', await exists());

// ── the same request with the field the dialog attaches ────────────────────
const confirmed = await page.request.post(`${BASE}/admin/blog/${SLUG}?/delete`, {
	form: { confirmed: 'yes' },
	headers: { 'x-sveltekit-action': 'true' }
});
check('a confirmed delete goes through', confirmed.status() < 400, `HTTP ${confirmed.status()}`);
check('...and the post is gone', !(await exists()));

await browser.close();

console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
