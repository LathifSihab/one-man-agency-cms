<script lang="ts">
	import type { Analytics } from '$lib/server/dashboard';

	/**
	 * Visitor numbers.
	 *
	 * Drawn with CSS bars rather than a charting library: this is one chart on
	 * one screen, and a library would be more code than the whole admin section.
	 *
	 * The figures are page views and entries — not unique visitors. Counting
	 * people means identifying them, which would mean cookies and a consent
	 * banner. The panel says so plainly rather than letting anyone assume
	 * "bezoeken" means "bezoekers".
	 */
	let { analytics }: { analytics: Analytics } = $props();

	const max = $derived(Math.max(1, ...analytics.daily.map((d) => d.views)));

	const trend = $derived(
		analytics.previousViews > 0
			? Math.round(((analytics.totalViews - analytics.previousViews) / analytics.previousViews) * 100)
			: null
	);

	const DEVICE: Record<string, string> = {
		mobile: 'Gsm',
		tablet: 'Tablet',
		desktop: 'Computer'
	};

	const dayLabel = (iso: string) =>
		new Date(iso).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });

	const share = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

	const deviceTotal = $derived(analytics.devices.reduce((n, d) => n + d.views, 0));
</script>

<h2>Bezoekers <span class="cms-meta">(laatste {analytics.days} dagen)</span></h2>

{#if !analytics.available}
	<div class="cms-card">
		<p style="margin:0">Bezoekcijfers zijn nog niet ingeschakeld op deze omgeving.</p>
		<p class="cms-hint">
			De databankmigratie voor statistieken is nog niet uitgevoerd. Zie
			<code>supabase/migrations</code>.
		</p>
	</div>
{:else if analytics.totalViews === 0}
	<div class="cms-card">
		<p style="margin:0">Nog geen bezoeken geteld.</p>
		<p class="cms-hint">
			Tellen begint zodra de site met deze versie gepubliceerd is. Bezoeken van zoekmachines en
			andere robots worden niet meegeteld.
		</p>
	</div>
{:else}
	<div class="cms-grid" style="margin-bottom:1rem">
		<div class="cms-card">
			<h3>Paginaweergaven</h3>
			<p class="cms-figure">{analytics.totalViews.toLocaleString('nl-BE')}</p>
			{#if trend !== null}
				<p class="cms-meta">
					<span class:cms-up={trend >= 0} class:cms-down={trend < 0}>
						{trend >= 0 ? '+' : ''}{trend}%
					</span>
					tegenover de {analytics.days} dagen daarvoor
				</p>
			{/if}
		</div>
		<div class="cms-card">
			<h3>Bezoeken</h3>
			<p class="cms-figure">{analytics.totalEntries.toLocaleString('nl-BE')}</p>
			<p class="cms-meta">keer dat iemand op de site toekwam</p>
		</div>
		<div class="cms-card">
			<h3>Toestel</h3>
			{#each analytics.devices as d (d.device)}
				<p class="cms-meta" style="margin:.1rem 0">
					{DEVICE[d.device] ?? d.device}: <strong>{share(d.views, deviceTotal)}%</strong>
				</p>
			{/each}
		</div>
		<div class="cms-card">
			<h3>Land</h3>
			{#each analytics.countries as c (c.country)}
				<p class="cms-meta" style="margin:.1rem 0">
					{c.country}: <strong>{c.views.toLocaleString('nl-BE')}</strong>
				</p>
			{:else}
				<p class="cms-meta">Nog onbekend</p>
			{/each}
		</div>
	</div>

	<div class="cms-card" style="margin-bottom:1rem">
		<h3>Per dag</h3>
		<div class="cms-chart" role="img"
		     aria-label="Paginaweergaven per dag over de laatste {analytics.days} dagen">
			{#each analytics.daily as d (d.day)}
				<div class="cms-bar-wrap" title="{dayLabel(d.day)}: {d.views} weergaven">
					<div class="cms-bar" style="height:{Math.round((d.views / max) * 100)}%"></div>
				</div>
			{/each}
		</div>
		<div class="cms-chart-axis">
			<span>{dayLabel(analytics.daily[0]?.day ?? '')}</span>
			<span>{dayLabel(analytics.daily.at(-1)?.day ?? '')}</span>
		</div>
	</div>

	<div class="cms-split">
		<div class="cms-card">
			<h3>Meest bekeken pagina's</h3>
			<table class="cms-table" style="border:0">
				<tbody>
					{#each analytics.topPaths as row (row.path)}
						<tr>
							<td><a href={row.path} target="_blank" rel="noopener">{row.path}</a></td>
							<td style="text-align:right">{row.views.toLocaleString('nl-BE')}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="cms-card">
			<h3>Waar bezoekers vandaan komen</h3>
			{#if analytics.topReferrers.length}
				<table class="cms-table" style="border:0">
					<tbody>
						{#each analytics.topReferrers as row (row.referrer_host)}
							<tr>
								<td>{row.referrer_host}</td>
								<td style="text-align:right">{row.views.toLocaleString('nl-BE')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="cms-hint">
					Nog geen verwijzingen. Bezoekers die rechtstreeks het adres intypen of uit een
					zoekresultaat komen dat de herkomst verbergt, staan hier niet bij.
				</p>
			{/if}
		</div>
	</div>

	<p class="cms-hint" style="margin-top:.8rem">
		Geteld zonder cookies en zonder iets over de bezoeker te bewaren, dus er is geen
		cookiemelding nodig. Daardoor is er ook geen aantal <em>unieke bezoekers</em>: dat vraagt
		om mensen te herkennen. Robots worden niet meegeteld.
	</p>
{/if}
