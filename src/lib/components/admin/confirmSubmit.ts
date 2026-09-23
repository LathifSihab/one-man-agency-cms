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

/** The field name the server checks. Must match $lib/server/confirm.ts. */
export const CONFIRM_FIELD = 'confirmed';

/**
 * Attach the proof of confirmation to the form being resubmitted.
 *
 * Created here rather than written into every form's markup, so a destructive
 * form cannot be added later that forgets it and quietly falls back to the old,
 * unguarded behaviour: if the dialog did not run, the field does not exist, and
 * the server refuses.
 */
function markConfirmed(form: HTMLFormElement): void {
	const existing = form.elements.namedItem(CONFIRM_FIELD);
	const field = existing instanceof HTMLInputElement ? existing : document.createElement('input');

	field.type = 'hidden';
	field.name = CONFIRM_FIELD;
	field.value = 'yes';

	if (!field.isConnected) form.appendChild(field);
}

/**
 * Ask before a form submits, using the CMS's own dialog instead of the
 * browser's.
 *
 * The submit is stopped, the question asked, and the same form submitted again
 * once answered. A marker on the form element lets that second pass through to
 * use:enhance rather than asking a second time.
 *
 * Answering also attaches a hidden field to the form, which the server action
 * checks (see $lib/server/confirm.ts). That is what makes the question real: a
 * submit that reaches the server without going through this dialog — a click
 * before the page hydrated, say — is refused rather than obeyed. Deleting
 * therefore needs JavaScript now. It previously worked without it, but silently
 * skipped the question, which is how a real post was deleted during testing.
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
	/* preventDefault alone does not hold use:enhance back: its own submit
	   listener never checks defaultPrevented, so it posted the moment the
	   button was pressed, before anything was answered. The server refused it
	   for want of the confirmation, and the dialog flipped straight to that
	   error — no delete in the admin could get through. This listener is on the
	   element before enhance's (event attributes are bound before actions run),
	   so stopping here keeps the first pass away from it. */
	event.stopImmediatePropagation();

	// Without a dialog mounted, refuse rather than silently deleting.
	if (!confirmer) return;

	if (await confirmer.ask(options)) {
		// Keep the dialog up with a spinner until the action reports back.
		confirmer.working(options.workingLabel);
		form.dataset.confirmed = 'yes';
		markConfirmed(form);
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
