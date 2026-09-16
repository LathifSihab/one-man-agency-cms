<script lang="ts">
	import type { Logo } from '$lib/types';
	// 22 of 53 logos are still named "Klant". That is a content defect carried
	// over deliberately; the alt text degrades to a generic label rather than
	// asserting a client name we do not have.
	let { logo, showName = true }: { logo: Logo; showName?: boolean } = $props();
	const known = $derived(logo.name !== 'Klant');
	const alt = $derived(known ? `Logo van ${logo.name}` : 'Klantlogo');
</script>

<figure class="logo">
	<img src={logo.file_path} {alt} loading="lazy" decoding="async" width="375" height="375">
	{#if showName && known}<span class="logonaam">{logo.name}</span>{/if}
</figure>
