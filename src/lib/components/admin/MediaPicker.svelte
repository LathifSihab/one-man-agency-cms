<script lang="ts">
	/**
	 * The media library as a modal: browse what is already uploaded, or upload
	 * and use in one step.
	 *
	 * Lifted out of ImageField so the body editor can offer the same thing.
	 * Placing an image in the text used to have no path through the CMS at all,
	 * and a screenshot's filename ended up typed into a page as plain text.
	 */
	interface MediaFile {
		key: string;
		name: string;
		size: number;
		url: string;
		version: number;
	}

	interface Props {
		open: boolean;
		/** Which folder an upload from here lands in. */
		folder?: 'site' | 'logos' | 'blog';
		/** Highlighted as already in use. */
		chosen?: string;
		onchoose: (key: string) => void;
		title?: string;
	}

	let {
		open = $bindable(),
		folder = 'site',
		chosen = '',
		onchoose,
		title = 'Kies een afbeelding'
	}: Props = $props();

	let loading = $state(false);
	let uploading = $state(false);
	let error = $state('');
	let query = $state('');
	let folders = $state<{ prefix: string; files: MediaFile[] }[]>([]);
	let fileInput = $state<HTMLInputElement>();

	export async function load() {
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

	/** Open, loading the library the first time it is needed. */
	export function browse() {
		open = true;
		if (!folders.length) load();
	}

	function choose(key: string) {
		onchoose(key);
		open = false;
	}

	export async function upload(event: Event) {
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
			choose(`${folder}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`);
		} catch {
			error = 'Uploaden is niet gelukt.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	/** So a parent can offer its own upload button. */
	export function pickFile() {
		fileInput?.click();
	}

	export function isUploading() {
		return uploading;
	}

	export function lastError() {
		return error;
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

<input
	bind:this={fileInput}
	type="file"
	accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif"
	style="display:none"
	onchange={upload}
/>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="cms-picker-backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
	>
		<div class="cms-picker" role="dialog" aria-label={title} aria-modal="true">
			<div class="cms-picker-head">
				<strong>{title}</strong>
				<span class="cms-actions">
					<button
						type="button"
						class="cms-btn cms-btn-ghost cms-btn-small"
						onclick={() => fileInput?.click()}
						disabled={uploading}
					>
						{uploading ? 'Bezig…' : 'Uploaden'}
					</button>
					<button
						type="button"
						class="cms-btn cms-btn-ghost cms-btn-small"
						onclick={() => (open = false)}
					>
						Sluiten
					</button>
				</span>
			</div>

			<div class="cms-search" style="margin-bottom:.8rem">
				<input
					type="search"
					placeholder="Zoek op bestandsnaam…"
					bind:value={query}
					autocomplete="off"
				/>
			</div>

			{#if error}<p class="cms-hint" style="color:#a32222">{error}</p>{/if}

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
								class:chosen={chosen === file.key}
								onclick={() => choose(file.key)}
							>
								<img src="{file.url}?v={file.version}" alt={file.name} />
								<p class="cms-hint" style="word-break:break-all;margin:.3rem 0 0">
									{file.name}
								</p>
							</button>
						{/each}
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}
