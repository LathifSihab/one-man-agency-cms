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
	 *  `reset`, and SvelteKit forbids mixing a default action with named ones. */
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
	},

	/** One account means a lockout is a real outage, so reset must work. */
	reset: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email) return fail(400, { email, message: 'Vul eerst je e-mailadres in.' });

		await locals.supabase?.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/admin/login`
		});
		// Always report success: never reveal whether an address exists.
		return { sent: true, email };
	}
};
