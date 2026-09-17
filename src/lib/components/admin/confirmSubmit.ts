export interface ConfirmOptions {
	title: string;
	body?: string;
	confirmLabel?: string;
	/** Shown beside the spinner while the action runs. */
	workingLabel?: string;
	danger?: boolean;
}

/** Anything that can run the question-and-progress cycle — ConfirmDialog.svelte. */
export interface Confirmer {
	ask(options: ConfirmOptions): Promise<boolean>;
	working(label?: string): void;
	finish(succeeded: boolean, message: string): void;
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
		// Keep the dialog up with a spinner until the action reports back.
		confirmer.working(options.workingLabel);
		form.dataset.confirmed = 'yes';
		form.requestSubmit(
			submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
				? submitter
				: undefined
		);
	}
}

/**
 * The other half: report the outcome back to the dialog.
 *
 * Wrap a form's `use:enhance` with this so the spinner is replaced by a result
 * rather than the dialog vanishing while the request is still in flight.
 *
 *     use:enhance={reportTo(confirmer, { success: 'Verwijderd.' })}
 */
export function reportTo(
	confirmer: Confirmer | undefined,
	messages: { success: string; failure?: string }
) {
	return () =>
		async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update({ reset: false });

			const succeeded = result.type === 'success' || result.type === 'redirect';
			const serverMessage =
				typeof result.data?.message === 'string' ? result.data.message : undefined;

			confirmer?.finish(
				succeeded,
				succeeded
					? messages.success
					: (serverMessage ?? messages.failure ?? 'Er ging iets mis. Probeer het opnieuw.')
			);
		};
}
