import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/admin';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Trigger a rebuild of the live site.
 *
 * The deploy hook URL is a secret — anyone holding it can start builds — so it
 * is only ever called from here, never from the browser. Requires a logged-in
 * admin, and collapses rapid repeat clicks into a single build.
 */

const COOLDOWN_MS = 60_000;
let lastTriggered = 0;

export const POST: RequestHandler = async ({ locals }) => {
	const user = await locals.getUser?.();
	if (!user) throw error(401, 'Niet aangemeld.');

	const hook = env.DEPLOY_HOOK_URL;
	if (!hook) throw error(500, 'DEPLOY_HOOK_URL is niet ingesteld.');

	// A deploy hook is an api.vercel.com integration URL. Pointing this at, say,
	// a deployment URL would answer 200 and we would report a build that never
	// runs — the one thing the publish flow must never do. Check the shape.
	if (!/^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\//.test(hook)) {
		throw error(
			500,
			'DEPLOY_HOOK_URL is geen geldige Vercel deploy hook. Verwacht een adres dat ' +
				'begint met https://api.vercel.com/v1/integrations/deploy/ — maak er een aan ' +
				'bij Settings > Git > Deploy Hooks.'
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
