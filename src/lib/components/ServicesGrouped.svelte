<script lang="ts">
	import { serviceGroups } from '$lib/site';
	import type { ServiceLink } from '$lib/types';

	/**
	 * The full services overview, under their headings.
	 *
	 * The headings used to be four fixed names with index ranges into a hardcoded
	 * array — so a new service could not be added without recounting the slices.
	 * They are now whatever headings the content uses, in the order the services
	 * themselves appear, which means a new heading is simply a new group.
	 */
	let { services }: { services: ServiceLink[] } = $props();

	const groups = $derived(serviceGroups(services));
</script>

<section><div class="wrap">
	{#each groups as group (group.name)}
		<h2 style="margin-top:2.4rem">{group.name}</h2>
		<div class="rows">
			{#each group.items as s (s.link)}
				<a class="row" href={s.link}><h3>{s.label}</h3><p>{s.summary}</p><span class="go">Bekijken</span></a>
			{/each}
		</div>
	{/each}
</div></section>
