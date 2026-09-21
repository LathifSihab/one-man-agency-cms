<script lang="ts">
	import { previewImage, isStorageKey } from '$lib/images';
	import { env } from '$env/dynamic/public';
	import MediaPicker from './MediaPicker.svelte';

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
	 *
	 * The library modal itself lives in MediaPicker, shared with the body editor.
	 */
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
	let picker: MediaPicker | undefined = $state();

	/* Straight from Storage: the baked /assets/media path only exists after a
	   publish, so it would be broken here right after an upload. */
	const preview = $derived(previewImage(value, env.PUBLIC_SUPABASE_URL));
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
				<button
					type="button"
					class="cms-btn cms-btn-ghost cms-btn-small"
					onclick={() => picker?.browse()}
				>
					Kies afbeelding
				</button>
				<button
					type="button"
					class="cms-btn cms-btn-ghost cms-btn-small"
					onclick={() => picker?.pickFile()}
				>
					Uploaden
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
		</div>
	</div>

	<input type="hidden" {name} bind:value />
</div>

<MediaPicker
	bind:this={picker}
	bind:open
	{folder}
	chosen={value}
	onchoose={(key) => (value = key)}
/>
