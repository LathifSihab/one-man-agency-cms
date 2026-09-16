<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import { confirmSubmit } from '$lib/components/admin/confirmSubmit';
	import { resolveImage } from '$lib/images';

	let { data, form } = $props();

	/**
	 * Logos are held in their real display order, never in the order they happen
	 * to be shown in. Grouping the unnamed ones first is a *view*: if it were
	 * allowed to define sort_order on save, opening this screen and pressing Save
	 * would silently reshuffle the logo wall on the live site.
	 */
	let logos = $state(untrack(() => [...data.logos]).sort((a, b) => a.sort_order - b.sort_order));

	// Default to the view that surfaces the SEO defect, per the CMS spec.
	let unnamedFirst = $state(true);
	let query = $state('');
	let busy = $state(false);
	let confirmer: ConfirmDialog | undefined = $state();
	let toDelete = $state('');
	let newName = $state('');

	const unnamed = $derived(logos.filter((l) => l.name === 'Klant').length);

	/**
	 * The rendered order, held as a fixed list of ids rather than derived from
	 * the names.
	 *
	 * This is the point: if the grouping recomputed as you typed, a logo would
	 * jump out of the "no name" group on the first keystroke and the card you
	 * were editing would move under the cursor. The order is therefore a
	 * snapshot, refreshed only when you ask for it — by switching the view, or
	 * after a save.
	 */
	let displayIds = $state<string[]>([]);

	/*
	 * Pull the list back from the server after an action that changed it.
	 *
	 * The local copy is seeded once with untrack so a card cannot move while a
	 * name is being typed. The cost is that it does not notice an add or a
	 * delete on its own, so those say so explicitly.
	 */
	function reseed() {
		logos = [...data.logos].sort((a, b) => a.sort_order - b.sort_order);
		snapshotOrder();
	}

	function snapshotOrder() {
		const byPosition = [...logos].sort((a, b) => a.sort_order - b.sort_order);
		const rank = (name: string) => (name === 'Klant' ? 0 : 1);
		const ordered = unnamedFirst
			? [...byPosition].sort((a, b) => rank(a.name) - rank(b.name))
			: byPosition;
		displayIds = ordered.map((l) => l.id);
	}

	untrack(snapshotOrder);

	const matches = (l: { name: string; file_path: string }) => {
		const q = query.trim().toLowerCase();
		if (!q) return true;
		return (
			l.name.toLowerCase().includes(q) ||
			l.file_path.split('/').pop()!.toLowerCase().includes(q)
		);
	};

	const shown = $derived(
		displayIds
			.map((id) => logos.find((l) => l.id === id))
			.filter((l) => l !== undefined)
			.filter(matches)
	);

	const filtering = $derived(query.trim().length > 0);

	// Reordering acts on true positions, so it is only offered in the unfiltered
	// true-order view where what you see is what you move.
	const canReorder = $derived(!unnamedFirst && !filtering);

	function move(id: string, by: number) {
		const i = logos.findIndex((l) => l.id === id);
		const to = i + by;
		if (i < 0 || to < 0 || to >= logos.length) return;
		const next = [...logos];
		[next[i], next[to]] = [next[to], next[i]];
		logos = next.map((l, k) => ({ ...l, sort_order: k }));
		snapshotOrder();
	}

	// Always derived from the true order, never from what is on screen.
	const payload = $derived(
		JSON.stringify(logos.map((l, i) => ({ id: l.id, name: l.name, sort_order: i })))
	);

	const firstId = $derived(logos[0]?.id);
	const lastId = $derived(logos[logos.length - 1]?.id);
</script>

<ConfirmDialog bind:this={confirmer} />

