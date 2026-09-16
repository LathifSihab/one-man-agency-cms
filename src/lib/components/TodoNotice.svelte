<script lang="ts">
	// Renders the `af_te_werken` note visibly to visitors, as the reference build
	// does on 13 pages. Deliberate, and carried over unchanged (Q4).
	let { note }: { note: string | null } = $props();
</script>

{#if note}
	<div class="todo"><p><strong>Nog aan te vullen.</strong> {note}</p></div>
{/if}
