<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import CountedField from '$components/admin/CountedField.svelte';
	import MarkdownEditor from '$components/admin/MarkdownEditor.svelte';
	import { CATEGORIES } from '$lib/categories';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import { confirmSubmit } from '$lib/components/admin/confirmSubmit';
	import ImageField from '$lib/components/admin/ImageField.svelte';

	let { data, form } = $props();
	// Read once on purpose: these seed the editing state below.
	const post = untrack(() => data.post);

	let title = $state(post.title ?? '');
	let seoTitle = $state(post.seo_title ?? '');
	let metaDescription = $state(post.meta_description ?? '');
	let intro = $state(post.intro ?? '');
	let body = $state(post.body ?? '');
	let slug = $state(post.slug ?? '');
	let showAdvanced = $state(false);
	let imageUrl = $state(post.image_url ?? '');
	let confirmer: ConfirmDialog | undefined = $state();
	let busy = $state(false);

	const slugChanged = $derived(slug !== post.slug);
</script>

<ConfirmDialog bind:this={confirmer} />

<p class="cms-meta"><a href="/admin/blog">&larr; Alle artikels</a></p>
<h1>{title || post.slug}</h1>
<p class="cms-lead">
	<a href="/blog/{slug}" target="_blank" rel="noopener">/blog/{slug} ↗</a>
	{#if !post.is_published}<span class="cms-badge draft">Concept</span>{/if}
</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}
{#if form?.saved}
	<div class="cms-ok">
		Opgeslagen. Dit staat nog niet op de live site — publiceer via het overzicht.
	</div>
{/if}

<form id="post-editor" method="POST" action="?/save" use:enhance={() => {
	busy = true;
	return async ({ update }) => { await update({ reset: false }); busy = false; };
}}>
	<div class="cms-field">
		<label for="f-title">Titel</label>
		<input id="f-title" name="title" type="text" bind:value={title} required />
	</div>

	<CountedField label="SEO-titel" name="seo_title" bind:value={seoTitle} limit={62} required
	              hint="De titel in de zoekresultaten van Google." />

	<CountedField label="Meta-omschrijving" name="meta_description" bind:value={metaDescription}
	              limit={158} multiline required hint="De korte tekst onder de titel in Google." />

	<div class="cms-field">
		<label for="f-intro">Inleiding</label>
		<textarea id="f-intro" name="intro" bind:value={intro} rows="3" required></textarea>
	</div>

	<MarkdownEditor bind:value={body} />
	<input type="hidden" name="body" value={body} />

	<div class="cms-two">
		<div class="cms-field">
			<label for="f-date">Datum</label>
			<input id="f-date" name="published_on" type="date" value={post.published_on} required />
		</div>
		<div class="cms-field">
			<label for="f-cat">Categorie</label>
			<select id="f-cat" name="category">
				<option value="">— geen —</option>
				{#each CATEGORIES as c (c)}
					<option value={c} selected={post.category === c}>{c}</option>
				{/each}
			</select>
		</div>
	</div>

	<ImageField
		label="Afbeelding bij dit artikel"
		name="image_url"
		bind:value={imageUrl}
		folder="blog"
		hint="Kies een bestaande afbeelding of upload er meteen een."
	/>

	<div class="cms-field">
		<label style="font-weight:600">
			<input type="checkbox" name="is_published" checked={post.is_published}
			       style="width:auto;margin-right:.4rem" />
			Publiceren
		</label>
		<p class="cms-hint">
			Staat dit uit, dan verschijnt het artikel niet op de site, ook niet na publiceren.
		</p>
	</div>

	{#if showAdvanced}
		<div class="cms-field">
			<label for="f-legacy">Oude webadres</label>
			<input id="f-legacy" name="legacy_url" type="text" value={post.legacy_url ?? ''} />
			<p class="cms-hint">
				Stuurt een oud adres van de vorige website door naar dit artikel. Niet wijzigen tenzij
				je weet waarom.
			</p>
		</div>

		<div class="cms-field">
			<label for="f-slug">Webadres</label>
			<input id="f-slug" name="slug" type="text" bind:value={slug} />
			{#if slugChanged}
				<div class="cms-banner failed" style="margin-top:.6rem">
					<p>Je wijzigt het webadres. De oude link /blog/{post.slug} werkt daarna niet meer.</p>
				</div>
			{/if}
		</div>
	{/if}

</form>

<!--
  Delete is its own form: a form cannot be nested inside another. The buttons sit
  outside both and are tied to the right one with the form attribute, which is
  what lets them share a row.

  An earlier attempt put delete inside the editor form with formaction and chose
  in onsubmit which question to ask. use:enhance handled the submit before that
  handler could stop it, so the confirmation was skipped and the post was deleted
  on the first click.
-->
<form
	id="post-delete"
	method="POST"
	action="?/delete"
	use:enhance
	onsubmit={(e) =>
		confirmSubmit(e, confirmer, {
			title: 'Dit artikel verwijderen?',
			body: `“${title}” wordt definitief verwijderd. Na de volgende publicatie is het adres /blog/${post.slug} niet meer bereikbaar.`,
			confirmLabel: 'Definitief verwijderen'
		})}
></form>

<div class="cms-actionbar">
	<button class="cms-btn" type="submit" form="post-editor" disabled={busy}>
		{busy ? 'Bezig…' : 'Opslaan'}
	</button>

	<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
	        onclick={() => (showAdvanced = !showAdvanced)}>
		{showAdvanced ? 'Verberg' : 'Toon'} geavanceerd
	</button>

	<button class="cms-btn cms-btn-danger cms-btn-small cms-actionbar-end"
	        type="submit" form="post-delete">
		Artikel verwijderen
	</button>
</div>

<!-- Below the row rather than in it: it explains, it is not a control, and in
     the row it pushed the buttons onto a second line. -->
<p class="cms-hint" style="margin-top:.6rem">Opslaan wijzigt de live site nog niet.</p>
