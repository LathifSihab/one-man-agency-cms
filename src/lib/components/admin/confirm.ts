/**
 * Ask before a form does something irreversible, in the CMS's own dialog.
 *
 * The pattern is the same everywhere it is used: stop the submit, ask, and if
 * the answer is yes submit the very same form again -- marked, so the second
 * pass falls straight through to use:enhance instead of asking twice. Doing it
 * this way rather than calling the action from script keeps progressive
 * enhancement intact: without JavaScript the form still posts, it just posts
 * without the question.
 */
export type ConfirmOptions = {
	title: string;
	body?: string;
	confirmLabel?: string;
	danger?: boolean;
};

export type Asker = { ask: (opts: ConfirmOptions) => Promise<boolean> };

export async function confirmSubmit(event: SubmitEvent, asker: Asker, opts: ConfirmOptions) {
	const form = event.currentTarget as HTMLFormElement;
	if (form.dataset.confirmed === 'yes') {
		delete form.dataset.confirmed;
		return;
	}
	event.preventDefault();
	if (await asker.ask(opts)) {
		form.dataset.confirmed = 'yes';
		form.requestSubmit();
	}
}
