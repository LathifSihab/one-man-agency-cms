import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Already signed in? Skip the form.
	const user = await locals.getUser?.();
	if (user) throw redirect(303, url.searchParams.get('terug') || '/admin');

	return {
		configError: url.searchParams.get('reden') === 'config',
		back: url.searchParams.get('terug') ?? '/admin'
	};
};

export const actions: Actions = {
	/** Email + password only. There is no sign-up action: the account is created
	 *  manually in the Supabase dashboard and public sign-up is disabled.
	 *  Named rather than `default`, because this file also exposes `logout` and
	 *  `logout`, and SvelteKit forbids mixing a default action with named ones.
	 *  Forgotten passwords are handled at /admin/herstel. */
	login: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, message: 'Vul je e-mailadres en wachtwoord in.' });
		}
		if (!locals.supabase) {
			return fail(500, { email, message: 'Supabase is niet geconfigureerd.' });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(401, { email, message: 'Aanmelden lukte niet. Controleer je gegevens.' });
		}

		throw redirect(303, url.searchParams.get('terug') || '/admin');
	},

	logout: async ({ locals }) => {
		await locals.supabase?.auth.signOut();
		throw redirect(303, '/admin/login');
	}
};
