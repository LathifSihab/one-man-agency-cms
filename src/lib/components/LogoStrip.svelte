<script lang="ts">
	import type { Logo as LogoType } from '$lib/types';
	import Logo from './Logo.svelte';
	let { logos }: { logos: LogoType[] } = $props();
</script>

<section class="alt tight"><div class="wrap">
	<p class="strookkop">Zij werken al met One Man Agency</p>
	<div class="logowall klein">
		{#each logos.slice(0, 12) as l (l.file_path)}<Logo logo={l} showName={false} />{/each}
	</div>
	<div class="btns"><a class="btn btn-ghost" href="/referenties">Alle referenties</a></div>
</div></section>
