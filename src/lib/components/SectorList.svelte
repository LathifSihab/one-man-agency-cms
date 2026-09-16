<script lang="ts">
	let { items }: { items: string[] | null } = $props();
</script>

<section><div class="wrap">
	<h2>Ik werk vooral met</h2>
	<ul class="tags">{#each items ?? [] as x (x)}<li>{x}</li>{/each}</ul>
	<p style="margin-top:1.6rem">Zit jouw sector er niet bij? Met 25 jaar ervaring vind ik voor zowat elk probleem een oplossing. <a href="/contact">Stuur me je vraag.</a></p>
</div></section>
