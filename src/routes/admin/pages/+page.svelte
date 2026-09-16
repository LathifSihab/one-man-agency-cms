<script lang="ts">
	let { data } = $props();

	const GROUPS = [
		{ type: 'page', label: "Pagina's" },
		{ type: 'service', label: 'Diensten' },
		{ type: 'sector', label: 'Sectoren' },
		{ type: 'region', label: 'Regio' }
	];

	const route: Record<string, string> = {
		page: '',
		service: '/diensten',
		sector: '/sectoren',
		region: '/regio'
	};

	function liveUrl(type: string, slug: string): string {
		if (type === 'page') return slug === 'home' ? '/' : `/${slug}`;
		return `${route[type]}/${slug}`;
	}
</script>

<h1>Pagina's</h1>
<p class="cms-lead">Alle vaste pagina's, diensten, sectoren en regio's.</p>

{#each GROUPS as group (group.type)}
	{@const rows = data.pages.filter((p) => p.type === group.type)}
	<h2>{group.label} <span class="cms-meta">({rows.length})</span></h2>
	<table class="cms-table">
		<thead><tr><th>Titel</th><th>Adres</th><th>Status</th><th></th></tr></thead>
		<tbody>
			{#each rows as p (p.slug)}
				<tr>
					<td><a href="/admin/pages/{p.type}/{p.slug}">{p.title}</a></td>
					<td class="cms-meta">{liveUrl(p.type, p.slug)}</td>
					<td>
						{#if p.todo_note}<span class="cms-badge warn">Af te werken</span>{/if}
						{#if p.noindex}<span class="cms-badge draft">Niet in Google</span>{/if}
					</td>
					<td><a class="cms-btn cms-btn-ghost cms-btn-small"
					       href="/admin/pages/{p.type}/{p.slug}">Bewerken</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/each}
