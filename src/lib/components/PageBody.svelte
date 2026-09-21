<script lang="ts">
	import type { Logo, Page, Post, ServiceLink, Settings } from '$lib/types';
	import { renderMarkdown } from '$lib/markdown';
	import { foldPortrait, splitBody } from '$lib/shortcodes';
	import { resolveImage } from '$lib/images';

	import ServicesGrid from './ServicesGrid.svelte';
	import ServicesGrouped from './ServicesGrouped.svelte';
	import Testimonials from './Testimonials.svelte';
	import Steps from './Steps.svelte';
	import SectorList from './SectorList.svelte';
	import ScanCta from './ScanCta.svelte';
	import LogoWall from './LogoWall.svelte';
	import LogoStrip from './LogoStrip.svelte';
	import PackageCards from './PackageCards.svelte';
	import ProjectPrices from './ProjectPrices.svelte';
	import Faq from './Faq.svelte';
	import BookingEmbed from './BookingEmbed.svelte';
	import BlogIndex from './BlogIndex.svelte';

	/**
	 * Renders a page body: Markdown prose interleaved with {{shortcode}} blocks.
	 *
	 * Mirrors build.py's assembly exactly — prose runs are wrapped in
	 * `<section><div class="wrap"><div class="prose">`, and that wrapper is closed
	 * before each block and reopened after it.
	 */
	interface Props {
		page: Page;
		logos: Logo[];
		posts: Post[];
		settings: Settings;
		services: ServiceLink[];
	}

	let { page, logos, posts, settings, services }: Props = $props();

	const parts = $derived(foldPortrait(splitBody(page.body)));

	/**
	 * Blocks that bring their own <section><div class="wrap"> wrapper.
	 *
	 * The rest emit bare markup, because build.py used them inside a prose
	 * section — but it closed that section before emitting them, so on /blog,
	 * /prijzen, /veelgestelde-vragen and /afspraak they ended up as direct
	 * children of <main>, with no .wrap and therefore no page gutter: the text
	 * ran into the right edge of the viewport. Those get wrapped here.
	 */
	const SELF_WRAPPING = new Set([
		'{{diensten}}',
		'{{diensten-volledig}}',
		'{{citaten}}',
		'{{stappen}}',
		'{{sectoren}}',
		'{{scan-blok}}',
		'{{logos}}',
		'{{logos-strook}}'
	]);
</script>

{#each parts as part, i (i)}
	{#if part.kind === 'prose'}
		<section><div class="wrap"><div class="prose">{@html renderMarkdown(part.value)}</div></div></section>
	{:else if part.kind === 'portretprose'}
		<!-- Portrait and text in one block, so the text can wrap beside it. The
		     block spans the whole container so the portrait reaches the outer
		     edge; paragraphs keep their own measure and are unaffected. -->
		<section><div class="wrap"><div class="prose prose-wide">
			{#if page.portrait_url}
				<figure class="prose-portret">
					<img src={resolveImage(page.portrait_url)} alt={page.portrait_alt ?? ''}
					     width="900" height="1125" loading="lazy" decoding="async" />
				</figure>
			{/if}
			{@html renderMarkdown(part.value)}
		</div></div></section>
	{:else if SELF_WRAPPING.has(part.value)}
		{#if part.value === '{{diensten}}'}
			<ServicesGrid {services} />
		{:else if part.value === '{{diensten-volledig}}'}
			<ServicesGrouped {services} />
		{:else if part.value === '{{citaten}}'}
			<Testimonials items={page.testimonials} />
		{:else if part.value === '{{stappen}}'}
			<Steps />
		{:else if part.value === '{{sectoren}}'}
			<SectorList items={page.sector_list} />
		{:else if part.value === '{{scan-blok}}'}
			<ScanCta />
		{:else if part.value === '{{logos}}'}
			<LogoWall {logos} />
		{:else if part.value === '{{logos-strook}}'}
			<LogoStrip {logos} />
		{/if}
	{:else}
		<section><div class="wrap">
			{#if part.value === '{{pakketten}}'}
				<PackageCards packages={page.packages} />
			{:else if part.value === '{{projecten}}'}
				<ProjectPrices projects={page.projects} />
			{:else if part.value === '{{faq}}'}
				<Faq faq={page.faq} heading={false} />
			{:else if part.value === '{{agenda}}'}
				<BookingEmbed url={page.booking_url} company={settings.company} />
			{:else if part.value === '{{blogindex}}'}
				<BlogIndex {posts} />
			{/if}
		</div></section>
	{/if}
{/each}
