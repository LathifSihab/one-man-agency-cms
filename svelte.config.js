import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Q3 resolved to Vercel, and then to Cloudflare Workers.
 *
 * The public site is fully prerendered at build time (decision D4): every route
 * under / is generated to static HTML from Supabase during `vite build`, so a
 * visitor or crawler never touches the database. The admin application and the
 * handful of API routes it needs (publish hook, form submissions) cannot be
 * static, so they run as a Worker — which is what the handover originally
 * assumed, before the detour through Vercel.
 *
 * Why the move: Vercel's Hobby plan forbids commercial use and this is a
 * commercial site, so staying there meant EUR 20/month. Cloudflare's free tier
 * carries no such restriction. See deployment/02-CLOUDFLARE-PAGES.md.
 *
 * Output goes to .svelte-kit/cloudflare — static assets and _worker.js in one
 * directory, both referenced from wrangler.jsonc. Several tools write into that
 * directory after the build; they share the path through tools/output.mjs.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		prerender: {
			// A missing page must fail the build, not ship a 30-page site.
			handleHttpError: 'fail',
			handleMissingId: 'fail'
		},
		alias: {
			$components: 'src/lib/components'
		}
	}
};

export default config;
