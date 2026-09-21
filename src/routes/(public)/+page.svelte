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

<!--
	The header image carries the title rather than sitting under it, and the
	portrait has moved down beside the opening section ({{portret}} in the body).

	A real <img> rather than a CSS background: it is the largest thing on the
	page and therefore the LCP element, so it has to be discoverable in the HTML
	and given priority. Without a header image the hero falls back to the plain
	green band it was, which is also what every other page's head looks like.
-->
<header class="sign" class:herohead={p.header_image_url}>
	{#if p.header_image_url}
		<img class="herobeeld" src={resolveImage(p.header_image_url)} alt={p.header_alt}
		     width="851" height="315" fetchpriority="high">
	{/if}
	<div class="wrap">
		<div class="heroover">
			<h1>{p.title}</h1>
			<p class="lead">{p.intro}</p>
			<div class="btns">
				{#if p.cta_primary}<a class="btn" href={p.cta_primary.link}>{p.cta_primary.label}</a>{/if}
				{#if p.cta_secondary}<a class="btn btn-ghost" href={p.cta_secondary.link}>{p.cta_secondary.label}</a>{/if}
			</div>
		</div>
		<div class="facts">
			{#each p.figures ?? [] as c (c.label)}<div><b>{c.getal}</b>{c.label}</div>{/each}
		</div>
	</div>
</header>

<PageBody page={p} logos={data.logos} posts={data.posts} settings={data.settings}
          services={data.services} />
