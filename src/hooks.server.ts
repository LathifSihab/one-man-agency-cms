import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { gateAdmin } from '$lib/server/gate';

/**
 * Admin session handling and route guarding.
 *
 * Sessions live in httpOnly cookies via @supabase/ssr — never in localStorage.
 * There is exactly one account (decision D5), so any authenticated user is the
 * admin; there is no roles table to consult.
 */
export const handle: Handle = async ({ event, resolve }) => {
	/*
	 * The Basic gate runs before anything else, including the Supabase client.
	 * An anonymous request to /admin must cost nothing and must never receive
	 * HTML — see $lib/server/gate.ts for why Google flagged the login page.
	 */
	const gated = gateAdmin(event.request, event.url);
	if (gated) return gated;

	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;

	// The public site is prerendered and needs no Supabase client at request time.
	const needsAuth =
		event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/api/');

	if (needsAuth && !(url && anonKey)) {
		// Names only, never values. Without this, a misconfigured environment is
		// indistinguishable from a broken login.
		const missing = [
			!url && 'PUBLIC_SUPABASE_URL',
			!anonKey && 'PUBLIC_SUPABASE_ANON_KEY'
		].filter(Boolean);
		console.error(`[auth] Supabase not configured; missing or empty: ${missing.join(', ')}`);
	}

	if (needsAuth && url && anonKey) {
		event.locals.supabase = createServerClient(url, anonKey, {
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookies) => {
					for (const { name, value, options } of cookies) {
						event.cookies.set(name, value, {
							...options,
							path: '/',
							httpOnly: true,
							sameSite: 'lax',
							secure: event.url.protocol === 'https:'
						});
					}
				}
			}
		});

		/**
		 * getUser() revalidates the JWT with Supabase. getSession() alone only
		 * decodes the cookie, which a client could have forged.
		 */
		event.locals.getUser = async () => {
			const {
				data: { user }
			} = await event.locals.supabase.auth.getUser();
			return user;
		};
	}

	/*
	 * Guard everything under /admin except the two routes that exist to get in.
	 *
	 * /admin/unlock has to be here as well as in the gate: it carries its own
	 * key and its whole job is to run before anyone is signed in. Redirecting it
	 * to the login page meant the cookie was never set, and the redirect then
	 * hit the gate and 404'd — the link appeared to do nothing at all.
	 */
	const WAY_IN = ['/admin/login', '/admin/unlock', '/admin/herstel'];
	const needsSession = !WAY_IN.some((path) => event.url.pathname.startsWith(path));

	if (event.url.pathname.startsWith('/admin') && needsSession) {
		if (!event.locals.getUser) {
			throw redirect(303, '/admin/login?reden=config');
		}
		const user = await event.locals.getUser();
		if (!user) {
			throw redirect(303, `/admin/login?terug=${encodeURIComponent(event.url.pathname)}`);
		}
		event.locals.user = user;
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range'
	});
};

/** Service-role client for privileged server-side writes. Never reaches the browser. */
export function serviceClient() {
	return { url: publicEnv.PUBLIC_SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
}
