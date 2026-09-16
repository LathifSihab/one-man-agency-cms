import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Q3 resolved to Vercel.
 *
 * The public site is fully prerendered at build time (decision D4): every route
 * under / is generated to static HTML from Supabase during `vite build`, so a
 * visitor or crawler never touches the database. The admin application and the
 * handful of API routes it needs (publish hook, form submissions) cannot be
 * static, so they run as serverless functions — which is why this uses
 * adapter-vercel rather than the adapter-static the handover assumed for
 * Cloudflare Pages.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ runtime: 'nodejs22.x', split: true }),
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
