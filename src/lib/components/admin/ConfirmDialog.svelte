<script lang="ts">
	/**
	 * The CMS's own confirmation, in place of window.confirm.
	 *
	 * A native <dialog> rather than a floating div: showModal() gives the focus
	 * trap, the Escape key and an inert background for free, while everything
	 * visible here is our own markup in the CMS's own styling. The browser's
	 * confirm() also blocks the page and cannot be styled or translated.
	 *
	 * Used as a promise: `if (await confirmer.ask({ title: '…' })) { … }`, so a
	 * caller reads the same way the confirm() it replaces did.
	 */
	let dialog = $state<HTMLDialogElement>();
	let cancelBtn = $state<HTMLButtonElement>();
	let title = $state('');
	let body = $state('');
	let confirmLabel = $state('Verwijderen');
	let danger = $state(true);

	/* Held between ask() and the button that answers it. Cleared before the
	   dialog closes, because closing fires onclose, which answers "no" for the
	   Escape key and the click on the backdrop. */
	let settle: ((ok: boolean) => void) | null = null;

	export function ask(opts: {
		title: string;
		body?: string;
		confirmLabel?: string;
		danger?: boolean;
	}): Promise<boolean> {
		title = opts.title;
		body = opts.body ?? '';
		confirmLabel = opts.confirmLabel ?? 'Verwijderen';
		danger = opts.danger ?? true;
		dialog?.showModal();
		/* Focus the way out, not the destructive button: a stray Enter should
		   cancel rather than delete. */
		cancelBtn?.focus();
		return new Promise((resolve) => (settle = resolve));
	}

	function close(ok: boolean) {
		const answer = settle;
		settle = null;
		dialog?.close();
		answer?.(ok);
	}
</script>

<dialog
	bind:this={dialog}
	class="cms-confirm"
	aria-labelledby="cms-confirm-title"
	onclose={() => close(false)}
	onclick={(e) => {
		if (e.target === dialog) close(false);
	}}
>
	<h2 id="cms-confirm-title">{title}</h2>
	{#if body}<p class="cms-hint">{body}</p>{/if}
	<div class="cms-actions" style="justify-content:flex-end;margin-top:1.2rem">
		<button bind:this={cancelBtn} type="button" class="cms-btn cms-btn-ghost" onclick={() => close(false)}>
			Annuleren
		</button>
		<button type="button" class="cms-btn {danger ? 'cms-btn-danger' : ''}" onclick={() => close(true)}>
			{confirmLabel}
		</button>
	</div>
</dialog>
