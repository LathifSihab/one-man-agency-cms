import type { adminDb } from './admin';

type Db = ReturnType<typeof adminDb>;

/**
 * The logo wall and the media library's logos folder are one list.
 *
 * They used to be two: the wall is built from the logos table, the library
 * lists the bucket, and nothing kept them in step. The migration left 53 rows
 * pointing at the old bundled copies under /assets/logos/, the same files were
 * then added again from the bucket, and the wall showed every logo twice with
 * no way to tell which card belonged to which file. Deleting in the library
 * did not touch the wall either.
 *
 * So every file in logos/ has exactly one row, and every row has its file: an
 * upload to the folder from either screen adds the row, and a delete from
 * either screen removes both.
 */
export const LOGO_FOLDER = 'logos';

export const isLogoPath = (path: string) => path.startsWith(`${LOGO_FOLDER}/`);

/**
 * Put a file on the wall, last, unless it is already there.
 * Returns whether a row was added.
 */
export async function ensureLogoRow(
	db: Db,
	filePath: string,
	name: string
): Promise<{ added: boolean; error?: string }> {
	const { data: existing } = await db
		.from('logos')
		.select('id')
		.eq('file_path', filePath)
		.maybeSingle();
	if (existing) return { added: false };

	// New logos go last; the editor can move them with the arrows.
	const { data: last } = await db
		.from('logos')
		.select('sort_order')
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();

	const { error } = await db
		.from('logos')
		.insert({ name, file_path: filePath, sort_order: (last?.sort_order ?? -1) + 1 });
	return error ? { added: false, error: error.message } : { added: true };
}
