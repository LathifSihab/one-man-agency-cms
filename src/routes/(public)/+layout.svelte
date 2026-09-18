<script lang="ts">
	import { page } from '$app/state';
	import Chrome from '$components/Chrome.svelte';
	import { organisationSchema, websiteSchema, ldJson } from '$lib/schema';

	let { data, children } = $props();

	// One ProfessionalService node, emitted once per page, referenced by @id from
	// every other schema on the site.
	const org = $derived(ldJson(organisationSchema(data.settings)));
	// The WebSite node names the domain itself and is what the per-page WebPage
	// nodes point at with isPartOf.
	const site = $derived(ldJson(websiteSchema(data.settings)));
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${org}<\/script>`}
	{@html `<script type="application/ld+json">${site}<\/script>`}
</svelte:head>

<Chrome settings={data.settings} pathname={page.url.pathname}>
	{@render children()}
</Chrome>
