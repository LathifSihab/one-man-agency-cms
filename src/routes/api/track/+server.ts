import { adminDb } from '$lib/server/admin';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Anonymous page-view collection.
 *
 * The browser sends only the path and the referrer. Everything else — device,
 * country, whether this begins a visit — is derived here from the request, so
 * the client script stays a few hundred bytes and the public site keeps
 * effectively no JavaScript.
 *
 * Nothing identifying is written. The IP address is read to derive a country
 * and then dropped; no cookie, no browser storage, no visitor id. That is a
 * deliberate trade: there is no "unique visitors" number, because producing one
 * means identifying someone, and this site would then need a consent banner.
 */

const SITE_HOST = 'onemanagency.be';

/** Obvious automated traffic, which would otherwise drown the real numbers. */
const BOT = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|preview|monitor|curl|wget|python|scrapy|gptbot|claudebot|perplexity/i;

function deviceFrom(ua: string): 'mobile' | 'tablet' | 'desktop' {
	if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
	if (/mobi|iphone|android.*mobile|phone/i.test(ua)) return 'mobile';
	return 'desktop';
}

/** Host only: a full referring URL can carry search terms and personal detail. */
function referrerHost(referrer: string): string | null {
	if (!referrer) return null;
	try {
		const host = new URL(referrer).hostname.replace(/^www\./, '');
		return host.endsWith(SITE_HOST) ? null : host.slice(0, 120);
	} catch {
		return null;
	}
}

/* A crude ceiling per address, to blunt someone hammering the endpoint. The
   addresses live only in memory, only for the window, and are never stored. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

function overLimit(ip: string): boolean {
	const now = Date.now();
	const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	hits.push(now);
	recent.set(ip, hits);
	if (recent.size > 5000) recent.clear();
	return hits.length > MAX_PER_WINDOW;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Always answer 204: a tracking endpoint must never surface anything to a
	// visitor, and must never delay the page it was called from.
	const ok = new Response(null, { status: 204 });

	try {
		const ua = request.headers.get('user-agent') ?? '';
		if (!ua || BOT.test(ua)) return ok;
		if (request.headers.get('dnt') === '1') return ok;
		if (overLimit(getClientAddress())) return ok;

		const body = await request.json().catch(() => null);
		if (!body || typeof body.p !== 'string') return ok;

		// Trust nothing from the page: keep a plain path and nothing else.
		const path = body.p.split('?')[0].split('#')[0].slice(0, 200);
		if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/admin')) return ok;

		const host = referrerHost(typeof body.r === 'string' ? body.r : '');

		await adminDb()
			.from('page_views')
			.insert({
				path,
				referrer_host: host,
				device: deviceFrom(ua),
				country: request.headers.get('cf-ipcountry')?.slice(0, 2) ?? null,
				is_entry: host !== null || !body.r
			});
	} catch {
		// Statistics are never worth an error in front of a visitor.
	}

	return ok;
};
