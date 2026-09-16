import { fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data } = await adminDb().from('logos').select('*').order('sort_order');
	return { logos: data ?? [] };
};

export const actions: Actions = {
	/** Save every name and order in one submit, so reordering is not N requests. */
	save: async ({ request }) => {
		const form = await request.formData();
		const raw = String(form.get('logos') ?? '[]');

		let rows: { id: string; name: string; sort_order: number }[];
		try {
			rows = JSON.parse(raw);
		} catch {
			return fail(400, { message: 'Kon de logo-lijst niet lezen.' });
		}

		const db = adminDb();
		for (const row of rows) {
			const { error } = await db
				.from('logos')
				.update({ name: row.name.trim() || 'Klant', sort_order: row.sort_order })
				.eq('id', row.id);
			if (error) return fail(500, { message: `Opslaan mislukt: ${error.message}` });
		}

		return { saved: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const { error } = await adminDb().from('logos').delete().eq('id', id);
		if (error) return fail(500, { message: `Verwijderen mislukt: ${error.message}` });
		return { saved: true };
	}
};
