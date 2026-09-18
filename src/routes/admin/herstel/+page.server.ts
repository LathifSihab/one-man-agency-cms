import { fail, redirect } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { mailConfigured, recoveryMail, sendMail } from '$lib/server/mail';
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

/*
 * Proof that the password about to be set was earned with a code.
 *
 * Verifying the code signs the person in, so "is there a session?" is not a
 * sufficient test for step three: anyone already signed in would then be able
 * to post straight to it and change the password without knowing the current
 * one, which is exactly what /admin/account requires. This marker is set only
 * by a verified code, lives for ten minutes, is scoped to this page, and is
 * cleared the moment it is used.
 */
const RECOVERY_COOKIE = 'oma_recovery';
const RECOVERY_PATH = '/admin/herstel';
const RECOVERY_MAX_AGE = 600;

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const midRecovery = Boolean(cookies.get(RECOVERY_COOKIE));
	// Already signed in and just curious: send them on. Not during a recovery,
	// because verifying the code is what created that session.
	const user = await locals.getUser?.();
	if (user && !midRecovery) throw redirect(303, '/admin');
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

		if (!mailConfigured()) {
			return fail(500, {
				step: 'email',
				email,
				message: 'Er kan nog geen e-mail verstuurd worden. Neem contact op met je beheerder.'
			});
		}

		if (tooManyAttempts(`send:${email}`)) {
			return fail(429, {
				step: 'email',
				email,
				message: 'Er zijn net al codes gevraagd. Wacht een kwartier en probeer opnieuw.'
			});
		}

		/*
		 * Mint the code with the admin API and send it ourselves.
		 *
		 * Supabase would happily mail this, but on the free tier it refuses to let
		 * the template be changed while its own provider is in use, so its message
		 * always carries a link and the code never reaches anyone.
		 *
		 * generateLink also invalidates any earlier code for this address, which is
		 * what makes "send me a new one" mean what it says.
		 */
		let code: string | undefined;
		try {
			const { data, error } = await adminDb().auth.admin.generateLink({
				type: 'recovery',
				email
			});
			if (error) throw error;
			code = data?.properties?.email_otp;
		} catch (error) {
			// Almost always "user not found". Saying so would turn this form into a
			// way of discovering who has an account, so it looks like success.
			console.warn('[herstel] no code minted:', String(error).slice(0, 120));
		}

		if (code) {
			const sent = await sendMail({ to: email, ...recoveryMail(code) });
			if (!sent.ok) {
				// The visitor cannot act on the cause, but it must not vanish: a
				// code that was never delivered is indistinguishable from a wrong
				// address unless someone reads the log.
				console.error('[herstel] sending failed:', sent.detail);
				return fail(502, {
					step: 'email',
					email,
					message: 'De code kon niet verstuurd worden. Probeer het straks opnieuw.'
				});
			}
		}

		return { step: 'code', email, sent: true };
	},

	/** Step two: the code, which establishes the session. */
	verify: async ({ request, locals, getClientAddress, cookies, url }) => {
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

		cookies.set(RECOVERY_COOKIE, '1', {
			path: RECOVERY_PATH,
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: RECOVERY_MAX_AGE
		});

		return { step: 'wachtwoord', email, verified: true };
	},

	/** Step three: the new password, on the session step two created. */
	update: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const next = String(form.get('next') ?? '');
		const repeat = String(form.get('repeat') ?? '');

		// A session alone is not enough: it must have come from a code.
		const user = await locals.getUser?.();
		if (!user || !cookies.get(RECOVERY_COOKIE)) {
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

		// Spend the marker: one verified code buys exactly one password change.
		cookies.delete(RECOVERY_COOKIE, { path: RECOVERY_PATH });

		// The session from the code is now a normal one, so go straight in.
		throw redirect(303, '/admin?wachtwoord=gewijzigd');
	}
};
