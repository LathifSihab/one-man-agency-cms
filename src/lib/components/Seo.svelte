<script lang="ts">
	import { SITE } from '$lib/site';
	import { ldJson, absoluteImage, breadcrumbSchema } from '$lib/schema';

	/**
	 * The per-page <head>. Canonical and og:url are always absolute on the
	 * production domain — a relative canonical is a lesson already learned here.
	 *
	 * Beyond the canonical set, this emits the three things that decide how a
	 * result looks rather than whether it appears: the robots preview directives
	 * (without max-image-preview:large Google shows a thumbnail, not a card), a
	 * real per-page image, and the breadcrumb trail. Pages pass their own crumbs
	 * so the markup matches what the visitor sees in the header.
	 */
	interface Props {
		seoTitle: string;
		metaDescription: string;
		path: string;
		noindex?: boolean;
		schemas?: unknown[];
		/** An image value (repo path or Storage key). Falls back to the site card. */
		image?: string | null;
		/** Alt text for that image, for the people who hear the card read out. */
		imageAlt?: string | null;
		/** 'article' on blog posts; everything else is a page. */
		type?: 'website' | 'article';
		/** Article dates, ISO. Only meaningful when type is 'article'. */
		publishedOn?: string | null;
		modifiedOn?: string | null;
		section?: string | null;
		/** The full breadcrumb trail, root first, this page last. */
		crumbs?: ReadonlyArray<{ name: string; path: string }>;
	}

	let {
		seoTitle,
		metaDescription,
		path,
		noindex = false,
		schemas = [],
		image = null,
		imageAlt = null,
		type = 'website',
		publishedOn = null,
		modifiedOn = null,
		section = null,
		crumbs = []
	}: Props = $props();

	// The home page's canonical keeps its trailing slash: https://host/
	const canonical = $derived(SITE + path);
	const ogImage = $derived(absoluteImage(image));

	/*
	 * A noindexed page gets no preview directives and no breadcrumb markup:
	 * there is no result to dress up, and a BreadcrumbList pointing at a page
	 * Google is told to drop is noise in the graph.
	 */
	const robots = $derived(
		noindex
			? 'noindex, follow'
			: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
	);

	const trail = $derived(noindex || !crumbs.length ? [] : [breadcrumbSchema(crumbs)]);
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={canonical} />
	<meta name="robots" content={robots} />
	<meta property="og:type" content={type} />
	<meta property="og:site_name" content="One Man Agency" />
	<meta property="og:locale" content="nl_BE" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />
	{#if imageAlt}<meta property="og:image:alt" content={imageAlt} />{/if}
	{#if type === 'article'}
		{#if publishedOn}<meta property="article:published_time" content={publishedOn} />{/if}
		{#if modifiedOn}<meta property="article:modified_time" content={modifiedOn} />{/if}
		{#if section}<meta property="article:section" content={section} />{/if}
		<meta property="article:author" content="Niels Van de Meersch" />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<!-- X and LinkedIn read the og:* tags, but Slack, WhatsApp and a few crawlers
	     still prefer the twitter:* set when it is present. -->
	<meta name="twitter:title" content={seoTitle} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={ogImage} />
	{#each [...schemas, ...trail] as schema, i (i)}
		{@html `<script type="application/ld+json">${ldJson(schema)}<\/script>`}
	{/each}
</svelte:head>
