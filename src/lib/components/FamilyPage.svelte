<script lang="ts">
	import type { Page } from '$lib/types';
	import Seo from './Seo.svelte';
	import PageHead from './PageHead.svelte';
	import PriceTable from './PriceTable.svelte';
	import Faq from './Faq.svelte';
	import TodoNotice from './TodoNotice.svelte';
	import ServicesGrid from './ServicesGrid.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { faqSchema, serviceSchema } from '$lib/schema';
	import { SITE } from '$lib/site';

	/**
	 * The shared body for the three simple page families: services, sectors and
	 * regions. They differ only in their breadcrumb and in whether the full
	 * services list is appended (regions).
	 */
	interface Props {
		page: Page;
		family: 'diensten' | 'sectoren' | 'regio';
	}

	let { page, family }: Props = $props();

	const path = $derived(`/${family}/${page.slug}`);
	const schemas = $derived([
		serviceSchema(page.title, page.meta_description, SITE + path),
		...(page.faq?.length ? [faqSchema(page.faq)] : [])
	]);
</script>

<Seo seoTitle={page.seo_title} metaDescription={page.meta_description} {path} {schemas} />

<PageHead title={page.title} intro={page.intro}>
	{#snippet crumbs()}
		{#if family === 'diensten'}
			<a href="/">Home</a> / <a href="/diensten">Diensten</a>
		{:else if family === 'sectoren'}
			<a href="/">Home</a> / Sectoren
		{:else}
			<a href="/">Home</a> / Regio
		{/if}
	{/snippet}
</PageHead>

<section><div class="wrap"><div class="prose">
	{@html renderMarkdown(page.body)}
</div>
{#if family === 'regio'}<ServicesGrid short={false} />{/if}
<div class="prose">
	{#if page.prices?.length}<PriceTable prices={page.prices} />{/if}
	<Faq faq={page.faq} />
	<TodoNotice note={page.todo_note} />
	<div class="btns">
		<a class="btn" href="/afspraak">Maak een afspraak</a>
		<a class="btn btn-ghost" href="/prijzen">Bekijk de prijzen</a>
	</div>
</div></div></section>
