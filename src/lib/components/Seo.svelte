<script lang="ts">
	import { SITE } from '$lib/site';
	import { ldJson } from '$lib/schema';

	/**
	 * The per-page <head>. Canonical and og:url are always absolute on the
	 * production domain — a relative canonical is a lesson already learned here.
	 */
	interface Props {
		seoTitle: string;
		metaDescription: string;
		path: string;
		noindex?: boolean;
		schemas?: unknown[];
	}

	let { seoTitle, metaDescription, path, noindex = false, schemas = [] }: Props = $props();
	// The home page's canonical keeps its trailing slash: https://host/
	const canonical = $derived(SITE + path);
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={canonical} />
	<meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="One Man Agency" />
	<meta property="og:locale" content="nl_BE" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content="{SITE}/assets/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
	{#each schemas as schema, i (i)}
		{@html `<script type="application/ld+json">${ldJson(schema)}<\/script>`}
	{/each}
</svelte:head>
