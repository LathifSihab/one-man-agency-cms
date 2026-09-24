<script lang="ts">
	import type { Logo as LogoType } from '$lib/types';
	import Logo from './Logo.svelte';
	let { logos }: { logos: LogoType[] } = $props();
</script>

<section class="tight"><div class="wrap">
	<div class="logowall">{#each logos as l (l.file_path)}<Logo logo={l} />{/each}</div>
	<p class="hint">Beweeg over een logo voor de naam.</p>
</div></section>
