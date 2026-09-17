<script lang="ts">
	import PublishBanner from '$components/admin/PublishBanner.svelte';
	import Analytics from '$components/admin/Analytics.svelte';

	let { data } = $props();

	const TYPE_LABEL: Record<string, string> = {
		page: 'Pagina',
		service: 'Dienst',
		sector: 'Sector',
		region: 'Regio'
	};

	function when(iso: string): string {
		return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<h1>Overzicht</h1>
<p class="cms-lead">Beheer van onemanagency.be</p>

<PublishBanner publish={data.publish} />

<div class="cms-grid">
	<div class="cms-card">
		<h3>Pagina's</h3>
		<p class="cms-meta">{data.counts.pages} pagina's in totaal</p>
		<a class="cms-btn cms-btn-ghost cms-btn-small" href="/admin/pages">Bewerken</a>
	</div>
	<div class="cms-card">
		<h3>Blog</h3>
		<p class="cms-meta">{data.counts.posts} artikels</p>
		<a class="cms-btn cms-btn-ghost cms-btn-small" href="/admin/blog">Bewerken</a>
	</div>
	<div class="cms-card">
		<h3>Logo's</h3>
		<p class="cms-meta">{data.counts.logos} klantenlogo's</p>
		<a class="cms-btn cms-btn-ghost cms-btn-small" href="/admin/logos">Bewerken</a>
	</div>
	<div class="cms-card">
		<h3>Berichten</h3>
		<p class="cms-meta">
			{data.counts.unread} ongelezen
		</p>
		<a class="cms-btn cms-btn-ghost cms-btn-small" href="/admin/submissions">Bekijken</a>
	</div>
</div>

<Analytics analytics={data.analytics} />

<h2>Nog af te werken</h2>
{#if data.outstanding.length}
	<table class="cms-table">
		<thead><tr><th>Wat</th><th>Aantal</th><th></th></tr></thead>
		<tbody>
			{#each data.outstanding as item (item.key)}
				<tr>
					<td>
						<strong>{item.label}</strong>
						<p class="cms-hint" style="margin:.15rem 0 0">{item.detail}</p>
					</td>
					<td><span class="cms-badge warn">{item.count}</span></td>
					<td><a class="cms-btn cms-btn-ghost cms-btn-small" href={item.href}>Oplossen</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<div class="cms-card"><p style="margin:0">Niets meer openstaand.</p></div>
{/if}

<h2>Recent bewerkt</h2>
<table class="cms-table">
	<thead><tr><th>Pagina</th><th>Soort</th><th>Bijgewerkt</th></tr></thead>
	<tbody>
		{#each data.recent as row (row.type + row.slug)}
			<tr>
				<td><a href="/admin/pages/{row.type}/{row.slug}">{row.title}</a></td>
				<td>{TYPE_LABEL[row.type] ?? row.type}</td>
				<td class="cms-meta">{when(row.updated_at)}</td>
			</tr>
		{/each}
	</tbody>
</table>
