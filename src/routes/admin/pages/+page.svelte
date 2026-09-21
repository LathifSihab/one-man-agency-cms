<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let open = $state(false);
	let type = $state('service');
	let title = $state('');
	let slug = $state('');
	let busy = $state(false);

	/* Suggest an address from the title, until the address is typed in. */
	let slugEdited = $state(false);
	const suggestion = $derived(
		title
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60)
	);
	const address = $derived(slugEdited ? slug : suggestion);

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

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}

<div class="cms-card" style="margin-bottom:1.6rem">
	{#if !open}
		<div class="cms-row-head">
			<strong>Een pagina toevoegen</strong>
			<button class="cms-btn cms-btn-small" type="button" onclick={() => (open = true)}>
				Nieuwe pagina
			</button>
		</div>
		<p class="cms-hint" style="margin:.4rem 0 0">
			Bijvoorbeeld een nieuwe dienst. Die verschijnt daarna vanzelf in het dienstenoverzicht.
		</p>
	{:else}
		<h3 style="margin-top:0">Nieuwe pagina</h3>
		<form method="POST" action="?/create"
		      use:enhance={() => {
			      busy = true;
			      return async ({ update }) => {
				      await update();
				      busy = false;
			      };
		      }}>
			<div class="cms-two">
				<div class="cms-field">
					<label for="n-type">Soort</label>
					<select id="n-type" name="type" bind:value={type}>
						<option value="service">Dienst</option>
						<option value="page">Vaste pagina</option>
						<option value="sector">Sector</option>
						<option value="region">Regio</option>
					</select>
				</div>
				<div class="cms-field">
					<label for="n-title">Titel</label>
					<input id="n-title" name="title" type="text" bind:value={title} required
					       placeholder="Bv. Videomarketing" />
				</div>
			</div>

			<div class="cms-field">
				<label for="n-slug">Webadres</label>
				<input id="n-slug" name="slug" type="text" value={address} required
				       oninput={(e) => {
					       slugEdited = true;
					       slug = e.currentTarget.value;
				       }} />
				<p class="cms-hint">
					De pagina komt op <strong>{route[type]}/{address || '…'}</strong> te staan. Dit adres
					kan je later nog wijzigen, maar dan werken bestaande links naar de pagina niet meer.
				</p>
			</div>

			<div class="cms-actions">
				<button class="cms-btn" type="submit" disabled={busy || !address}>
					{busy ? 'Bezig…' : 'Aanmaken en invullen'}
				</button>
				<button class="cms-btn cms-btn-ghost" type="button" onclick={() => (open = false)}>
					Annuleren
				</button>
			</div>
			<p class="cms-hint">
				De pagina wordt aangemaakt met een notitie &ldquo;nog in te vullen&rdquo; en staat nog
				niet in Google, zodat ze niet half af gevonden wordt.
			</p>
		</form>
	{/if}
</div>

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
						{#if p.in_services}<span class="cms-badge">Bij de diensten</span>{/if}
					</td>
					<td><a class="cms-btn cms-btn-ghost cms-btn-small"
					       href="/admin/pages/{p.type}/{p.slug}">Bewerken</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/each}
