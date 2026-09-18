<script lang="ts">
	import PublishBanner from '$components/admin/PublishBanner.svelte';
	import Analytics from '$components/admin/Analytics.svelte';
	import { grade } from '$lib/seo';

	let { data } = $props();

	const TYPE_LABEL: Record<string, string> = {
		page: 'Pagina',
		service: 'Dienst',
		sector: 'Sector',
		region: 'Regio'
	};

	const verdict = $derived(grade(data.seo.average));

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

<h2>Vindbaarheid in Google</h2>
<div class="cms-card">
	<p style="margin:0 0 .4rem">
		Gemiddeld <strong>{data.seo.average}/100</strong>
		<span class="cms-badge {verdict.status === 'fail' ? 'bad' : verdict.status}">{verdict.label}</span>
		<span class="cms-meta">over {data.seo.graded} pagina's en artikels</span>
	</p>
	{#if data.seo.weakest.length}
		<p class="cms-hint" style="margin:0 0 .8rem">
			Deze staan het zwakst. Open er een: onderaan de bewerkpagina staat wat eraan scheelt.
		</p>
		<table class="cms-table">
			<thead><tr><th>Pagina</th><th>Score</th><th>Wat scheelt er</th><th></th></tr></thead>
			<tbody>
				{#each data.seo.weakest as row (row.kind + row.slug)}
					<tr>
						<td>
							<a href={row.href}>{row.title}</a>
							{#if !row.published}<span class="cms-badge draft">Concept</span>{/if}
						</td>
						<td><span class="cms-badge {row.status === 'fail' ? 'bad' : 'warn'}">{row.score}</span></td>
						<td class="cms-meta">{row.problems.slice(0, 3).join(', ')}</td>
						<td><a class="cms-btn cms-btn-ghost cms-btn-small" href={row.href}>Verbeteren</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p style="margin:0">Elke pagina scoort 85 of hoger. Niets dringends.</p>
	{/if}
	<!-- The search console itself lives outside the CMS; this is the shortcut so
	     it is not something to remember the URL for. -->
	<p class="cms-hint" style="margin:.9rem 0 0">
		Posities, vertoningen en kliks staan in
		<a href="https://search.google.com/search-console?resource_id=sc-domain:onemanagency.be"
		   target="_blank" rel="noopener">Google Search Console ↗</a>.
	</p>
</div>

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
