<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	/**
	 * Logos are held in their real display order, never in the order they happen
	 * to be shown in. Grouping the unnamed ones first is a *view*: if it were
	 * allowed to define sort_order on save, opening this screen and pressing Save
	 * would silently reshuffle the logo wall on the live site.
	 */
	let logos = $state(
		untrack(() => [...data.logos]).sort((a, b) => a.sort_order - b.sort_order)
	);

	// Default to the view that surfaces the SEO defect, per the CMS spec.
	let unnamedFirst = $state(true);
	let busy = $state(false);

	const unnamed = $derived(logos.filter((l) => l.name === 'Klant').length);

	/** What is rendered. Reordering is only offered in the true-order view. */
	const shown = $derived(
		unnamedFirst
			? [...logos].sort((a, b) => {
					const rank = (n: string) => (n === 'Klant' ? 0 : 1);
					return rank(a.name) - rank(b.name) || a.sort_order - b.sort_order;
				})
			: logos
	);

	function move(id: string, by: number) {
		const i = logos.findIndex((l) => l.id === id);
		const to = i + by;
		if (i < 0 || to < 0 || to >= logos.length) return;
		const next = [...logos];
		[next[i], next[to]] = [next[to], next[i]];
		logos = next.map((l, k) => ({ ...l, sort_order: k }));
	}

	// Always derived from the true order, never from `shown`.
	const payload = $derived(
		JSON.stringify(logos.map((l, i) => ({ id: l.id, name: l.name, sort_order: i })))
	);

	const firstId = $derived(logos[0]?.id);
	const lastId = $derived(logos[logos.length - 1]?.id);
</script>

<h1>Logo's</h1>
<p class="cms-lead">{data.logos.length} klantenlogo's.</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}
{#if form?.saved}<div class="cms-ok">Opgeslagen. Publiceer om het live te zetten.</div>{/if}

{#if unnamed}
	<div class="cms-banner pending">
		<p>
			{unnamed} logo{unnamed === 1 ? '' : "'s"} {unnamed === 1 ? 'heeft' : 'hebben'} nog geen
			klantnaam. Google leest dan geen bedrijfsnaam bij het beeld.
		</p>
	</div>
{/if}

<form method="POST" action="?/save" use:enhance={() => {
	busy = true;
	return async ({ update }) => { await update({ reset: false }); busy = false; };
}}>
	<input type="hidden" name="logos" value={payload} />
	<div class="cms-actions" style="margin-bottom:1rem">
		<button class="cms-btn" type="submit" disabled={busy}>
			{busy ? 'Bezig…' : 'Namen en volgorde opslaan'}
		</button>
		<label style="font-weight:500;display:flex;align-items:center;gap:.4rem">
			<input type="checkbox" bind:checked={unnamedFirst} style="width:auto" />
			Toon logo&rsquo;s zonder naam eerst
		</label>
	</div>
	<p class="cms-hint" style="margin:-.4rem 0 1rem">
		{unnamedFirst
			? 'Dit is enkel een weergave; de volgorde op de site verandert er niet door. Zet dit uit om te herschikken.'
			: 'Dit is de volgorde zoals ze op de site staat. Gebruik de pijlen om te herschikken.'}
	</p>

	<div class="cms-logos">
		{#each shown as logo (logo.id)}
			<div class="cms-logo" class:needs-name={logo.name === 'Klant'}>
				<img src={logo.file_path} alt={logo.name === 'Klant' ? 'Klantlogo' : `Logo van ${logo.name}`} />
				<input type="text" bind:value={logo.name} aria-label="Naam van de klant" />
				{#if logo.name === 'Klant'}
					<p class="cms-hint" style="margin:.3rem 0 0">Naam ontbreekt</p>
				{/if}
				{#if !unnamedFirst}
					<div class="cms-actions" style="justify-content:center;margin-top:.4rem">
						<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
						        onclick={() => move(logo.id, -1)} disabled={logo.id === firstId}
						        aria-label="Eerder">↑</button>
						<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
						        onclick={() => move(logo.id, 1)} disabled={logo.id === lastId}
						        aria-label="Later">↓</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</form>

<h2>Logo verwijderen</h2>
<p class="cms-hint">Nieuwe logo's upload je bij <a href="/admin/media">Afbeeldingen</a>.</p>
<form method="POST" action="?/delete" use:enhance
      onsubmit={(e) => { if (!confirm('Dit logo verwijderen?')) e.preventDefault(); }}>
	<div class="cms-field" style="max-width:420px">
		<label for="del">Kies een logo</label>
		<select id="del" name="id">
			{#each logos as l (l.id)}<option value={l.id}>{l.name} — {l.file_path}</option>{/each}
		</select>
	</div>
	<button class="cms-btn cms-btn-danger cms-btn-small" type="submit">Verwijderen</button>
</form>
