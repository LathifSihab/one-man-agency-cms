<script lang="ts">
	import type { Testimonial } from '$lib/types';
	// Renders nothing when the list is empty — the CMS warns about this rather
	// than letting it fail silently.
	let { items }: { items: Testimonial[] | null } = $props();
</script>

{#if items && items.length}
	<section><div class="wrap">
		<h2>Wat klanten zeggen</h2>
		<div class="quotes">
			{#each items as c (c.naam + c.tekst)}
				<blockquote><p>&ldquo;{c.tekst}&rdquo;</p><cite>{c.naam} &mdash; {c.functie}</cite></blockquote>
			{/each}
		</div>
		<div class="btns"><a class="btn btn-ghost" href="/referenties">Bekijk de referenties</a></div>
	</div></section>
{/if}
