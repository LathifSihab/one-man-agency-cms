<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	// The 22 logos still called "Klant" come first with a warning: it is a real
	// SEO defect (empty alt text) and the CMS should make it impossible to miss.
	let logos = $state(
		untrack(() => [...data.logos]).sort((a, b) => {
			const aBad = a.name === 'Klant' ? 0 : 1;
			const bBad = b.name === 'Klant' ? 0 : 1;
			return aBad - bBad || a.sort_order - b.sort_order;
		})
	);

	let busy = $state(false);
	const unnamed = $derived(logos.filter((l) => l.name === 'Klant').length);

	function move(i: number, by: number) {
		const to = i + by;
		if (to < 0 || to >= logos.length) return;
		const next = [...logos];
		[next[i], next[to]] = [next[to], next[i]];
		logos = next.map((l, k) => ({ ...l, sort_order: k }));
	}

	const payload = $derived(
		JSON.stringify(logos.map((l, i) => ({ id: l.id, name: l.name, sort_order: i })))
	);
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
	</div>

	<div class="cms-logos">
		{#each logos as logo, i (logo.id)}
			<div class="cms-logo" class:needs-name={logo.name === 'Klant'}>
				<img src={logo.file_path} alt={logo.name === 'Klant' ? 'Klantlogo' : `Logo van ${logo.name}`} />
				<input type="text" bind:value={logo.name} aria-label="Naam van de klant" />
				{#if logo.name === 'Klant'}
					<p class="cms-hint" style="margin:.3rem 0 0">Naam ontbreekt</p>
				{/if}
				<div class="cms-actions" style="justify-content:center;margin-top:.4rem">
					<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
					        onclick={() => move(i, -1)} disabled={i === 0} aria-label="Eerder">↑</button>
					<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
					        onclick={() => move(i, 1)} disabled={i === logos.length - 1}
					        aria-label="Later">↓</button>
				</div>
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
