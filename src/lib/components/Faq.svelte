<script lang="ts">
	import type { FaqItem } from '$lib/types';
	// The matching FAQPage JSON-LD is emitted by the page, not here, so that the
	// schema stays in one place per route.
	let { faq, heading = true }: { faq: FaqItem[] | null; heading?: boolean } = $props();
</script>

{#if faq && faq.length}
	{#if heading}<h2 style="margin-top:2.6rem">Veelgestelde vragen</h2>{/if}
	<div class="faq">
		{#each faq as f (f.vraag)}
			<details><summary>{f.vraag}</summary><p>{f.antwoord}</p></details>
		{/each}
	</div>
{/if}
