<script lang="ts">
	import { page } from '$app/state';
	import Chrome from '$components/Chrome.svelte';
	import { organisationSchema, ldJson } from '$lib/schema';

	let { data, children } = $props();

	// One ProfessionalService node, emitted once per page, referenced by @id from
	// every other schema on the site.
	const org = $derived(ldJson(organisationSchema(data.settings)));
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${org}<\/script>`}
</svelte:head>

<Chrome settings={data.settings} pathname={page.url.pathname}>
	{@render children()}
</Chrome>
