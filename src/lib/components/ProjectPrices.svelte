<script lang="ts">
	import type { ProjectRow } from '$lib/types';
	let { projects }: { projects: ProjectRow[] | null } = $props();
</script>

<h2 style="margin-top:2.6rem">Projecten</h2>
<div class="tablewrap"><table>
	<thead><tr><th>Project</th><th>Vanaf</th><th></th></tr></thead>
	<tbody>
		{#each projects ?? [] as p (p.wat)}
			<tr><td>{p.wat}</td><td>{p.vanaf}</td><td><a href={p.link}>Meer</a></td></tr>
		{/each}
	</tbody>
</table></div>
