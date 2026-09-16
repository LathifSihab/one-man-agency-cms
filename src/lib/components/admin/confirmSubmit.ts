export interface ConfirmOptions {
	title: string;
	body?: string;
	confirmLabel?: string;
	danger?: boolean;
}

/** Anything that can answer a question — in practice ConfirmDialog.svelte. */
export interface Confirmer {
	ask(options: ConfirmOptions): Promise<boolean>;
}

/**
 * Ask before a form submits, using the CMS's own dialog instead of the
 * browser's.
 *
 * The submit is stopped, the question asked, and the same form submitted again
 * once answered. A marker on the form element lets that second pass through to
 * use:enhance rather than asking a second time.
 *
 * Doing it this way, rather than calling the action from script, keeps
 * progressive enhancement intact: without JavaScript the form still posts, it
 * just posts without asking first.
 *
 *     <form use:enhance onsubmit={(e) => confirmSubmit(e, confirmer, { … })}>
 */
export async function confirmSubmit(
	event: SubmitEvent,
	confirmer: Confirmer | undefined,
	options: ConfirmOptions
): Promise<void> {
	const form = event.currentTarget as HTMLFormElement;
	/* Which button submitted matters: one form can carry both Save and a
	   Delete that overrides the action with formaction, and resubmitting
	   without the submitter would run the wrong one. */
	const submitter = event.submitter;

	if (form.dataset.confirmed === 'yes') {
		delete form.dataset.confirmed;
		return;
	}

	event.preventDefault();

	// Without a dialog mounted, refuse rather than silently deleting.
	if (!confirmer) return;

	if (await confirmer.ask(options)) {
		form.dataset.confirmed = 'yes';
		form.requestSubmit(
			submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
				? submitter
				: undefined
		);
	}
}
