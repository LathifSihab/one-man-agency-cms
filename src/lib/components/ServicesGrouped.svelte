<script lang="ts">
	import { SERVICES, SERVICE_GROUPS } from '$lib/site';
</script>

<section><div class="wrap">
	{#each SERVICE_GROUPS as [titel, from, to] (titel)}
		<h2 style="margin-top:2.4rem">{titel}</h2>
		<div class="rows">
			{#each SERVICES.slice(from, to) as [slug, naam, oms] (slug)}
				<a class="row" href="/diensten/{slug}"><h3>{naam}</h3><p>{oms}</p><span class="go">Bekijken</span></a>
			{/each}
		</div>
	{/each}
</div></section>
