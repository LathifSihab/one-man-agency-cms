<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { blogPostingSchema } from '$lib/schema';
	import { resolveImage } from '$lib/images';

	let { data } = $props();
	const p = $derived(data.post);
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
<section><div class="wrap">
	<!-- Only when the editor sets one: posts without an image render exactly as
	     they did before, so nothing that exists today changes. -->
	{#if p.image_url}
		<img class="postbeeld" src={resolveImage(p.image_url)} alt={p.title}
		     width="1140" height="600" fetchpriority="high" />
	{/if}
	<article class="post prose">{@html renderMarkdown(p.body)}</article>
	<div class="btns">
		<a class="btn" href="/afspraak">Maak een afspraak</a>
		<a class="btn btn-ghost" href="/blog">Alle artikels</a>
	</div>
</div></section>
