<script lang="ts">
	import type { Package } from '$lib/types';
	let { packages }: { packages: Package[] | null } = $props();
</script>

<h2 style="margin-top:2.6rem">Maandelijkse pakketten</h2>
<div class="plans">
	{#each packages ?? [] as p (p.naam)}
		<div class="plan{p.uitgelicht ? ' pick' : ''}">
			<h3>{p.naam}</h3>
			<p class="who">{p.voor_wie}</p>
			<p class="price">{p.prijs}<small>{p.periode}</small></p>
			<ul>{#each p.inbegrepen as x (x)}<li>{x}</li>{/each}</ul>
		</div>
	{/each}
</div>
<p class="hint">Alle prijzen exclusief btw. Opzegbaar per kwartaal. Geen opstartkosten.</p>
