/**
 * Where an image path points.
 *
 * Content holds one of two kinds of value, and this is the only place that
 * knows the difference:
 *
 *   /assets/niels.jpg     a file that ships with the repository
 *   site/niels.jpg        an object in the Supabase Storage `media` bucket,
 *                         written as "<prefix>/<name>" with no leading slash
 *
 * Storage-backed images are downloaded into the published output at build time
 * (tools/fetch-media.mjs) and served from /assets/media/…, so the live site
 * never asks Supabase for an image. That is the whole point of prerendering:
 * a paused or slow database cannot affect a visitor.
 */

export const MEDIA_PREFIXES = ['site', 'logos', 'blog'] as const;
export type MediaPrefix = (typeof MEDIA_PREFIXES)[number];

/** Where a Storage object is written in the published output. */
export const MEDIA_OUTPUT_DIR = 'assets/media';

/** True when the value names a Storage object rather than a repo file. */
export function isStorageKey(value: string | null | undefined): boolean {
	if (!value) return false;
	if (value.startsWith('/') || value.startsWith('http')) return false;
	const [prefix] = value.split('/');
	return (MEDIA_PREFIXES as readonly string[]).includes(prefix);
}

/** The src to render for a stored image value. */
export function resolveImage(value: string | null | undefined): string {
	if (!value) return '';
	if (isStorageKey(value)) return `/${MEDIA_OUTPUT_DIR}/${value}`;
	return value;
}

/** Every image value referenced anywhere in the content, de-duplicated. */
export function collectImageValues(content: {
	pages: Array<Record<string, unknown>>;
	posts: Array<Record<string, unknown>>;
	logos: Array<Record<string, unknown>>;
}): string[] {
	const found = new Set<string>();
	const add = (v: unknown) => {
		if (typeof v === 'string' && v.trim()) found.add(v.trim());
	};

	for (const page of content.pages) {
		add(page.portrait_url);
		add(page.header_image_url);
	}
	for (const post of content.posts) add(post.image_url);
	for (const logo of content.logos) add(logo.file_path);

	return [...found];
}
