import { fail } from '@sveltejs/kit';

/**
 * Server-side proof that a destructive action was confirmed.
 *
 * The CMS asks before it deletes, but until this existed the question lived
 * entirely in an `onsubmit` handler on a hydrated component. The admin renders
 * server-side first, so a submit that landed before hydration — a fast click, a
 * restored scroll position, an automated one — posted straight to `?/delete`
 * and the row was gone with nothing asked. That is not theoretical: it deleted a
 * real blog post during testing, recoverable only because the content also
 * existed in supabase/seed.json.
 *
 * So the dialog now attaches a field, and the action refuses without it. The
 * client-side question stays exactly as it was; this is the floor under it.
 *
 * The trade is deliberate. A delete no longer works without JavaScript, where
 * before it worked but silently skipped the question. The admin already sets
 * `csr = true` and is unusable without JavaScript anyway, so the only behaviour
 * actually given up is the one that caused the data loss.
 */

/** The field name the dialog adds. Must match confirmSubmit.ts. */
export const CONFIRM_FIELD = 'confirmed';

const CONFIRM_VALUE = 'yes';

/**
 * Guard a destructive action.
 *
 * Returns an ActionFailure to hand straight back when the confirmation is
 * missing, or null when the action may proceed:
 *
 *     const stop = requireConfirmation(form);
 *     if (stop) return stop;
 */
export function requireConfirmation(form: FormData) {
	if (form.get(CONFIRM_FIELD) === CONFIRM_VALUE) return null;

	return fail(400, {
		message:
			'Verwijderen is niet doorgegaan omdat de bevestiging ontbrak. ' +
			'Er is niets verwijderd. Probeer het opnieuw.'
	});
}
