import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { MEDIA_PREFIXES } from '$lib/images';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * The media library, for the image picker.
 *
 * Sits under /admin so hooks.server.ts has already required a session; the
 * bucket is public to read, but the listing should not be.
 */
export const GET: RequestHandler = async () => {
	const db = adminDb();

	const folders = await Promise.all(
		MEDIA_PREFIXES.map(async (prefix) => {
			const { data } = await db.storage
				.from('media')
				.list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

			return {
				prefix,
				files: (data ?? [])
					.filter((f) => f.id)
					.map((f) => ({
						// The value stored in content: "<prefix>/<name>", no leading slash.
						key: `${prefix}/${f.name}`,
						name: f.name,
						size: f.metadata?.size ?? 0,
						url: db.storage.from('media').getPublicUrl(`${prefix}/${f.name}`).data.publicUrl,
						version: Date.parse(f.updated_at ?? f.created_at ?? '') || 0
					}))
			};
		})
	);

	return json({ folders });
};
