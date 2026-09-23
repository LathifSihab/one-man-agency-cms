import { fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { requireConfirmation } from '$lib/server/confirm';
import { ensureLogoRow, isLogoPath } from '$lib/server/logos';
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
						/* Replacing writes to the same path, so the public URL never
						   changes while the file behind it does -- and it is served with
						   a year of cache. This stamp is what the admin page hangs off
						   the URL so it shows the picture that is actually there now. */
						version: Date.parse(f.updated_at ?? f.created_at ?? '') || 0,
						url: db.storage.from(BUCKET).getPublicUrl(`${prefix}/${f.name}`).data.publicUrl
					}))
			};
		})
	);

	return { folders };
};

/* The same three questions for an upload and for a replacement, asked in one
   place so the two cannot drift apart. Returns the file itself on the way
   through, which is what narrows it from a form value for the caller. */
function checkFile(value: FormDataEntryValue | null): { file: File } | { message: string } {
	if (!(value instanceof File) || !value.size) return { message: 'Kies eerst een bestand.' };
	if (!ALLOWED.has(value.type)) {
		return { message: `Dit bestandstype kan niet: ${value.type || 'onbekend'}.` };
	}
	if (value.size > MAX_BYTES) return { message: 'Het bestand is groter dan 8 MB.' };
	return { file: value };
}

/* A path from the page, not to be trusted as one: it has to name a file
   directly inside one of the three folders and nothing above them. */
function knownPath(path: string): boolean {
	const parts = path.split('/');
	return (
		parts.length === 2 &&
		PREFIXES.includes(parts[0]) &&
		!!parts[1] &&
		!parts[1].includes('..') &&
		/^[a-zA-Z0-9._-]+$/.test(parts[1])
	);
}

export const actions: Actions = {
	upload: async ({ request }) => {
		const form = await request.formData();
		const checked = checkFile(form.get('file'));
		if ('message' in checked) return fail(400, { message: checked.message });
		const prefix = String(form.get('prefix') ?? 'site');
		if (!PREFIXES.includes(prefix)) {
			return fail(400, { message: 'Onbekende map.' });
		}

		// Keep the original filename: content already references these names.
		const safeName = checked.file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
		const path = `${prefix}/${safeName}`;
		const db = adminDb();
		const { error } = await db.storage
			.from(BUCKET)
			.upload(path, await checked.file.arrayBuffer(), {
				contentType: checked.file.type,
				upsert: true,
				cacheControl: '31536000'
			});

		if (error) return fail(500, { message: `Uploaden mislukt: ${error.message}` });

		// A logo in the library is a logo on the wall; the name is filled in there.
		if (isLogoPath(path)) {
			const row = await ensureLogoRow(db, path, 'Klant');
			if (row.error) {
				return fail(500, { message: `Geüpload, maar niet op de logomuur gezet: ${row.error}` });
			}
		}
		return { saved: true, path };
	},

	/* Replace: the same bytes-to-storage as an upload, but written to a path
	   that already exists instead of one made from the new file's name. That is
	   the whole point of it -- every page already pointing at this image shows
	   the new one, with nothing to re-link by hand. */
	replace: async ({ request }) => {
		const form = await request.formData();
		const checked = checkFile(form.get('file'));
		if ('message' in checked) return fail(400, { message: checked.message });
		const path = String(form.get('path') ?? '');
		if (!knownPath(path)) return fail(400, { message: 'Onbekend pad.' });

		const { error } = await adminDb()
			.storage.from(BUCKET)
			.upload(path, await checked.file.arrayBuffer(), {
				contentType: checked.file.type,
				upsert: true,
				cacheControl: '31536000'
			});

		if (error) return fail(500, { message: `Vervangen mislukt: ${error.message}` });
		return { saved: true, path };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const stop = requireConfirmation(form);
		if (stop) return stop;

		const path = String(form.get('path') ?? '');
		if (!knownPath(path)) return fail(400, { message: 'Onbekend pad.' });
		const db = adminDb();

		// The wall row goes first: a row left pointing at a deleted file would
		// build as an empty card, where a file left without a row is merely
		// offered again on the logos screen.
		if (isLogoPath(path)) {
			const { error } = await db.from('logos').delete().eq('file_path', path);
			if (error) return fail(500, { message: `Verwijderen mislukt: ${error.message}` });
		}

		const { error } = await db.storage.from(BUCKET).remove([path]);
		if (error) return fail(500, { message: `Verwijderen mislukt: ${error.message}` });
		return { saved: true };
	}
};
