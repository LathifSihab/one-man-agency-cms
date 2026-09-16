<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';
	import { SHORTCODES, NOOP_TOKENS, splitBody, unknownTokens } from '$lib/shortcodes';

	/**
	 * Body editor: a formatting toolbar, insertable content blocks, and a live
	 * preview.
	 *
	 * Niels is a marketer, not a developer. He should never have to know that the
	 * body is Markdown or that a block is spelled `{{diensten}}` — the toolbar
	 * writes the syntax and the preview shows each block as a labelled placeholder.
	 */
	interface Props {
		value: string;
		/** Which blocks have backing data, so we can warn about empty ones. */
		emptyBlocks?: string[];
	}

	let { value = $bindable(), emptyBlocks = [] }: Props = $props();

	let textarea: HTMLTextAreaElement | null = $state(null);

	function surround(before: string, after = before, placeholder = 'tekst') {
		if (!textarea) return;
		const { selectionStart: s, selectionEnd: e } = textarea;
		const selected = value.slice(s, e) || placeholder;
		value = value.slice(0, s) + before + selected + after + value.slice(e);
		queueMicrotask(() => {
			textarea?.focus();
			textarea?.setSelectionRange(s + before.length, s + before.length + selected.length);
		});
	}

	function atLineStart(prefix: string) {
		if (!textarea) return;
		const s = textarea.selectionStart;
		const lineStart = value.lastIndexOf('\n', s - 1) + 1;
		value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
		queueMicrotask(() => {
			textarea?.focus();
			textarea?.setSelectionRange(s + prefix.length, s + prefix.length);
		});
	}

	function insertBlock(token: string) {
		if (!textarea) return;
		const s = textarea.selectionStart;
		const before = value.slice(0, s).replace(/\s*$/, '');
		const after = value.slice(s).replace(/^\s*/, '');
		value = `${before}\n\n${token}\n\n${after}`.replace(/^\n+/, '');
		queueMicrotask(() => textarea?.focus());
	}

	const label = (token: string) =>
		SHORTCODES.find((s) => s.token === token)?.label ?? token;

	const parts = $derived(splitBody(value));
	const unknown = $derived(unknownTokens(value));
	const usedEmpty = $derived(
		parts.filter((p) => p.kind === 'block' && emptyBlocks.includes(p.value)).map((p) => p.value)
	);
</script>

<div class="cms-field">
	<label for="body-editor">Inhoud</label>

	<div class="cms-toolbar">
		<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
		        onclick={() => atLineStart('## ')}>Tussentitel</button>
		<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
		        onclick={() => surround('**')}><strong>Vet</strong></button>
		<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
		        onclick={() => surround('*')}><em>Cursief</em></button>
		<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
		        onclick={() => atLineStart('- ')}>Opsomming</button>
		<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
		        onclick={() => atLineStart('1. ')}>Genummerd</button>
		<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
		        onclick={() => surround('[', '](/pagina)', 'linktekst')}>Link</button>
	</div>

	<textarea id="body-editor" bind:this={textarea} bind:value rows="20"></textarea>

	<p class="cms-hint">
		Gebruik de knoppen hierboven; je hoeft geen opmaakcodes te kennen.
	</p>
</div>

<div class="cms-field">
	<p class="cms-group-label">Blokken invoegen</p>
	<p class="cms-hint" style="margin-bottom:.5rem">
		Een blok toont automatisch inhoud die elders beheerd wordt, bijvoorbeeld de
		dienstenlijst of de prijstabel.
	</p>
	<div class="cms-actions">
		{#each SHORTCODES as s (s.token)}
			<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
			        title={s.description} onclick={() => insertBlock(s.token)}>
				+ {s.label}
			</button>
		{/each}
	</div>
</div>

{#if unknown.length}
	<div class="cms-banner failed">
		<p>Onbekend blok: {unknown.join(', ')} — dit toont niets op de site.</p>
	</div>
{/if}

{#if usedEmpty.length}
	<div class="cms-banner pending">
		<p>
			{usedEmpty.map(label).join(', ')} —
			{usedEmpty.length === 1 ? 'dit blok heeft' : 'deze blokken hebben'} nog geen inhoud en
			{usedEmpty.length === 1 ? 'blijft' : 'blijven'} leeg op de site.
		</p>
	</div>
{/if}

<div class="cms-field">
	<p class="cms-group-label">Voorbeeld</p>
	<div class="cms-preview">
		{#each parts as part, i (i)}
			{#if part.kind === 'prose'}
				{@html renderMarkdown(part.value)}
			{:else}
				<span class="cms-shortcode">Blok: {label(part.value)}</span>
			{/if}
		{/each}
		{#if !parts.length}<p class="cms-hint">Nog geen inhoud.</p>{/if}
	</div>
	<p class="cms-hint">
		Blokken staan hier als gekleurd kader; op de site tonen ze de echte inhoud.
	</p>
</div>
