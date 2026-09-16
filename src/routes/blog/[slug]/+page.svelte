<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { blogPostingSchema } from '$lib/schema';
	import { nlDate } from '$lib/site';

	let { data } = $props();
	const p = $derived(data.post);
</script>

<Seo seoTitle={p.seo_title} metaDescription={p.meta_description} path="/blog/{p.slug}"
     schemas={[blogPostingSchema(p)]} />

<header class="pagehead"><div class="wrap">
	<p class="crumbs"><a href="/">Home</a> / <a href="/blog">Blog</a></p>
	<h1>{p.title}</h1>
	<p class="lead">{p.intro}</p>
	<p class="crumbs" style="margin:1rem 0 0">{nlDate(p.published_on)} &middot; Niels Van de Meersch</p>
</div></header>
<section><div class="wrap">
	<article class="post prose">{@html renderMarkdown(p.body)}</article>
	<div class="btns">
		<a class="btn" href="/afspraak">Maak een afspraak</a>
		<a class="btn btn-ghost" href="/blog">Alle artikels</a>
	</div>
</div></section>
