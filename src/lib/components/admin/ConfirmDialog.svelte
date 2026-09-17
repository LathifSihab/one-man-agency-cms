<script lang="ts">
	/**
	 * The CMS's own confirmation, in place of window.confirm.
	 *
	 * A native <dialog> rather than a floating div: showModal() gives the focus
	 * trap, the Escape key and an inert background for free, while everything
	 * visible here is our own markup in the CMS's own styling. The browser's
	 * confirm() also blocks the page and cannot be styled or translated.
	 *
	 * It stays open for the whole action, not just the question:
	 *
	 *   ask()            the question, resolving true or false
	 *   working()        the work is under way, with a spinner
	 *   finish(ok, msg)  the outcome
	 *
	 * Deleting a file takes a round trip to Storage, and closing the dialog the
	 * moment the button is pressed leaves the editor with no idea whether
	 * anything happened. A success closes itself after a beat; a failure stays
	 * up with its message, because an error dismissed automatically is an error
	 * nobody reads.
	 */
	type Phase = 'ask' | 'working' | 'done';

	let dialog = $state<HTMLDialogElement>();
	let cancelBtn = $state<HTMLButtonElement>();
	let closeBtn = $state<HTMLButtonElement>();

	let phase = $state<Phase>('ask');
	let title = $state('');
	let body = $state('');
	let confirmLabel = $state('Verwijderen');
	let workingLabel = $state('Bezig…');
	let danger = $state(true);
	let ok = $state(true);
	let message = $state('');

	/* Held between ask() and the button that answers it. Cleared before the
	   dialog closes, because closing fires onclose, which answers "no" for the
	   Escape key and the click on the backdrop. */
	let settle: ((answer: boolean) => void) | null = null;
	let autoClose: ReturnType<typeof setTimeout> | null = null;

	export function ask(opts: {
		title: string;
		body?: string;
		confirmLabel?: string;
		workingLabel?: string;
		danger?: boolean;
	}): Promise<boolean> {
		if (autoClose) clearTimeout(autoClose);
		phase = 'ask';
		message = '';
		title = opts.title;
		body = opts.body ?? '';
		confirmLabel = opts.confirmLabel ?? 'Verwijderen';
		workingLabel = opts.workingLabel ?? 'Bezig…';
		danger = opts.danger ?? true;
		dialog?.showModal();
		/* Focus the way out, not the destructive button: a stray Enter should
		   cancel rather than delete. */
		cancelBtn?.focus();
		return new Promise((resolve) => (settle = resolve));
	}

	/** Update the label while the work runs. Answering yes already showed it. */
	export function working(label?: string) {
		if (label) workingLabel = label;
		phase = 'working';
		if (!dialog?.open) dialog?.showModal();
	}

	/** The work finished. Success closes itself; a failure waits to be read. */
	export function finish(succeeded: boolean, text: string) {
		ok = succeeded;
		message = text;
		phase = 'done';
		if (!dialog?.open) dialog?.showModal();

		if (succeeded) {
			autoClose = setTimeout(() => close(false), 1100);
		} else {
			queueMicrotask(() => closeBtn?.focus());
		}
	}

	/*
	 * Yes keeps the dialog open and goes straight to the spinner. Closing it here
	 * and reopening from working() flashed the backdrop and raced the caller,
	 * which could leave the question on screen while the work was already
	 * running.
	 */
	function accept() {
		const respond = settle;
		settle = null;
		phase = 'working';
		respond?.(true);
	}

	function close(answer: boolean) {
		if (autoClose) clearTimeout(autoClose);
		autoClose = null;
		const respond = settle;
		settle = null;
		dialog?.close();
		phase = 'ask';
		respond?.(answer);
	}
</script>

<dialog
	bind:this={dialog}
	class="cms-confirm"
	aria-labelledby="cms-confirm-title"
	aria-busy={phase === 'working'}
	onclose={() => close(false)}
	onclick={(e) => {
		/* The backdrop dismisses the question, but not work in progress. */
		if (e.target === dialog && phase === 'ask') close(false);
	}}
	oncancel={(e) => {
		if (phase === 'working') e.preventDefault();
	}}
>
	{#if phase === 'working'}
		<h2 id="cms-confirm-title">
			<span class="cms-spinner" aria-hidden="true"></span>
			{workingLabel}
		</h2>
		<p class="cms-hint">Even geduld, dit duurt meestal maar een paar seconden.</p>
	{:else if phase === 'done'}
		<h2 id="cms-confirm-title">{ok ? 'Gelukt' : 'Niet gelukt'}</h2>
		<p class={ok ? 'cms-ok' : 'cms-error'} role="status">{message}</p>
		{#if !ok}
			<div class="cms-actions" style="justify-content:flex-end;margin-top:1.2rem">
				<button bind:this={closeBtn} type="button" class="cms-btn" onclick={() => close(false)}>
					Sluiten
				</button>
			</div>
		{/if}
	{:else}
		<h2 id="cms-confirm-title">{title}</h2>
		{#if body}<p class="cms-hint">{body}</p>{/if}
		<div class="cms-actions" style="justify-content:flex-end;margin-top:1.2rem">
			<button
				bind:this={cancelBtn}
				type="button"
				class="cms-btn cms-btn-ghost"
				onclick={() => close(false)}
			>
				Annuleren
			</button>
			<button
				type="button"
				class="cms-btn {danger ? 'cms-btn-danger' : ''}"
				onclick={accept}
			>
				{confirmLabel}
			</button>
		</div>
	{/if}
</dialog>
