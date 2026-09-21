/**
 * Proof that the publish banner says the right thing in each state.
 *
 * The client asked for two things after hitting a wall with it: a publish that
 * succeeds should say so, rather than presenting a "Opnieuw publiceren" button
 * that reads as though nothing happened; and a publish that fails should
 * explain itself in words rather than quoting an HTTP status.
 *
 * Driven through a real browser because the confirmation depends on component
 * state surviving a sequence — publish, then building, then live — which is
 * exactly the kind of thing that reads correct and behaves otherwise.
 *
 *   npm run test:publish-banner
 *
 * The banner sits behind the admin gate and a Supabase login, so this mounts it
 * behind a temporary route that it writes and then removes. /api/publish is
 * stubbed in the page: nothing is ever really published.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startDevServer } from './_devserver.mjs';

const ROUTE_DIR = 'src/routes/dev-bannercheck';
const PORT = 5601;

const HARNESS = `<script lang="ts">
	// Written by tools/publish-banner-test.mjs. Removed when it finishes.
	import PublishBanner from '$lib/components/admin/PublishBanner.svelte';

	let status = $state('pending');
	let detail = $state('Build voltooid en gepubliceerd.');

	// Publishing must not actually happen here.
	if (typeof window !== 'undefined') {
		const real = window.fetch.bind(window);
		window.fetch = async (input: any, init?: any) => {
			const url = String(typeof input === 'string' ? input : input?.url ?? '');
			if (url.includes('/api/publish')) {
				return new Response(JSON.stringify({ ok: true, build: { id: 'x' } }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
			return real(input, init);
		};
	}

	const now = new Date().toISOString();
	let finished = $state(now);
	const publish = $derived({
		status,
		liveBuiltAt: now,
		pendingChanges: status === 'pending' ? 2 : 0,
		pending:
			status === 'pending'
				? [{ kind: 'Pagina', label: 'Contact', href: null, updatedAt: now }]
				: [],
		lastEditedAt: now,
		lastBuild: {
			status: status === 'building' ? 'building' : status === 'failed' ? 'failed' : 'live',
			triggered_at: now,
			finished_at: status === 'building' ? null : finished,
			detail,
			deployment_id: 'dpl_X'
		}
	});
</script>

<button id="to-building" onclick={() => (status = 'building')}>building</button>
<button
	id="to-live"
	onclick={() => {
		// A finished build has a finished time of its own.
		finished = new Date().toISOString();
		status = 'live';
	}}>live</button
>
<button id="to-stale" onclick={() => (status = 'stale')}>stale</button>
<button
	id="to-failed"
	onclick={() => {
		detail = 'Deploy hook antwoordde met 500';
		status = 'failed';
	}}>failed</button
>

<PublishBanner {publish} />
`;

let failures = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

mkdirSync(ROUTE_DIR, { recursive: true });
writeFileSync(`${ROUTE_DIR}/+page.svelte`, HARNESS, 'utf8');

const { base, stop } = await startDevServer(PORT, '/dev-bannercheck');
let browser;

try {
	browser = await chromium.launch();
	const page = await browser.newPage();
	await page.goto(`${base}/dev-bannercheck`, { waitUntil: 'networkidle' });

	const banner = page.locator('.cms-banner');
	const text = () => banner.innerText();

	/*
	 * Waits for the banner to settle on something, instead of sleeping a fixed
	 * amount and hoping. Publishing awaits invalidateAll(), so a re-render lands
	 * an unpredictable moment later; fixed waits made this test race it and fail
	 * on a component that was behaving correctly.
	 */
	/**
	 * Move the harness to a state and give the component a frame to react.
	 *
	 * Without the pause the test drives states faster than any person could
	 * click, and an assertion that merely waits for text can return before the
	 * effects behind it have run — failing a component that is correct.
	 */
	async function go(id) {
		await page.click(id);
		await page.waitForTimeout(300);
	}

	/** Wait for the publish request and the re-render it awaits to finish. */
	async function settle() {
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(600);
	}

	async function says(name, needle, absent = false) {
		try {
			await page.waitForFunction(
				([n, a]) => {
					const t = document.querySelector('.cms-banner')?.innerText ?? '';
					return a ? !t.includes(n) : t.includes(n);
				},
				[needle, absent],
				{ timeout: 6000 }
			);
			check(name, true);
		} catch {
			check(name, false, JSON.stringify((await text()).replace(/\s+/g, ' ').slice(0, 90)));
		}
	}

	// ── the sequence a real publish goes through ────────────────────────────
	await says('starts by offering to publish', 'sinds de laatste publicatie');
	await page.getByRole('button', { name: 'Publiceren', exact: true }).click();
	// Let the publish settle before driving the next state. triggerPublish awaits
	// invalidateAll(), so a re-render lands some time after the click returns; if
	// the next state change beats it, it arrives mid-sequence and the harness is
	// no longer where the test thinks it is.
	await settle();

	await go('#to-building');
	await says('while building it says so', 'Bezig met publiceren');
	check('and shows a progress bar', (await page.locator('.cms-progress').count()) === 1);

	await go('#to-live');
	await says('reaching live confirms the publish', 'Gepubliceerd');
	await says('and says where the changes are', 'staan nu op de live site');
	check(
		'the republish button is replaced by a way to go and look',
		(await page.getByRole('link', { name: /Bekijk de site/ }).count()) === 1
	);
	check(
		'and it does not offer to publish again',
		(await page.getByRole('button', { name: 'Opnieuw publiceren' }).count()) === 0
	);

	// ── republishing from an already-live site ──────────────────────────────
	//
	// The other way in, and the one someone testing "does it confirm?" reaches
	// first: nothing is pending, the site is up to date, and they press Opnieuw
	// publiceren. The confirmation has to survive that too.
	await page.reload({ waitUntil: 'networkidle' });
	await go('#to-live');
	await says('the site reads as up to date', 'De site is bijgewerkt');
	check(
		'a live site offers to republish',
		(await page.getByRole('button', { name: 'Opnieuw publiceren' }).count()) === 1
	);
	await page.getByRole('button', { name: 'Opnieuw publiceren' }).click();
	await settle();
	await go('#to-building');
	await says('the republish starts a build', 'Bezig met publiceren');
	await go('#to-live');
	await says('republishing confirms too', 'Gepubliceerd');

	// ── a failure has to read like a sentence ───────────────────────────────
	await go('#to-failed');
	await says('a failure is shown', 'Publiceren is niet gelukt');
	const failed = await text();
	check('a failure leads with what happened', failed.includes('Publiceren is niet gelukt'));
	check('says it in words, not a status code', failed.includes('De hosting nam de opdracht'));
	check('keeps the raw detail out of the editor’s way', !failed.includes('Deploy hook antwoordde'));
	check('and reassures that the work is safe', failed.includes('niet verloren'));
	check(
		'offering a retry',
		(await page.getByRole('button', { name: /Probeer opnieuw/ }).count()) === 1
	);

	// ── waiting for promotion is a wait, not a failure ──────────────────────
	await go('#to-stale');
	await says('the wait is shown', 'Even wachten');
	const stale = await text();
	check('a slow promotion reads as waiting', stale.includes('Even wachten'));
	check('not as a rebuild in progress', !stale.includes('wordt opnieuw opgebouwd'));
	check('with no progress bar', (await page.locator('.cms-progress').count()) === 0);
	check(
		'and is not coloured as an error',
		(await banner.getAttribute('class')).includes('pending')
	);
} finally {
	if (browser) await browser.close();
	stop();
	rmSync(ROUTE_DIR, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
