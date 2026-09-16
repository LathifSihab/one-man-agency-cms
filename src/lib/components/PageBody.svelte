<script lang="ts">
	import type { Logo, Page, Post, Settings } from '$lib/types';
	import { renderMarkdown } from '$lib/markdown';
	import { splitBody } from '$lib/shortcodes';

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
	}

	let { page, logos, posts, settings }: Props = $props();

	const parts = $derived(splitBody(page.body));
</script>

{#each parts as part, i (i)}
	{#if part.kind === 'prose'}
		<section><div class="wrap"><div class="prose">{@html renderMarkdown(part.value)}</div></div></section>
	{:else if part.value === '{{diensten}}'}
		<ServicesGrid />
	{:else if part.value === '{{diensten-volledig}}'}
		<ServicesGrouped />
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
	{:else if part.value === '{{pakketten}}'}
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
{/each}
