<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolveImage } from '$lib/images';
	let { data, form } = $props();

	let showNew = $state(false);
	let newTitle = $state('');
	let newSlug = $state('');

	// Suggest an address from the title, until the editor types their own.
	let slugTouched = $state(false);
	$effect(() => {
		if (!slugTouched) {
			newSlug = newTitle
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
		}
	});

	const fmt = (iso: string) =>
		new Date(iso).toLocaleDateString('nl-BE', { dateStyle: 'medium' });
</script>

<h1>Blog</h1>
<p class="cms-lead">{data.posts.length} artikels, nieuwste eerst.</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}

<div class="cms-actions" style="margin-bottom:1.2rem">
	<button class="cms-btn" onclick={() => (showNew = !showNew)}>
		{showNew ? 'Annuleren' : 'Nieuw artikel'}
	</button>
</div>

{#if showNew}
	<div class="cms-card" style="margin-bottom:1.4rem">
		<form method="POST" action="?/create" use:enhance>
			<div class="cms-field">
				<label for="n-title">Titel</label>
				<input id="n-title" name="title" type="text" bind:value={newTitle} required />
			</div>
			<div class="cms-field">
				<label for="n-slug">Webadres</label>
				<input id="n-slug" name="slug" type="text" bind:value={newSlug}
				       oninput={() => (slugTouched = true)} required />
				<p class="cms-hint">Het artikel komt op /blog/{newSlug || '…'}</p>
			</div>
			<button class="cms-btn" type="submit">Aanmaken als concept</button>
			<p class="cms-hint">Een nieuw artikel staat eerst op concept en is nog niet zichtbaar.</p>
		</form>
	</div>
{/if}

<table class="cms-table">
	<thead><tr><th>Beeld</th><th>Titel</th><th>Datum</th><th>Categorie</th><th>Status</th><th></th></tr></thead>
	<tbody>
		{#each data.posts as post (post.slug)}
			<tr>
				<td class="cms-thumb">
					{#if post.image_url}
						<img src={resolveImage(post.image_url)} alt="" />
					{:else}
						<span class="cms-hint">—</span>
					{/if}
				</td>
				<td><a href="/admin/blog/{post.slug}">{post.title}</a></td>
				<td class="cms-meta">{fmt(post.published_on)}</td>
				<td class="cms-meta">{post.category ?? '—'}</td>
				<td>
					{#if post.is_published}
						<span class="cms-badge ok">Gepubliceerd</span>
					{:else}
						<span class="cms-badge draft">Concept</span>
					{/if}
				</td>
				<td><a class="cms-btn cms-btn-ghost cms-btn-small"
				       href="/admin/blog/{post.slug}">Bewerken</a></td>
			</tr>
		{/each}
	</tbody>
</table>
