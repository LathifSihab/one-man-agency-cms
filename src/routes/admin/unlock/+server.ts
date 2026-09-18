import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { GATE_COOKIE, GATE_MAX_AGE, gateToken, same } from '$lib/server/gate';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Open the gate on this device.
 *
 *   /admin/unlock?k=<ADMIN_GATE_KEY>
 *
 * Sets a long-lived cookie and sends the visitor on to the CMS, so the gate is
 * something you pass once per device rather than a second password typed at
 * every sign-in. Wrong or missing key looks exactly like any other unknown
 * address: nothing here confirms that the address means anything.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const key = env.ADMIN_GATE_KEY;
	const given = url.searchParams.get('k') ?? '';

	if (!key || !given || !same(given, key)) {
		return new Response('Not found\n', {
			status: 404,
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'no-store',
				'x-robots-tag': 'noindex, nofollow'
			}
		});
	}

	cookies.set(GATE_COOKIE, gateToken(key), {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: GATE_MAX_AGE
	});

	// The key must not survive in history or a referrer, so leave it behind.
	throw redirect(303, '/admin');
};
