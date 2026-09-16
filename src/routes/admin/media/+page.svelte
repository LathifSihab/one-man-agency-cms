<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import { confirmSubmit } from '$lib/components/admin/confirmSubmit';
	let { data, form } = $props();

	const LABEL: Record<string, string> = {
		site: 'Website', logos: "Klantenlogo's", blog: 'Blogafbeeldingen'
	};
	const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/avif';

	function kb(bytes: number): string {
		return bytes > 1_000_000
			? `${(bytes / 1_048_576).toFixed(1)} MB`
			: `${Math.max(1, Math.round(bytes / 1024))} kB`;
	}

	let confirmer: ConfirmDialog;

	/* The replace button is not the file input: it opens the hidden input that
	   sits in the same form, so the card keeps one control instead of a file
	   picker per image sitting open on the page. */
	function pick(e: MouseEvent) {
		const form = (e.currentTarget as HTMLElement).closest('form');
		form?.querySelector<HTMLInputElement>('input[type=file]')?.click();
	}

	/* Chosen, then confirmed, then submitted: replacing writes over the file at
	   the same path, which is the point -- every page already pointing at it
	   picks up the new image -- and is also why it is worth asking first. */
	async function chosen(e: Event, name: string) {
		const input = e.currentTarget as HTMLInputElement;
		const el = input.closest('form');
		if (!el || !input.files?.length) return;
		const ok = await confirmer.ask({
			title: `${name} vervangen?`,
			body: `De nieuwe afbeelding komt op hetzelfde pad te staan als ${name}. Overal waar deze afbeelding al gebruikt wordt, verschijnt vanaf de volgende publicatie de nieuwe versie. De oude is daarna weg.`,
			confirmLabel: 'Vervangen',
			danger: false
		});
		if (ok) el.requestSubmit();
		else input.value = '';
	}

	const deleteQuestion = (name: string) => ({
		title: `${name} verwijderen?`,
		body: 'De afbeelding verdwijnt uit de mediabibliotheek. Pagina’s die er nog naar verwijzen, tonen daarna niets.',
		confirmLabel: 'Verwijderen'
	});
</script>

<ConfirmDialog bind:this={confirmer} />

<h1>Afbeeldingen</h1>
<p class="cms-lead">
	Afbeeldingen worden bij het publiceren mee in de site gebouwd, zodat bezoekers niets extra
	hoeven te laden.
</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}
{#if form?.saved}<div class="cms-ok">Klaar. Publiceer om het live te zetten.</div>{/if}

<div class="cms-card" style="margin-bottom:1.5rem">
	<h3>Nieuwe afbeelding</h3>
	<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance>
		<div class="cms-two">
			<div class="cms-field">
				<label for="u-file">Bestand</label>
				<input id="u-file" name="file" type="file" accept={ACCEPT} required />
				<p class="cms-hint">PNG, JPEG, WebP, AVIF of SVG. Maximaal 8 MB.</p>
			</div>
			<div class="cms-field">
				<label for="u-prefix">Map</label>
				<select id="u-prefix" name="prefix">
					<option value="site">Website</option>
					<option value="blog">Blogafbeeldingen</option>
					<option value="logos">Klantenlogo's</option>
				</select>
			</div>
		</div>
		<button class="cms-btn" type="submit">Uploaden</button>
	</form>
</div>

{#each data.folders as folder (folder.prefix)}
	<h2>{LABEL[folder.prefix]} <span class="cms-meta">({folder.files.length})</span></h2>
	{#if !folder.files.length}
		<p class="cms-hint">Nog niets in deze map.</p>
	{:else}
		<div class="cms-logos">
			{#each folder.files as file (file.path)}
				<div class="cms-logo">
					<!-- ?v= is the file's own last-changed stamp: the URL of a replaced
					     image is unchanged and cached for a year, so without it this
					     page would keep showing the picture that was just replaced. -->
					<img src="{file.url}?v={file.version}" alt={file.name} />
					<p class="cms-hint" style="word-break:break-all;margin:.3rem 0">{file.name}</p>
					<p class="cms-meta">{kb(file.size)}</p>
					<div class="cms-actions" style="justify-content:center">
						<form method="POST" action="?/replace" enctype="multipart/form-data" use:enhance>
							<input type="hidden" name="path" value={file.path} />
							<input type="file" name="file" accept={ACCEPT} style="display:none"
							       onchange={(e) => chosen(e, file.name)} />
							<button type="button" class="cms-btn cms-btn-ghost cms-btn-small" onclick={pick}>
								Vervangen
							</button>
						</form>
						<form method="POST" action="?/delete" use:enhance
						      onsubmit={(e) => confirmSubmit(e, confirmer, deleteQuestion(file.name))}>
							<input type="hidden" name="path" value={file.path} />
							<button class="cms-btn cms-btn-danger cms-btn-small" type="submit">Wis</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/each}
