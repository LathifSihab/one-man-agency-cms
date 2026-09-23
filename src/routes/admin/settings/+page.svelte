<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import RepeatRows from '$components/admin/RepeatRows.svelte';

	let { data, form } = $props();
	// Read once on purpose: these seed the editing state below.
	const s = untrack(() => data.settings);

	let navigation = $state([...(s?.navigation ?? [])]);
	let socials = $state([...(s?.socials ?? [])]);
	let footerSectors = $state([...(s?.footer_sectors ?? [])]);
	let footerRegions = $state([...(s?.footer_regions ?? [])]);
	let busy = $state(false);

	const FIELDS = [
		['naam', 'Bedrijfsnaam'],
		['juridisch', 'Juridische naam'],
		['straat', 'Straat en nummer'],
		['postcode', 'Postcode'],
		['stad', 'Gemeente'],
		['btw', 'Btw-nummer'],
		['telefoon', 'Telefoon, zoals getoond'],
		['telefoon_link', 'Telefoon, om te bellen'],
		['email', 'E-mailadres'],
		['slogan', 'Slogan']
	] as const;
</script>

<h1>Instellingen</h1>
<p class="cms-lead">Bedrijfsgegevens, navigatie, voettekst en sociale media.</p>

<div class="cms-banner pending">
	<p>
		Deze gegevens staan in de gestructureerde data van <strong>alle 41 pagina's</strong>. Een
		wijziging hier verandert wat Google en AI-assistenten over het bedrijf weten.
	</p>
</div>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}
{#if form?.saved && form.broken?.length}
	<div class="cms-error">
		<p style="margin:0 0 .4rem">
			Opgeslagen, maar {form.broken.length === 1 ? 'deze link verwijst' : 'deze links verwijzen'}
			naar een pagina die niet bestaat. Publiceren lukt pas als dat is aangepast:
		</p>
		<ul style="margin:0">
			{#each form.broken as line (line)}<li><code>{line}</code></li>{/each}
		</ul>
	</div>
{:else if form?.saved}
	<div class="cms-ok">Opgeslagen. Publiceer om het live te zetten.</div>
{/if}

<form method="POST" action="?/save" use:enhance={() => {
	busy = true;
	return async ({ update }) => { await update({ reset: false }); busy = false; };
}}>
	<h2>Bedrijfsgegevens</h2>
	<div class="cms-two">
		{#each FIELDS as [key, label] (key)}
			<div class="cms-field">
				<label for="c-{key}">{label}</label>
				<input id="c-{key}" name="company.{key}" type="text" value={s?.company?.[key] ?? ''} />
			</div>
		{/each}
	</div>

	<h2>Knop in de navigatiebalk</h2>
	<div class="cms-two">
		<div class="cms-field">
			<label for="cta-label">Tekst</label>
			<input id="cta-label" name="cta.label" type="text" value={s?.header_cta?.label ?? ''} />
		</div>
		<div class="cms-field">
			<label for="cta-link">Link</label>
			<input id="cta-link" name="cta.link" type="text" value={s?.header_cta?.link ?? ''} />
		</div>
	</div>

	<h2>Navigatie</h2>
	<RepeatRows label="Menu-items" noun="item" bind:rows={navigation}
	            fields={[{ key: 'label', label: 'Tekst' }, { key: 'link', label: 'Link' }]}
	            summary={(r) => String(r.label ?? '')} />
	<input type="hidden" name="navigation" value={JSON.stringify(navigation)} />

	<h2>Voettekst</h2>
	<p class="cms-hint" style="margin-top:0">
		De kolommen Sectoren en Regio onderaan elke pagina. Wijzig je het webadres van een
		sector- of regiopagina, pas dan ook de link hier aan.
	</p>

	<h3>Sectoren</h3>
	<RepeatRows label="Links" noun="sector" bind:rows={footerSectors}
	            fields={[{ key: 'label', label: 'Tekst' }, { key: 'link', label: 'Link', placeholder: '/sectoren/…' }]}
	            summary={(r) => String(r.label ?? '')} />
	<input type="hidden" name="footer_sectors" value={JSON.stringify(footerSectors)} />
	{#if data.sectorPages.length}
		<details class="cms-hint" style="margin:.4rem 0 1.2rem">
			<summary>Bestaande sectorpagina's ({data.sectorPages.length})</summary>
			<ul>
				{#each data.sectorPages as p (p.link)}<li>{p.title}: <code>{p.link}</code></li>{/each}
			</ul>
		</details>
	{/if}

	<h3>Regio</h3>
	<RepeatRows label="Links" noun="regio" bind:rows={footerRegions}
	            fields={[{ key: 'label', label: 'Tekst' }, { key: 'link', label: 'Link', placeholder: '/regio/…' }]}
	            summary={(r) => String(r.label ?? '')} />
	<input type="hidden" name="footer_regions" value={JSON.stringify(footerRegions)} />
	{#if data.regionPages.length}
		<details class="cms-hint" style="margin:.4rem 0 1.2rem">
			<summary>Bestaande regiopagina's ({data.regionPages.length})</summary>
			<ul>
				{#each data.regionPages as p (p.link)}<li>{p.title}: <code>{p.link}</code></li>{/each}
			</ul>
		</details>
	{/if}

	<h2>Sociale media</h2>
	<RepeatRows label="Profielen" noun="profiel" bind:rows={socials}
	            fields={[{ key: 'naam', label: 'Naam' }, { key: 'url', label: 'Adres' }]}
	            summary={(r) => String(r.naam ?? '')} />
	<input type="hidden" name="socials" value={JSON.stringify(socials)} />

	<h2>Formulieren</h2>
	<div class="cms-field">
		<label for="fs">Formspree-ID</label>
		<input id="fs" name="formspree_id" type="text" value={s?.formspree_id ?? ''} />
		<p class="cms-hint">
			Niet meer in gebruik: formulieren worden nu rechtstreeks bewaard en verschijnen bij
			<a href="/admin/submissions">Berichten</a>. Dit veld blijft staan als terugvaloptie.
		</p>
	</div>

	<div class="cms-actions" style="margin-top:1.5rem">
		<button class="cms-btn" type="submit" disabled={busy}>{busy ? 'Bezig…' : 'Opslaan'}</button>
		<span class="cms-hint">Opslaan wijzigt de live site nog niet.</span>
	</div>
</form>
