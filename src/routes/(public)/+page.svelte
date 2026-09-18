<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import PageBody from '$components/PageBody.svelte';
	import { faqSchema, webPageSchema } from '$lib/schema';
	import { resolveImage } from '$lib/images';

	let { data } = $props();
	const p = $derived(data.page);
	const schemas = $derived([
		webPageSchema(p, '/'),
		...(p.faq?.length ? [faqSchema(p.faq)] : [])
	]);
</script>

<Seo seoTitle={p.seo_title} metaDescription={p.meta_description} path="/" {schemas}
     image={p.header_image_url} imageAlt={p.header_alt} />

<header class="sign"><div class="wrap">
	<div class="hero"><div>
		<h1>{p.title}</h1>
		<p class="lead">{p.intro}</p>
		<div class="btns">
			{#if p.cta_primary}<a class="btn" href={p.cta_primary.link}>{p.cta_primary.label}</a>{/if}
			{#if p.cta_secondary}<a class="btn btn-ghost" href={p.cta_secondary.link}>{p.cta_secondary.label}</a>{/if}
		</div>
	</div>
	<img class="heroportret" src={resolveImage(p.portrait_url)} alt={p.portrait_alt}
	     width="900" height="1125" fetchpriority="high">
	</div><div class="facts">
		{#each p.figures ?? [] as c (c.label)}<div><b>{c.getal}</b>{c.label}</div>{/each}
	</div>
</div></header>
<img class="bandbeeld" src={resolveImage(p.header_image_url)} alt={p.header_alt}
     width="851" height="315" loading="lazy" decoding="async">

<PageBody page={p} logos={data.logos} posts={data.posts} settings={data.settings} />
