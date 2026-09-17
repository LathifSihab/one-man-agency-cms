<script lang="ts">
	import { previewImage, isStorageKey } from '$lib/images';
	import { env } from '$env/dynamic/public';

	/**
	 * An image field that points at the media library instead of asking for a
	 * path to be typed.
	 *
	 * Uploading a file and using it were two unconnected acts before this: the
	 * media library wrote to Storage, and every image field was a text box you
	 * had to fill in from memory. This closes that gap — pick, or upload and
	 * pick in one step.
	 *
	 * The value stored is a Storage key ("site/niels.jpg") for anything chosen
	 * here, or an untouched repo path ("/assets/niels.jpg") for images that
	 * shipped with the site.
	 */
	interface MediaFile {
		key: string;
		name: string;
		size: number;
		url: string;
		version: number;
	}

	interface Props {
		label: string;
		name: string;
		value: string;
		/** Which folder an upload from here lands in. */
		folder?: 'site' | 'logos' | 'blog';
		hint?: string;
	}

	let { label, name, value = $bindable(), folder = 'site', hint = '' }: Props = $props();

	let open = $state(false);
	let loading = $state(false);
	let uploading = $state(false);
	let error = $state('');
	let query = $state('');
	let folders = $state<{ prefix: string; files: MediaFile[] }[]>([]);
	let fileInput = $state<HTMLInputElement>();

	/* Straight from Storage: the baked /assets/media path only exists after a
	   publish, so it would be broken here right after an upload. */
	const preview = $derived(previewImage(value, env.PUBLIC_SUPABASE_URL));

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/admin/api/media');
			if (!res.ok) throw new Error(`${res.status}`);
			folders = (await res.json()).folders;
		} catch {
			error = 'De mediabibliotheek kon niet geladen worden.';
		} finally {
			loading = false;
		}
	}

	function browse() {
		open = true;
		if (!folders.length) load();
	}

	function choose(key: string) {
		value = key;
		open = false;
	}

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploading = true;
		error = '';
		try {
			const body = new FormData();
			body.set('file', file);
			body.set('prefix', folder);
			const res = await fetch('/admin/media?/upload', { method: 'POST', body });
			if (!res.ok) throw new Error(`${res.status}`);
			await load();
			// Use it straight away: uploading here means "I want this one".
			value = `${folder}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
			open = false;
		} catch {
			error = 'Uploaden is niet gelukt.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	const shown = $derived(
		folders
			.map((f) => ({
				...f,
				files: f.files.filter((file) =>
					file.name.toLowerCase().includes(query.trim().toLowerCase())
				)
			}))
			.filter((f) => f.files.length)
	);

	const FOLDER_LABEL: Record<string, string> = {
		site: 'Website',
		logos: "Klantenlogo's",
		blog: 'Blogafbeeldingen'
	};
</script>

<div class="cms-field">
	<p class="cms-group-label">{label}</p>

	<div class="cms-imagefield">
		<div class="cms-imagefield-preview">
			{#if preview}
				<img src={preview} alt="" />
			{:else}
				<span class="cms-hint">Geen afbeelding</span>
			{/if}
		</div>

		<div class="cms-imagefield-body">
			<p class="cms-meta" style="word-break:break-all;margin:0 0 .5rem">
				{value || 'Nog niets gekozen'}
				{#if value && !isStorageKey(value)}
					<br /><span class="cms-hint">Hoort bij de site zelf, niet bij de mediabibliotheek.</span>
				{/if}
			</p>
			<div class="cms-actions">
				<button type="button" class="cms-btn cms-btn-ghost cms-btn-small" onclick={browse}>
					Kies afbeelding
				</button>
				<button
					type="button"
					class="cms-btn cms-btn-ghost cms-btn-small"
					onclick={() => fileInput?.click()}
					disabled={uploading}
				>
					{uploading ? 'Bezig…' : 'Uploaden'}
				</button>
				{#if value}
					<button
						type="button"
						class="cms-btn cms-btn-ghost cms-btn-small"
						onclick={() => (value = '')}
					>
						Wissen
					</button>
				{/if}
			</div>
			{#if hint}<p class="cms-hint">{hint}</p>{/if}
			{#if error}<p class="cms-hint" style="color:#a32222">{error}</p>{/if}
		</div>
	</div>

	<input type="hidden" {name} bind:value />
	<input
		bind:this={fileInput}
		type="file"
		accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif"
		style="display:none"
		onchange={upload}
	/>
</div>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="cms-picker-backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
	>
		<div class="cms-picker" role="dialog" aria-label="Kies een afbeelding" aria-modal="true">
			<div class="cms-picker-head">
				<strong>Kies een afbeelding</strong>
				<button type="button" class="cms-btn cms-btn-ghost cms-btn-small" onclick={() => (open = false)}>
					Sluiten
				</button>
			</div>

			<div class="cms-search" style="margin-bottom:.8rem">
				<input type="search" placeholder="Zoek op bestandsnaam…" bind:value={query} autocomplete="off" />
			</div>

			{#if loading}
				<p class="cms-hint">Bezig met laden…</p>
			{:else if !shown.length}
				<p class="cms-hint">Niets gevonden. Upload een nieuwe afbeelding.</p>
			{:else}
				{#each shown as group (group.prefix)}
					<h3 style="margin-top:1rem">{FOLDER_LABEL[group.prefix] ?? group.prefix}</h3>
					<div class="cms-logos">
						{#each group.files as file (file.key)}
							<button
								type="button"
								class="cms-logo cms-pickable"
								class:chosen={value === file.key}
								onclick={() => choose(file.key)}
							>
								<img src="{file.url}?v={file.version}" alt={file.name} />
								<p class="cms-hint" style="word-break:break-all;margin:.3rem 0 0">{file.name}</p>
							</button>
						{/each}
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}
