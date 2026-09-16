import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { email: locals.user?.email ?? null };
};

export const actions: Actions = {
	/**
	 * Change the password of the signed-in account.
	 *
	 * The current password is checked first. Supabase's updateUser would accept a
	 * new password on the strength of the session cookie alone, which means a
	 * borrowed laptop is enough to take the account over.
	 */
	password: async ({ request, locals }) => {
		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const repeat = String(form.get('repeat') ?? '');

		if (!current || !next) {
			return fail(400, { message: 'Vul je huidige en je nieuwe wachtwoord in.' });
		}
		if (next !== repeat) {
			return fail(400, { message: 'De twee nieuwe wachtwoorden zijn niet gelijk.' });
		}
		if (next.length < 12) {
			return fail(400, { message: 'Kies een wachtwoord van minstens 12 tekens.' });
		}
		if (next === current) {
			return fail(400, { message: 'Het nieuwe wachtwoord is hetzelfde als het huidige.' });
		}

		const email = locals.user?.email;
		if (!email || !locals.supabase) {
			return fail(500, { message: 'Je sessie is verlopen. Meld je opnieuw aan.' });
		}

		const { error: wrongPassword } = await locals.supabase.auth.signInWithPassword({
			email,
			password: current
		});
		if (wrongPassword) {
			return fail(401, { message: 'Je huidige wachtwoord klopt niet.' });
		}

		const { error: updateError } = await locals.supabase.auth.updateUser({ password: next });
		if (updateError) {
			return fail(500, { message: `Wijzigen mislukt: ${updateError.message}` });
		}

		return { changed: true };
	}
};
