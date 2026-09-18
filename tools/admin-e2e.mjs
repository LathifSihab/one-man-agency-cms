/**
 * Browser checks for the CMS.
 *
 * The admin needs a session and server routes, so unlike tools/responsive.mjs
 * it cannot run against a folder of files — point it at a deployment or a dev
 * server.
 *
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… node tools/admin-e2e.mjs --base <url>
 *
 * Credentials are read from the environment, falling back to .env. They are
 * never written here.
 *
 * The destructive checks act on a throwaway image this script uploads first and
 * removes at the end. An earlier version clicked delete on whatever happened to
 * be first in the library and destroyed three real files: a test that runs
 * against a live CMS must bring its own data.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
	console.error('Pass --base <url>, e.g. --base https://example.vercel.app');
	process.exit(2);
}
if (!EMAIL || !PASSWORD) {
	console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD, in the environment or .env.');
	process.exit(2);
}

const failures = [];
const check = (name, condition, detail = '') => {
	console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ' + detail : ''}`);
	if (!condition) failures.push(name);
};

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
const page = await browser
	.newContext({ viewport: { width: 1280, height: 900 }, httpCredentials })
	.then((c) => c.newPage());

/* Any window.confirm or alert reaching the browser is itself the failure. */
let nativeDialogs = 0;
page.on('dialog', async (d) => {
	nativeDialogs++;
	await d.dismiss();
});

// ── sign in ────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/admin/login`);
await page.fill('#email', EMAIL);
await page.fill('#password', PASSWORD);
await Promise.all([page.waitForURL('**/admin'), page.click('button[type=submit]')]);
check('sign in', page.url().endsWith('/admin'));

const dialog = page.locator('dialog.cms-confirm');

// ── media library ──────────────────────────────────────────────────────────
await page.goto(`${BASE}/admin/media`);
await page.waitForLoadState('networkidle');

check('"Kopieer pad" is gone', (await page.getByRole('button', { name: /Kopieer pad/i }).count()) === 0);
const replaceCount = await page.getByRole('button', { name: 'Vervangen' }).count();
check('replace buttons rendered', replaceCount > 0, `${replaceCount} images`);

/* A 1x1 PNG, uploaded so the delete checks have something of their own to act
   on. Named distinctly so it is obvious in the library if cleanup ever fails. */
const FIXTURE = `e2e-throwaway-${Date.now()}.png`;
const fixturePath = join(tmpdir(), FIXTURE);
writeFileSync(
	fixturePath,
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
		'base64'
	)
);

await page.setInputFiles('#u-file', fixturePath);
await page.selectOption('#u-prefix', 'site');
await page.click('form[action="?/upload"] button[type=submit]');

/* Wait for the card itself rather than a fixed pause: the upload is a form
   action plus a round trip to Storage, and a timeout tuned on one network is
   how a test starts reporting failures that are really just impatience. */
const card = page.locator('.cms-logo', { hasText: FIXTURE });
await card.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
check('the throwaway image uploaded', (await card.count()) === 1, FIXTURE);

const itemsBefore = await page.locator('.cms-logo').count();

await card.getByRole('button', { name: 'Wis' }).click();
await dialog.waitFor({ state: 'visible', timeout: 5000 });
check('delete opens the CMS dialog', await dialog.isVisible());
check('the heading names the file', (await dialog.locator('h2').innerText()).includes(FIXTURE));
check(
	'focus starts on the safe choice',
	(await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Annuleren'
);

await page.keyboard.press('Escape');
await dialog.waitFor({ state: 'hidden', timeout: 5000 });
check('Escape cancels', !(await dialog.isVisible()));
check('nothing was deleted', (await page.locator('.cms-logo').count()) === itemsBefore, `${itemsBefore} items`);

await card.getByRole('button', { name: 'Wis' }).click();
await dialog.waitFor({ state: 'visible', timeout: 5000 });
await page.getByRole('button', { name: 'Annuleren' }).click();
await dialog.waitFor({ state: 'hidden', timeout: 5000 });
check('Annuleren cancels', (await page.locator('.cms-logo').count()) === itemsBefore);

/* Confirming really does delete — checked on the throwaway, which also serves
   as the cleanup. */
await card.getByRole('button', { name: 'Wis' }).click();
await dialog.waitFor({ state: 'visible', timeout: 5000 });
await page.getByRole('button', { name: 'Verwijderen' }).click();
await card.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
check('confirming deletes', (await page.locator('.cms-logo', { hasText: FIXTURE }).count()) === 0);
check('only the throwaway went', (await page.locator('.cms-logo').count()) === itemsBefore - 1);

rmSync(fixturePath, { force: true });

// ── every screen with a destructive action ─────────────────────────────────
for (const path of ['/admin/logos', '/admin/submissions']) {
	await page.goto(BASE + path);
	await page.waitForLoadState('networkidle');
	check(`${path} mounts the dialog`, (await page.locator('dialog.cms-confirm').count()) === 1);
}

await page.goto(`${BASE}/admin/blog`);
await page.waitForLoadState('networkidle');
const firstPost = page.locator('table a').first();
await Promise.all([page.waitForURL(/\/admin\/blog\/.+/), firstPost.click()]);
await page.waitForLoadState('networkidle');
check('/admin/blog/[slug] mounts the dialog', (await page.locator('dialog.cms-confirm').count()) === 1);

await page.getByRole('button', { name: /Artikel verwijderen/i }).click();
await dialog.waitFor({ state: 'visible', timeout: 5000 });
check('post delete opens the CMS dialog', await dialog.isVisible());
await page.keyboard.press('Escape');

check('no browser dialog was ever used', nativeDialogs === 0, `${nativeDialogs} seen`);

await browser.close();

console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
