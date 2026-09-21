import { redirect } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Contact and scan form submissions (Q1: stored in Supabase, not Formspree).
 *
 * The public site ships no JavaScript, so this accepts a native form POST and
 * answers with a redirect. Writes use the service role key server-side; the
 * submissions table has no anon policy, so a browser cannot insert directly.
 */

/** Fields we accept per variant. Anything else in the body is ignored. */
const FIELDS: Record<string, string[]> = {
	contact: ['naam', 'bedrijf', 'email', 'telefoon', 'onderwerp', 'budget', 'vraag'],
	scan: ['naam', 'bedrijf', 'website', 'gemeente', 'email', 'telefoon', 'vraag', 'nieuwsbrief'],
	// A quote request needs exactly what contact needs; it is kept apart so the
	// two can be told from each other in Berichten.
	offerte: ['naam', 'bedrijf', 'email', 'telefoon', 'onderwerp', 'budget', 'vraag']
};

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

	const payload: Record<string, string> = {};
	for (const field of FIELDS[variant]) {
		const value = form.get(field);
		if (typeof value === 'string' && value.trim()) payload[field] = value.trim();
	}

	if (!payload.naam || !payload.email) {
		throw redirect(303, '/formulier-fout');
	}

	const { error: dbError } = await adminDb().from('submissions').insert({ variant, payload });

	if (dbError) {
		console.error('[submit] could not store submission:', dbError.message);
		throw redirect(303, '/formulier-fout');
	}

	throw redirect(303, '/bedankt');
};
