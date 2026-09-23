<script lang="ts">
	import { untrack } from 'svelte';

	/**
	 * The page as it will look on the site, while it is being written.
	 *
	 * This replaced a preview that drew each block as a labelled frame, which
	 * showed that a block was there but not what a visitor would see. Now the
	 * editor's own form is posted to /admin/preview, which renders the real public
	 * page from it, and the result is shown in a frame. Nothing is saved.
	 *
	 * Refreshed a moment after typing stops, not on every key: each refresh is a
	 * server render and a reload of the frame.
	 */
	interface Props {
		/** The editor form, read as it stands, the way Save would send it. */
		form: HTMLFormElement | undefined;
		type: string;
		/** The saved slug: the address being typed may not exist yet. */
		slug: string;
		/** Changes whenever anything in the editor does, to trigger a refresh. */
		watch: unknown;
	}

	let { form, type, slug, watch }: Props = $props();

	const DESKTOP = 1280;
	const MOBILE = 390;
	const HEIGHT = 620;

	let mode = $state<'desktop' | 'mobile'>('desktop');
	let html = $state('');
	let loading = $state(false);
	let failed = $state(false);
	let width = $state(0);
	let frame: HTMLIFrameElement | undefined = $state();

	/* The desktop page is laid out at full width and scaled down to fit, so it
	   shows the real desktop layout rather than a squeezed one. */
	const viewport = $derived(mode === 'desktop' ? DESKTOP : MOBILE);
	const scale = $derived(mode === 'desktop' && width ? Math.min(1, width / DESKTOP) : 1);

	let request = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	/* Where the reader was, so a refresh does not throw them back to the top. */
	let scrollY = 0;

	async function refresh() {
		if (!form) return;
		const mine = ++request;
		loading = true;
		const data = new FormData(form);
		data.set('type', type);
		data.set('slug_saved', slug);
		try {
			const response = await fetch('/admin/preview', { method: 'POST', body: data });
			if (mine !== request) return;
			if (!response.ok) throw new Error(String(response.status));
			scrollY = frame?.contentWindow?.scrollY ?? 0;
			html = await response.text();
			failed = false;
		} catch {
			if (mine === request) failed = true;
		} finally {
			if (mine === request) loading = false;
		}
	}

	$effect(() => {
		void watch;
		void form;
		// Untracked: reading html here would make every refresh schedule the next.
		const first = untrack(() => !html);
		clearTimeout(timer);
		timer = setTimeout(refresh, first ? 0 : 600);
		return () => clearTimeout(timer);
	});

	/* Fields not tracked in `watch` (plain inputs) still refresh it. */
	$effect(() => {
		if (!form) return;
		const onEdit = () => {
			clearTimeout(timer);
			timer = setTimeout(refresh, 600);
		};
		form.addEventListener('input', onEdit);
		form.addEventListener('change', onEdit);
		return () => {
			form.removeEventListener('input', onEdit);
			form.removeEventListener('change', onEdit);
		};
	});

	function restoreScroll() {
		frame?.contentWindow?.scrollTo(0, scrollY);
	}

	function openLarge() {
		const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
		window.open(url, '_blank', 'noopener');
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}
</script>

<div class="cms-field">
	<div class="cms-row-head">
		<p class="cms-group-label" style="margin:0">
			Voorbeeld
			{#if loading}<span class="cms-meta">· bijwerken…</span>{/if}
		</p>
		<div class="cms-actions" style="margin:0">
			<button type="button" class="cms-btn cms-btn-small"
			        class:cms-btn-ghost={mode !== 'desktop'} aria-pressed={mode === 'desktop'}
			        onclick={() => (mode = 'desktop')}>Computer</button>
			<button type="button" class="cms-btn cms-btn-small"
			        class:cms-btn-ghost={mode !== 'mobile'} aria-pressed={mode === 'mobile'}
			        onclick={() => (mode = 'mobile')}>Gsm</button>
			<button type="button" class="cms-btn cms-btn-ghost cms-btn-small" disabled={!html}
			        onclick={openLarge}>Open groot ↗</button>
		</div>
	</div>

	<div class="cms-livepreview" bind:clientWidth={width} style="height:{HEIGHT}px">
		{#if html}
			<iframe
				bind:this={frame}
				title="Voorbeeld van de pagina"
				srcdoc={html}
				onload={restoreScroll}
				style="width:{viewport}px;height:{HEIGHT / scale}px;transform:scale({scale})"
			></iframe>
		{:else if failed}
			<p class="cms-hint" style="padding:1rem">Het voorbeeld kon niet geladen worden.</p>
		{:else}
			<p class="cms-hint" style="padding:1rem">Voorbeeld laden…</p>
		{/if}
	</div>

	<p class="cms-hint">
		{#if failed && html}Bijwerken lukte niet; dit is de vorige versie. {/if}
		Zo komt de pagina op de site, met wat je nu intypt. Er is nog niets opgeslagen of
		gepubliceerd. Links in het voorbeeld openen in een nieuw tabblad.
	</p>
</div>
