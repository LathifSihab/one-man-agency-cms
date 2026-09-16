import { SITE } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

/**
 * The explicit AI-crawler allowances are deliberate: the site sells GEO, and
 * being cited by AI assistants is half its purpose. Do not tighten these.
 */
export const GET: RequestHandler = async () => {
	const body =
		'User-agent: *\nAllow: /\n\n' +
		'# AI-crawlers zijn welkom: dat is het punt van GEO.\n' +
		'User-agent: GPTBot\nAllow: /\n' +
		'User-agent: PerplexityBot\nAllow: /\n' +
		'User-agent: ClaudeBot\nAllow: /\n' +
		'User-agent: Google-Extended\nAllow: /\n\n' +
		`Sitemap: ${SITE}/sitemap.xml\n`;

	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
