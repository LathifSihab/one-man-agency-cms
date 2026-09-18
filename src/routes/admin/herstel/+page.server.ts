import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Forgotten password, in three steps: ask for a code, prove you received it,
 * choose a new one.
 *
 * A code rather than a link. The link Supabase sends by default has to survive
 * a mail client, open in the same browser, and lands the recipient in a session
 * they did not obviously ask for. A code is typed into the page already open in
 * front of the person, so it cannot be forwarded into someone else's browser.
 *
 * Step two is what actually authenticates: verifyOtp establishes a real session
 * through @supabase/ssr, which is what then permits the password change. So the
 * code has to be treated as a credential — hence the attempt limit below, since
 * a numeric code is short enough to guess at speed.
 */

export const load: PageServerLoad = async ({ locals, url }) => {
	// Already signed in and just curious: send them on.
	const user = await locals.getUser?.();
	if (user && url.searchParams.get('stap') !== 'wachtwoord') {
		throw redirect(303, '/admin');
	}
	return {};
};

const CODE = /^\d{6,10}$/;

/* Guessing a numeric code is cheap, so cap it per address. In memory and per
   instance, which is enough to blunt a script; Supabase rate-limits as well. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 6;

function tooManyAttempts(key: string): boolean {
	const now = Date.now();
	const entry = attempts.get(key);
	if (!entry || now - entry.first > WINDOW_MS) {
		attempts.set(key, { count: 1, first: now });
		return false;
	}
	entry.count += 1;
	return entry.count > MAX_ATTEMPTS;
}

export const actions: Actions = {
	/** Step one: send the code. */
	send: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();

		if (!email || !email.includes('@')) {
			return fail(400, { step: 'email', message: 'Vul een geldig e-mailadres in.' });
		}
		if (!locals.supabase) {
			return fail(500, { step: 'email', message: 'Aanmelden is niet geconfigureerd.' });
		}

		const { error } = await locals.supabase.auth.resetPasswordForEmail(email);

		// Never say whether the address exists: that turns this form into a way
		// of finding out who has an account. A rate-limit is worth reporting,
		// because otherwise the silence looks like the mail simply not arriving.
		if (error && /rate|limit|too many/i.test(error.message)) {
			return fail(429, {
				step: 'email',
				email,
				message: 'Er is net al een code gevraagd. Wacht een minuut en probeer opnieuw.'
			});
		}

		return { step: 'code', email, sent: true };
	},

	/** Step two: the code, which establishes the session. */
	verify: async ({ request, locals, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const token = String(form.get('code') ?? '').replace(/\s+/g, '');

		if (!email) return fail(400, { step: 'email', message: 'Begin opnieuw.' });
		if (!CODE.test(token)) {
			return fail(400, { step: 'code', email, message: 'Vul de cijfercode uit de e-mail in.' });
		}
		if (tooManyAttempts(`${getClientAddress()}:${email}`)) {
			return fail(429, {
				step: 'code',
				email,
				message: 'Te veel pogingen. Vraag over een kwartier een nieuwe code aan.'
			});
		}
		if (!locals.supabase) {
			return fail(500, { step: 'code', email, message: 'Aanmelden is niet geconfigureerd.' });
		}

		const { error } = await locals.supabase.auth.verifyOtp({
			email,
			token,
			type: 'recovery'
		});

		if (error) {
			return fail(401, {
				step: 'code',
				email,
				message: 'Die code klopt niet, of is verlopen. Vraag eventueel een nieuwe aan.'
			});
		}

		return { step: 'wachtwoord', email, verified: true };
	},

	/** Step three: the new password, on the session step two created. */
	update: async ({ request, locals }) => {
		const form = await request.formData();
		const next = String(form.get('next') ?? '');
		const repeat = String(form.get('repeat') ?? '');

		const user = await locals.getUser?.();
		if (!user) {
			return fail(401, {
				step: 'email',
				message: 'De code is verlopen. Vraag een nieuwe aan.'
			});
		}

		if (next !== repeat) {
			return fail(400, {
				step: 'wachtwoord',
				message: 'De twee wachtwoorden zijn niet gelijk.'
			});
		}
		if (next.length < 12) {
			return fail(400, {
				step: 'wachtwoord',
				message: 'Kies een wachtwoord van minstens 12 tekens.'
			});
		}

		const { error } = await locals.supabase.auth.updateUser({ password: next });
		if (error) {
			return fail(500, { step: 'wachtwoord', message: `Wijzigen mislukt: ${error.message}` });
		}

		// The session from the code is now a normal one, so go straight in.
		throw redirect(303, '/admin?wachtwoord=gewijzigd');
	}
};
