import { fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

const BUCKET = 'media';
const PREFIXES = ['site', 'logos', 'blog'];
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/avif']);

export const load: PageServerLoad = async () => {
	const db = adminDb();

	const folders = await Promise.all(
		PREFIXES.map(async (prefix) => {
			const { data } = await db.storage
				.from(BUCKET)
				.list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } });
			return {
				prefix,
				files: (data ?? [])
					.filter((f) => f.id)
					.map((f) => ({
						name: f.name,
						path: `${prefix}/${f.name}`,
						size: f.metadata?.size ?? 0,
						url: db.storage.from(BUCKET).getPublicUrl(`${prefix}/${f.name}`).data.publicUrl
					}))
			};
		})
	);

	return { folders };
};

export const actions: Actions = {
	upload: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('file');
		const prefix = String(form.get('prefix') ?? 'site');

		if (!(file instanceof File) || !file.size) {
			return fail(400, { message: 'Kies eerst een bestand.' });
		}
		if (!ALLOWED.has(file.type)) {
			return fail(400, { message: `Dit bestandstype kan niet: ${file.type || 'onbekend'}.` });
		}
		if (file.size > MAX_BYTES) {
			return fail(400, { message: 'Het bestand is groter dan 8 MB.' });
		}
		if (!PREFIXES.includes(prefix)) {
			return fail(400, { message: 'Onbekende map.' });
		}

		// Keep the original filename: content already references these names.
		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
		const { error } = await adminDb()
			.storage.from(BUCKET)
			.upload(`${prefix}/${safeName}`, await file.arrayBuffer(), {
				contentType: file.type,
				upsert: true,
				cacheControl: '31536000'
			});

		if (error) return fail(500, { message: `Uploaden mislukt: ${error.message}` });
		return { saved: true, path: `${prefix}/${safeName}` };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const path = String(form.get('path') ?? '');
		const { error } = await adminDb().storage.from(BUCKET).remove([path]);
		if (error) return fail(500, { message: `Verwijderen mislukt: ${error.message}` });
		return { saved: true };
	}
};
