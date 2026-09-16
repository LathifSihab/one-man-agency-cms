<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import PageHead from '$components/PageHead.svelte';
	import { renderMarkdown } from '$lib/markdown';

	let { data } = $props();
	const p = $derived(data.page);
</script>

<Seo seoTitle={p.seo_title} metaDescription={p.meta_description} path="/404" noindex={true} />

<PageHead title={p.title} intro={p.intro} />
<section><div class="wrap"><div class="prose">{@html renderMarkdown(p.body)}</div></div></section>
