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
		const { data: current } = await db.from('logos').select('id, name, sort_order');
		const before = new Map((current ?? []).map((l) => [l.id, l]));

		// Only write rows that actually differ. Updating all 53 every time would
		// bump their updated_at and flood the dashboard's pending-changes list
		// with logos nobody touched.
		let changed = 0;
		for (const row of rows) {
			const name = row.name.trim() || 'Klant';
			const was = before.get(row.id);
			if (was && was.name === name && was.sort_order === row.sort_order) continue;

			const { error } = await db
				.from('logos')
				.update({ name, sort_order: row.sort_order })
				.eq('id', row.id);
			if (error) return fail(500, { message: `Opslaan mislukt: ${error.message}` });
			changed++;
		}

		return { saved: true, changed };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const { error } = await adminDb().from('logos').delete().eq('id', id);
		if (error) return fail(500, { message: `Verwijderen mislukt: ${error.message}` });
		return { saved: true };
	}
};
