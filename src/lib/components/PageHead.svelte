<script lang="ts">
	interface Props { title: string; intro?: string; crumbs?: import('svelte').Snippet }
	let { title, intro = '', crumbs }: Props = $props();
</script>

<header class="pagehead"><div class="wrap">
	{#if crumbs}<p class="crumbs">{@render crumbs()}</p>{/if}
	<h1>{title}</h1>
	<p class="lead">{intro}</p>
</div></header>
