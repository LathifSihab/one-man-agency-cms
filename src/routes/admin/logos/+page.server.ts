import { fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { requireConfirmation } from '$lib/server/confirm';
import { ensureLogoRow, isLogoPath } from '$lib/server/logos';
import type { Actions, PageServerLoad } from './$types';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif']);

export const load: PageServerLoad = async () => {
	const db = adminDb();

	const [{ data: logos }, storage] = await Promise.all([
		db.from('logos').select('*').order('sort_order'),
		db.storage.from('media').list('logos', { limit: 500, sortBy: { column: 'name', order: 'asc' } })
	]);

	/*
	 * A file uploaded to the logos folder is not yet a logo: the wall is built
	 * from this table, not from the bucket. Anything in Storage without a row
	 * is surfaced so it can be added, rather than silently going nowhere —
	 * which is exactly what used to happen.
	 */
	const linked = new Set((logos ?? []).map((l) => l.file_path));
	const unlinked = (storage.data ?? [])
		.filter((f) => f.id)
		.map((f) => ({
			key: `logos/${f.name}`,
			name: f.name,
			url: db.storage.from('media').getPublicUrl(`logos/${f.name}`).data.publicUrl
		}))
		.filter((f) => !linked.has(f.key));

	return { logos: logos ?? [], unlinked };
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

	/** Add a logo to the wall from a file already in the media library. */
	add: async ({ request }) => {
		const form = await request.formData();
		const filePath = String(form.get('file_path') ?? '');
		const name = String(form.get('name') ?? '').trim() || 'Klant';

		if (!/^logos\/[^/]+$/.test(filePath)) {
			return fail(400, { message: 'Onbekend bestand.' });
		}

		const row = await ensureLogoRow(adminDb(), filePath, name);
		if (row.error) return fail(500, { message: `Toevoegen mislukt: ${row.error}` });
		if (!row.added) return fail(400, { message: 'Dit logo staat al op de muur.' });
		return { saved: true, added: name };
	},

	/** Upload a file and put it on the wall in one step. */
	upload: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('file');
		const name = String(form.get('name') ?? '').trim() || 'Klant';

		if (!(file instanceof File) || !file.size) {
			return fail(400, { message: 'Kies eerst een bestand.' });
		}
		if (!ALLOWED.has(file.type)) {
			return fail(400, { message: `Dit bestandstype kan niet: ${file.type || 'onbekend'}.` });
		}
		if (file.size > MAX_BYTES) {
			return fail(400, { message: 'Het bestand is groter dan 8 MB.' });
		}

		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
		const filePath = `logos/${safeName}`;
		const db = adminDb();

		const { error: uploadError } = await db.storage
			.from('media')
			.upload(filePath, await file.arrayBuffer(), {
				contentType: file.type,
				upsert: true,
				cacheControl: '31536000'
			});
		if (uploadError) return fail(500, { message: `Uploaden mislukt: ${uploadError.message}` });

		const row = await ensureLogoRow(db, filePath, name);
		if (row.error) return fail(500, { message: `Toevoegen mislukt: ${row.error}` });
		// Same filename: the image is replaced, the row stays put.
		if (!row.added) return { saved: true, replaced: safeName };
		return { saved: true, added: name };
	},

	/** Takes the file out of the media library too: the two are one list. */
	delete: async ({ request }) => {
		const form = await request.formData();
		const stop = requireConfirmation(form);
		if (stop) return stop;

		const id = String(form.get('id') ?? '');
		const db = adminDb();
		const { data: logo } = await db.from('logos').select('file_path').eq('id', id).maybeSingle();
		if (!logo) return fail(404, { message: 'Dit logo bestaat niet meer.' });

		const { error } = await db.from('logos').delete().eq('id', id);
		if (error) return fail(500, { message: `Verwijderen mislukt: ${error.message}` });

		if (isLogoPath(logo.file_path)) {
			const { error: storageError } = await db.storage.from('media').remove([logo.file_path]);
			if (storageError) {
				return fail(500, {
					message: `Van de muur gehaald, maar het bestand staat nog in de mediabibliotheek: ${storageError.message}`
				});
			}
		}
		return { saved: true };
	}
};