<h1>Logo's</h1>
<p class="cms-lead">{data.logos.length} klantenlogo's.</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}
{#if form?.added}
	<div class="cms-ok">{form.added} staat nu op de logomuur. Publiceer om het live te zetten.</div>
{:else if form?.replaced}
	<div class="cms-ok">{form.replaced} is vervangen. Publiceer om het live te zetten.</div>
{:else if form?.saved}
	<div class="cms-ok">
		{#if form.changed === 0}
			Niets gewijzigd.
		{:else}
			{form.changed}
			{form.changed === 1 ? 'logo' : "logo's"} opgeslagen. Publiceer om het live te zetten.
		{/if}
	</div>
{/if}

{#if unnamed}
	<div class="cms-banner pending">
		<p>
			{unnamed} logo{unnamed === 1 ? '' : "'s"}
			{unnamed === 1 ? 'heeft' : 'hebben'} nog geen klantnaam. Google leest dan geen bedrijfsnaam
			bij het beeld.
		</p>
		<button
			type="button"
			class="cms-btn cms-btn-ghost cms-btn-small"
			onclick={() => (query = 'Klant')}
		>
			Toon enkel deze
		</button>
	</div>
{/if}

<div class="cms-card" style="margin-bottom:1.4rem">
	<h3>Logo toevoegen</h3>
	<p class="cms-hint" style="margin-top:0">
		Uploaden zet het logo meteen op de muur. Een bestand met dezelfde naam vervangt de
		afbeelding en laat de naam staan.
	</p>
	<form method="POST" action="?/upload" enctype="multipart/form-data"
	      use:enhance={() => async ({ update }) => {
		      await update();
		      reseed();
		      newName = '';
	      }}>
		<div class="cms-two">
			<div class="cms-field">
				<label for="new-file">Bestand</label>
				<input id="new-file" name="file" type="file"
				       accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif" required />
			</div>
			<div class="cms-field">
				<label for="new-name">Klantnaam</label>
				<input id="new-name" name="name" type="text" bind:value={newName}
				       placeholder="Bv. NeoKraft" />
				<p class="cms-hint">Laat leeg als je de naam later invult.</p>
			</div>
		</div>
		<button class="cms-btn" type="submit">Toevoegen</button>
	</form>
</div>

{#if data.unlinked.length}
	<div class="cms-banner pending" style="display:block">
		<p style="margin-bottom:.6rem">
			{data.unlinked.length}
			{data.unlinked.length === 1 ? 'afbeelding staat' : 'afbeeldingen staan'} wel in de
			mediabibliotheek, maar nog niet op de logomuur. Geef een naam en voeg toe.
		</p>
		<div class="cms-logos">
			{#each data.unlinked as file (file.key)}
				<form method="POST" action="?/add" class="cms-logo"
					      use:enhance={() => async ({ update }) => {
						      await update();
						      reseed();
					      }}>
					<img src={file.url} alt={file.name} />
					<p class="cms-hint" style="word-break:break-all;margin:.3rem 0">{file.name}</p>
					<input type="hidden" name="file_path" value={file.key} />
					<input type="text" name="name" placeholder="Klantnaam" aria-label="Klantnaam" />
					<button class="cms-btn cms-btn-small" type="submit" style="margin-top:.4rem">
						Toevoegen
					</button>
				</form>
			{/each}
		</div>
	</div>
{/if}

<form
	method="POST"
	action="?/save"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
			snapshotOrder();
		};
	}}
>
	<input type="hidden" name="logos" value={payload} />

	<div class="cms-actions" style="margin-bottom:.8rem">
		<button class="cms-btn" type="submit" disabled={busy}>
			{busy ? 'Bezig…' : 'Namen en volgorde opslaan'}
		</button>
		<label style="font-weight:500;display:flex;align-items:center;gap:.4rem">
			<input
				type="checkbox"
				bind:checked={unnamedFirst}
				onchange={snapshotOrder}
				style="width:auto"
			/>
			Toon logo&rsquo;s zonder naam eerst
		</label>
	</div>

	<div class="cms-search">
		<label class="cms-sr" for="logo-search">Zoek een logo</label>
		<input
			id="logo-search"
			type="search"
			placeholder="Zoek op klantnaam of bestandsnaam…"
			bind:value={query}
			autocomplete="off"
		/>
		{#if filtering}
			<button type="button" class="cms-btn cms-btn-ghost cms-btn-small" onclick={() => (query = '')}>
				Wissen
			</button>
		{/if}
	</div>

	<p class="cms-hint" style="margin:.4rem 0 1rem">
		{#if filtering}
			{shown.length} van {logos.length} logo's tonen &ldquo;{query}&rdquo;. Herschikken kan niet
			terwijl je zoekt.
		{:else if unnamedFirst}
			Logo's zonder naam staan vooraan. Dit is enkel een weergave; de volgorde op de site
			verandert er niet door, en kaarten blijven staan terwijl je typt. Zet dit uit om te
			herschikken.
		{:else}
			Dit is de volgorde zoals ze op de site staat. Gebruik de pijlen om te herschikken.
		{/if}
	</p>

	{#if shown.length === 0}
		<div class="cms-card"><p style="margin:0">Geen logo's gevonden voor &ldquo;{query}&rdquo;.</p></div>
	{/if}

	<div class="cms-logos">
		{#each shown as logo (logo.id)}
			<div class="cms-logo" class:needs-name={logo.name === 'Klant'}>
				<img
					src={resolveImage(logo.file_path)}
					alt={logo.name === 'Klant' ? 'Klantlogo' : `Logo van ${logo.name}`}
				/>
				<input type="text" bind:value={logo.name} aria-label="Naam van de klant" />
				{#if logo.name === 'Klant'}
					<p class="cms-hint" style="margin:.3rem 0 0">Naam ontbreekt</p>
				{/if}
				{#if canReorder}
					<div class="cms-actions" style="justify-content:center;margin-top:.4rem">
						<button
							type="button"
							class="cms-btn cms-btn-ghost cms-btn-small"
							onclick={() => move(logo.id, -1)}
							disabled={logo.id === firstId}
							aria-label="Eerder">↑</button
						>
						<button
							type="button"
							class="cms-btn cms-btn-ghost cms-btn-small"
							onclick={() => move(logo.id, 1)}
							disabled={logo.id === lastId}
							aria-label="Later">↓</button
						>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</form>

<h2>Logo verwijderen</h2>
<p class="cms-hint">Nieuwe logo's upload je bij <a href="/admin/media">Afbeeldingen</a>.</p>
<form
	method="POST"
	action="?/delete"
	use:enhance={() => async ({ update }) => {
		await update();
		reseed();
	}}
	onsubmit={(e) =>
		confirmSubmit(e, confirmer, {
			title: 'Dit logo verwijderen?',
			body: `${logos.find((l) => l.id === toDelete)?.name ?? 'Het logo'} verdwijnt van de referentiepagina en uit de logostrook op de startpagina.`,
			confirmLabel: 'Verwijderen'
		})}
>
	<div class="cms-field" style="max-width:420px">
		<label for="del">Kies een logo</label>
		<select id="del" name="id" bind:value={toDelete}>
			{#each logos as l (l.id)}<option value={l.id}>{l.name} — {l.file_path}</option>{/each}
		</select>
	</div>
	<button class="cms-btn cms-btn-danger cms-btn-small" type="submit">Verwijderen</button>
</form>
