<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { blogPostingSchema } from '$lib/schema';
	import { resolveImage } from '$lib/images';
	import { POST_SHORTCODES, splitBody } from '$lib/shortcodes';
	import ScanCta from '$components/ScanCta.svelte';
	import Steps from '$components/Steps.svelte';

	let { data } = $props();
	const p = $derived(data.post);

	/**
	 * Prose runs interleaved with blocks, as on a page. The blocks bring their own
	 * full-width <section>, so the article is closed around each one. A block a
	 * post cannot render is dropped rather than shown as its raw {{token}}.
	 */
	const parts = $derived(
		splitBody(p.body).filter((part) => part.kind === 'prose' || POST_SHORTCODES.has(part.value))
	);
	// The image heads the first section and the buttons close the last one; each
	// gets a section of its own when a block stands in that position.
	const leadsWithProse = $derived(parts[0]?.kind !== 'block');
	const endsWithProse = $derived(parts.length > 0 && parts[parts.length - 1].kind !== 'block');
</script>

<Seo seoTitle={p.seo_title} metaDescription={p.meta_description} path="/blog/{p.slug}"
     schemas={[blogPostingSchema(p)]} type="article" image={p.image_url}
     imageAlt={p.image_url ? p.title : null}
     publishedOn={p.published_on} modifiedOn={p.updated_at ?? p.published_on}
     section={p.category}
     crumbs={[
       { name: 'Home', path: '/' },
       { name: 'Blog', path: '/blog' },
       { name: p.title, path: `/blog/${p.slug}` }
     ]} />

<header class="pagehead"><div class="wrap">
	<p class="crumbs"><a href="/">Home</a> / <a href="/blog">Blog</a></p>
	<h1>{p.title}</h1>
	<p class="lead">{p.intro}</p>
	<!-- No visible date, to match the index. It is still published in the meta
	     tags and in the BlogPosting schema, where a search engine reads it: the
	     point is not to hide when something was written, it is that a reader
	     should judge the article and not its age. -->
	<p class="crumbs" style="margin:1rem 0 0">Niels Van de Meersch</p>
</div></header>
{#snippet image()}
	<!-- Only when the editor sets one: posts without an image render exactly as
	     they did before, so nothing that exists today changes. -->
	{#if p.image_url}
		<img class="postbeeld" src={resolveImage(p.image_url)} alt={p.title}
		     width="1140" height="600" fetchpriority="high" />
	{/if}
{/snippet}
{#snippet buttons()}
	<div class="btns">
		<a class="btn btn-green" href="/afspraak">Maak een afspraak</a>
		<a class="btn btn-ghost" href="/blog">Alle artikels</a>
	</div>
{/snippet}

{#if !leadsWithProse && p.image_url}
	<section><div class="wrap">{@render image()}</div></section>
{/if}
{#each parts as part, i (i)}
	{#if part.kind === 'prose'}
		<section><div class="wrap">
			{#if i === 0}{@render image()}{/if}
			<article class="post prose">{@html renderMarkdown(part.value)}</article>
			{#if i === parts.length - 1}{@render buttons()}{/if}
		</div></section>
	{:else if part.value === '{{scan-blok}}'}
		<ScanCta />
	{:else if part.value === '{{stappen}}'}
		<Steps />
	{/if}
{/each}
{#if !endsWithProse}
	<section><div class="wrap">
		{#if !parts.length}{@render image()}{/if}
		{@render buttons()}
	</div></section>
{/if}
