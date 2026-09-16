import { fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data } = await adminDb().from('settings').select('*').maybeSingle();
	return { settings: data };
};

const COMPANY_KEYS = [
	'naam', 'juridisch', 'straat', 'postcode', 'stad', 'btw',
	'telefoon', 'telefoon_link', 'email', 'slogan'
];

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();

		const company: Record<string, string> = {};
		for (const key of COMPANY_KEYS) company[key] = String(form.get(`company.${key}`) ?? '').trim();

		if (!company.naam || !company.email) {
			return fail(400, { message: 'Bedrijfsnaam en e-mailadres zijn verplicht.' });
		}

		let navigation, socials;
		try {
			navigation = JSON.parse(String(form.get('navigation') ?? '[]'));
			socials = JSON.parse(String(form.get('socials') ?? '[]'));
		} catch {
			return fail(400, { message: 'Kon de navigatie of de sociale media niet opslaan.' });
		}

		const patch = {
			company,
			navigation,
			socials,
			header_cta: {
				label: String(form.get('cta.label') ?? ''),
				link: String(form.get('cta.link') ?? '')
			},
			formspree_id: String(form.get('formspree_id') ?? '') || null
		};

		const { error } = await adminDb().from('settings').update(patch).eq('id', true);
		if (error) return fail(500, { message: `Opslaan mislukt: ${error.message}` });

		return { saved: true };
	}
};
