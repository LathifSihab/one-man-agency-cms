<script lang="ts">
	import { STEPS } from '$lib/site';
</script>

<section class="alt"><div class="wrap">
	<h2>Zo verloopt het</h2>
	<ol class="steps">
		{#each STEPS as [t, o] (t)}<li><h3>{t}</h3><p>{o}</p></li>{/each}
	</ol>
</div></section>
