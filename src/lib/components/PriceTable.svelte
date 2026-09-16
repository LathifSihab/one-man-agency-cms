<script lang="ts">
	import type { PriceRow } from '$lib/types';
	// Prices contain a non-breaking space after the euro sign (U+00A0). It comes
	// straight from the database and must not be normalised away.
	let { prices }: { prices: PriceRow[] | null } = $props();
</script>

<h2 style="margin-top:2.6rem">Wat het kost</h2>
<div class="tablewrap"><table>
	<thead><tr><th>Wat</th><th>Vanaf</th></tr></thead>
	<tbody>{#each prices ?? [] as p (p.wat)}<tr><td>{p.wat}</td><td>{p.vanaf}</td></tr>{/each}</tbody>
</table></div>
<p class="hint">Alle bedragen exclusief btw. Je krijgt altijd een vaste prijs voor we beginnen.</p>
