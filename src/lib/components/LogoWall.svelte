<script lang="ts">
	import type { Logo as LogoType } from '$lib/types';
	import Logo from './Logo.svelte';
	let { logos }: { logos: LogoType[] } = $props();
</script>

<section class="tight"><div class="wrap">
	<p class="strookkop">{logos.length} klanten en telkens opnieuw hetzelfde aanspreekpunt</p>
	<div class="logowall">{#each logos as l (l.file_path)}<Logo logo={l} />{/each}</div>
	<p class="hint">Beweeg over een logo voor de naam.</p>
</div></section>
