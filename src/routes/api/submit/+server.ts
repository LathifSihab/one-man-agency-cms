import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { adminDb } from '$lib/server/admin';
import { sendMail, submissionMail } from '$lib/server/mail';
import { FIELDS, MULTI_FIELDS } from '$lib/server/submissions';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Contact and scan form submissions (Q1: stored in Supabase, not Formspree).
 *
 * The public site ships no JavaScript, so this accepts a native form POST and
 * answers with a redirect. Writes use the service role key server-side; the
 * submissions table has no anon policy, so a browser cannot insert directly.
 */

const VARIANTS = new Set(Object.keys(FIELDS));

/** Crude per-instance rate limit: enough to blunt a naive flood. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
	const now = Date.now();
	const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	hits.push(now);
	recent.set(ip, hits);
	return hits.length > MAX_PER_WINDOW;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const form = await request.formData();
	const variant = String(form.get('variant') ?? '');

	if (!VARIANTS.has(variant)) {
		throw redirect(303, '/formulier-fout');
	}

	// Honeypot: bots fill every field, humans never see this one.
	if (form.get('website_url')) {
		throw redirect(303, '/bedankt');
	}

	if (rateLimited(getClientAddress())) {
		throw redirect(303, '/formulier-fout');
	}

	const payload: Record<string, string | string[]> = {};
	for (const field of FIELDS[variant]) {
		if (MULTI_FIELDS.has(field)) {
			const values = form
				.getAll(field)
				.filter((v): v is string => typeof v === 'string')
				.map((v) => v.trim())
				.filter(Boolean);
			if (values.length) payload[field] = values;
			continue;
		}
		const value = form.get(field);
		if (typeof value === 'string' && value.trim()) payload[field] = value.trim();
	}

	if (!payload.naam || !payload.email) {
		throw redirect(303, '/formulier-fout');
	}

	const db = adminDb();
	const { error: dbError } = await db.from('submissions').insert({ variant, payload });

	if (dbError) {
		console.error('[submit] could not store submission:', dbError.message);
		throw redirect(303, '/formulier-fout');
	}

	await notify(db, variant, payload);

	throw redirect(303, '/bedankt');
};

/**
 * Mail the agency that a form came in.
 *
 * Stored first, mailed second, and a failed mail never fails the visitor: the
 * submission is already safe in the admin inbox, and telling someone their
 * request went wrong when it did not would only get it sent twice. Failures go
 * to the Worker log instead.
 *
 * Sent to the company address in the site settings, so the client can change
 * where it lands without a deploy.
 */
async function notify(
	db: ReturnType<typeof adminDb>,
	variant: string,
	payload: Record<string, string | string[]>
) {
	const { data: settings } = await db.from('settings').select('company').limit(1).maybeSingle();
	const to = settings?.company?.email;
	if (!to) {
		console.error('[submit] not mailed: no company email in settings');
		return;
	}

	const base = env.ADMIN_URL ?? publicEnv.PUBLIC_SITE_URL;
	const sent = await sendMail({
		to,
		...submissionMail(variant, payload, base ? `${base.replace(/\/$/, '')}/admin/submissions` : undefined),
		replyTo: { email: String(payload.email), name: String(payload.naam) }
	});
	if (!sent.ok) console.error('[submit] stored but not mailed:', sent.detail);
}
