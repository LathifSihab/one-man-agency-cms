<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import PageHead from '$components/PageHead.svelte';
	import PageBody from '$components/PageBody.svelte';
	import ContactForm from '$components/ContactForm.svelte';
	import TodoNotice from '$components/TodoNotice.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { faqSchema, blogSchema, webPageSchema } from '$lib/schema';

	let { data } = $props();
	const p = $derived(data.page);
	const schemas = $derived([
		webPageSchema(p, `/${p.slug}`),
		...(p.faq?.length ? [faqSchema(p.faq)] : []),
		// The blog index describes a Blog, and names the posts it lists.
		...(p.slug === 'blog' ? [blogSchema(data.posts)] : [])
	]);
</script>

<Seo seoTitle={p.seo_title} metaDescription={p.meta_description} path="/{p.slug}"
     noindex={p.noindex} {schemas} image={p.header_image_url}
     crumbs={[{ name: 'Home', path: '/' }, { name: p.title, path: `/${p.slug}` }]} />

<PageHead title={p.title} intro={p.intro} />

{#if p.form_variant}
	<!-- Contact and scan pages put the prose and the form side by side. -->
	<section><div class="wrap split">
		<div class="prose">{@html renderMarkdown(p.body)}</div>
		<div><ContactForm variant={p.form_variant} /></div>
	</div></section>
{:else}
	<PageBody page={p} logos={data.logos} posts={data.posts} settings={data.settings} />
{/if}

{#if p.todo_note}
	<section class="tight"><div class="wrap"><TodoNotice note={p.todo_note} /></div></section>
{/if}
