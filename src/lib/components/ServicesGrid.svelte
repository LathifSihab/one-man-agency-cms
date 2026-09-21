<script lang="ts">
	import type { ServiceLink } from '$lib/types';
	// `short` is the homepage variant: it adds the heading and the "all services"
	// button. Region pages render the same rows bare.
	let { services, short = true }: { services: ServiceLink[]; short?: boolean } = $props();
</script>

{#if short}
	<section class="alt"><div class="wrap">
		<h2>Alles wat je marketing eenvoudiger maakt</h2>
		<p class="lead">Neem alles af, of enkel het stuk waar je vastloopt.</p>
		<div class="rows">
			{#each services as s (s.link)}
				<a class="row" href={s.link}><h3>{s.label}</h3><p>{s.summary}</p><span class="go">Bekijken</span></a>
			{/each}
		</div>
		<div class="btns"><a class="btn btn-ghost" href="/diensten">Bekijk alle diensten</a></div>
	</div></section>
{:else}
	<div class="rows">
		{#each services as s (s.link)}
			<a class="row" href={s.link}><h3>{s.label}</h3><p>{s.summary}</p><span class="go">Bekijken</span></a>
		{/each}
	</div>
{/if}
