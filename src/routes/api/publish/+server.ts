import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/admin';
import {
	explainBrokenLinks,
	explainMissingImages,
	findBrokenLinks,
	findMissingImages,
	readContentForCheck,
	readMediaKeys
} from '$lib/server/links';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Trigger a rebuild of the live site.
 *
 * The deploy hook URL is a secret — anyone holding it can start builds — so it
 * is only ever called from here, never from the browser. Requires a logged-in
 * admin, and collapses rapid repeat clicks into a single build.
 *
 * Cloudflare also skips redundant builds when a hook fires repeatedly before
 * the first one starts. The cooldown below stays regardless: it is what makes
 * the CMS report one build to the editor rather than five.
 */

const COOLDOWN_MS = 60_000;
let lastTriggered = 0;

export const POST: RequestHandler = async ({ locals }) => {
	const user = await locals.getUser?.();
	if (!user) throw error(401, 'Niet aangemeld.');

	const hook = env.DEPLOY_HOOK_URL;
	if (!hook) throw error(500, 'DEPLOY_HOOK_URL is niet ingesteld.');

	// A deploy hook is a Cloudflare Workers Builds hook URL. Pointing this at,
	// say, a deployment URL would answer 200 and we would report a build that
	// never runs — the one thing the publish flow must never do. Check the shape.
	if (!/^https:\/\/api\.cloudflare\.com\/client\/v4\/workers\/builds\/deploy_hooks\//.test(hook)) {
		throw error(
			500,
			'DEPLOY_HOOK_URL is geen geldige Cloudflare deploy hook. Verwacht een adres ' +
				'dat begint met https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/ — ' +
				'maak er een aan bij Workers & Pages > deze Worker > Settings > Builds > Deploy Hooks.'
		);
	}

	const db = adminDb();

	// Five clicks should trigger one build, not five.
	const since = Date.now() - lastTriggered;
	if (since < COOLDOWN_MS) {
		const { data } = await db
			.from('builds')
			.select('*')
			.order('triggered_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		return json({
			ok: true,
			deduped: true,
			wait: Math.ceil((COOLDOWN_MS - since) / 1000),
			build: data
		});
	}

	// A link to a slug that no longer exists fails the prerender and takes the
	// whole deploy with it (svelte.config.js sets handleHttpError: 'fail'). That
	// is worth catching here: from the CMS it reads as a sentence naming the
	// page, instead of arriving later as a Vercel build-failure email. Checked
	// before the build row is written, so a refusal leaves no record behind.
	const [content, mediaKeys] = await Promise.all([readContentForCheck(db), readMediaKeys(db)]);

	const broken = findBrokenLinks(content);
	if (broken.length) {
		return json(
			{ ok: false, brokenLinks: broken, message: explainBrokenLinks(broken) },
			{ status: 409 }
		);
	}

	// Same reasoning, one step further along: tools/fetch-media.mjs fails the
	// build on an image it cannot download, so a picture deleted from the media
	// library while a page still uses it would take the deploy with it.
	const missing = findMissingImages(content, mediaKeys);
	if (missing.length) {
		return json(
			{ ok: false, missingImages: missing, message: explainMissingImages(missing) },
			{ status: 409 }
		);
	}

	const { data: build, error: insertError } = await db
		.from('builds')
		.insert({ status: 'building' })
		.select()
		.single();

	if (insertError) throw error(500, `Kon de build niet registreren: ${insertError.message}`);

	const response = await fetch(hook, { method: 'POST' });

	if (!response.ok) {
		// Report failure honestly and leave the changes pending.
		await db
			.from('builds')
			.update({
				status: 'failed',
				finished_at: new Date().toISOString(),
				detail: `Deploy hook antwoordde met ${response.status}`
			})
			.eq('id', build.id);
		throw error(502, `De bouwopdracht is niet aanvaard (${response.status}).`);
	}

	lastTriggered = Date.now();
	return json({ ok: true, build });
};
