<script lang="ts">
	/**
	 * A text field with a live character counter that turns red past the limit.
	 *
	 * The 62/158 limits are not cosmetic: they are why every title and meta
	 * description renders in full in search results. The database enforces them
	 * too, but the editor must show the problem while typing rather than failing
	 * on save.
	 */
	interface Props {
		label: string;
		name: string;
		value: string;
		limit: number;
		hint?: string;
		multiline?: boolean;
		required?: boolean;
	}

	let {
		label,
		name,
		value = $bindable(),
		limit,
		hint = '',
		multiline = false,
		required = false
	}: Props = $props();

	const over = $derived(value.length > limit);
	const id = $derived(`f-${name}`);
</script>

<div class="cms-field">
	<label for={id}>
		{label}
		<span class="cms-counter" class:over aria-live="polite">{value.length}/{limit}</span>
	</label>
	{#if multiline}
		<textarea {id} {name} bind:value class:over {required} rows="3"></textarea>
	{:else}
		<input {id} {name} type="text" bind:value class:over {required} />
	{/if}
	{#if hint}<p class="cms-hint">{hint}</p>{/if}
	{#if over}
		<p class="cms-hint" style="color:#a32222">
			{value.length - limit} teken{value.length - limit === 1 ? '' : 's'} te lang. Google knipt
			de tekst af.
		</p>
	{/if}
</div>
