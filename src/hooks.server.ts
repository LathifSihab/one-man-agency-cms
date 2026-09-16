import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * Admin session handling and route guarding.
 *
 * Sessions live in httpOnly cookies via @supabase/ssr — never in localStorage.
 * There is exactly one account (decision D5), so any authenticated user is the
 * admin; there is no roles table to consult.
 */
export const handle: Handle = async ({ event, resolve }) => {
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

	// Guard everything under /admin except the login screen itself.
	if (event.url.pathname.startsWith('/admin') && !event.url.pathname.startsWith('/admin/login')) {
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
