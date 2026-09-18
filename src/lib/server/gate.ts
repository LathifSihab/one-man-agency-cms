import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * A gate in front of the whole admin, so an anonymous request never receives
 * the login page.
 *
 * Why it exists: Google Safe Browsing flagged this deployment for "phishing on
 * user login". A credential form served from a generic *.vercel.app subdomain
 * is indistinguishable from a phishing kit, and while onemanagency.be still
 * points elsewhere there is nothing for Google to reconcile it against.
 * robots.txt and noindex do not help — they govern indexing, and Safe Browsing
 * scans regardless. The only fix is that the form must not be fetchable.
 *
 * It is unlocked once per device with a link, not a password:
 *
 *   /admin/unlock?k=<ADMIN_GATE_KEY>   sets a long-lived cookie, then redirects
 *
 * That replaced HTTP Basic, which put a second username and password in front
 * of a CMS that already has one. Two sets of credentials on a single-account
 * CMS is how people end up locked out of their own site, and the browser's
 * native dialog looks like exactly the thing it was protecting against.
 *
 * Sharing the CMS password with the gate was considered and rejected. The gate
 * runs before any Supabase client exists, so matching it would mean keeping the
 * account password in plain text in an environment variable — a second,
 * reversible copy of a credential Supabase only ever stores hashed — and it
 * would lock the gate the moment the password was changed in the CMS.
 *
 * This is a doormat, not the lock. The Supabase session behind it is unchanged.
 */

const COOKIE = 'oma_gate';
const MAX_AGE = 60 * 60 * 24 * 180; // half a year; long enough to forget about

/** The unlock route has to be reachable, or the gate can never be opened. */
const OPEN_PATHS = new Set(['/admin/unlock']);

/** Requests from a developer's own machine are never gated. */
function isLocal(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** What the cookie must contain. Never the key itself. */
export function gateToken(key: string): string {
	return createHash('sha256').update(`oma-gate:v1:${key}`).digest('hex').slice(0, 32);
}

export const GATE_COOKIE = COOKIE;
export const GATE_MAX_AGE = MAX_AGE;

/** Constant-time comparison, so a wrong value leaks no prefix. */
export function same(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/**
 * Nothing here.
 *
 * A 404 rather than a 401: a 401 makes the browser raise its own sign-in
 * dialog, which is both the confusing part and a hint that something worth
 * attacking is behind it. Plain text, no branding, no form, nothing for a
 * classifier to read as a login page.
 */
function notFound(): Response {
	return new Response('Not found\n', {
		status: 404,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store',
			'x-robots-tag': 'noindex, nofollow'
		}
	});
}

/**
 * Check the gate for one request. Returns a response to send, or null to pass.
 *
 * With no key configured the gate is off, which keeps local development and the
 * browser tooling working — and is why the deployment must set one. A missing
 * variable reopens the hole rather than locking the client out of their own
 * CMS, which is the right way round for a doormat.
 */
export function gateAdmin(request: Request, url: URL): Response | null {
	if (!url.pathname.startsWith('/admin')) return null;
	if (OPEN_PATHS.has(url.pathname)) return null;
	if (isLocal(url.hostname)) return null;

	const key = env.ADMIN_GATE_KEY;
	if (!key) return null;

	const cookie = request.headers.get('cookie') ?? '';
	const found = cookie
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${COOKIE}=`));

	if (!found) return notFound();
	return same(found.slice(COOKIE.length + 1), gateToken(key)) ? null : notFound();
}
