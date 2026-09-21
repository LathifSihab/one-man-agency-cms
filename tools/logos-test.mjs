/**
 * Proof that a logo name can be typed without the card vanishing.
 *
 * The logos screen groups the unnamed logos first and offers "Toon enkel deze",
 * which sets the search to "Klant" — the placeholder name. The search then ran
 * live against the name, so the first letter of a real name stopped matching and
 * the card being edited disappeared from under the cursor. The typed name was
 * still held in state and would still have saved, which made it worse: it looked
 * like the work had been lost. The client reported exactly that.
 *
 * The fix snapshots the matching set when the search changes. The first attempt
 * at it did not work: untracking the array reference alone still tracks every
 * name the filter reads, because $state is a deep proxy, so the effect re-ran on
 * each keystroke and re-snapshotted. Nothing but driving a real browser would
 * have shown that, hence this.
 *
 *   npm run test:logos
 *
 * Mounts the real component behind a temporary route, because the screen itself
 * sits behind the admin gate and a Supabase login. The route is written before
 * the run and removed after it, and nothing is ever submitted.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROUTE_DIR = 'src/routes/dev-logocheck';
const PORT = 5599;

const HARNESS = `<script lang="ts">
	// Written by tools/logos-test.mjs. Removed when it finishes.
	import LogosPage from '../admin/logos/+page.svelte';
	const data = {
		logos: [
			{ id: 'a', name: 'Klant', file_path: 'logos/a.png', sort_order: 0 },
			{ id: 'b', name: 'Klant', file_path: 'logos/b.png', sort_order: 1 },
			{ id: 'c', name: 'NeoKraft', file_path: 'logos/c.png', sort_order: 2 },
			{ id: 'd', name: 'Klant', file_path: 'logos/d.png', sort_order: 3 }
		],
		unlinked: []
	};
</script>

<LogosPage {data} form={null} />
`;

let failures = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

mkdirSync(ROUTE_DIR, { recursive: true });
writeFileSync(`${ROUTE_DIR}/+page.svelte`, HARNESS, 'utf8');

const vite = spawn('npx', ['vite', 'dev', '--port', String(PORT), '--strictPort'], {
	stdio: 'ignore',
	shell: process.platform === 'win32'
});

const base = `http://localhost:${PORT}`;
let browser;

try {
	// Wait for the dev server rather than sleeping a fixed amount.
	const deadline = Date.now() + 60000;
	for (;;) {
		try {
			const res = await fetch(`${base}/dev-logocheck`);
			if (res.ok) break;
		} catch {
			/* not up yet */
		}
		if (Date.now() > deadline) throw new Error('vite dev did not start in time');
		await new Promise((r) => setTimeout(r, 500));
	}

	browser = await chromium.launch();
	const page = await browser.newPage();
	await page.goto(`${base}/dev-logocheck`, { waitUntil: 'networkidle' });

	const cards = () => page.locator('.cms-logo input[type=text]');
	check('the screen renders its logo cards', (await cards().count()) === 4);

	await page.getByRole('button', { name: 'Toon enkel deze' }).click();
	await page.waitForTimeout(250);
	check('"Toon enkel deze" narrows to the unnamed ones', (await cards().count()) === 3);

	const first = cards().first();
	await first.click();
	await first.fill('N');
	await page.waitForTimeout(250);
	check('the card survives the first keystroke', (await cards().count()) === 3);

	await first.fill('NeoKraft BV');
	await page.waitForTimeout(250);
	check('and a whole name', (await cards().count()) === 3);
	check('what was typed is still there', (await first.inputValue()) === 'NeoKraft BV');
	check(
		'and the field still has focus',
		await first.evaluate((el) => el === document.activeElement)
	);
	check(
		'the name reaches what would be saved',
		(await page.locator('input[name=logos]').inputValue()).includes('NeoKraft BV')
	);

	// Deliberate: searching again is how the list is refreshed.
	await page.getByRole('button', { name: 'Toon enkel deze' }).click();
	await page.waitForTimeout(250);
	check('searching again drops the one now named', (await cards().count()) === 2);
} finally {
	if (browser) await browser.close();
	vite.kill();
	rmSync(ROUTE_DIR, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
