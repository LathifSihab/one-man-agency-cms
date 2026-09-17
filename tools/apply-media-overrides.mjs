/**
 * Let an image replaced in the media library override the copy that ships with
 * the repository.
 *
 * The 63 images the site launched with are referenced by repository path —
 * "/assets/header-oma.jpg" — and served from static/. Replacing one through the
 * CMS writes a new object to Storage, but the page still pointed at the repo
 * file, so the replacement was uploaded, previewed correctly in the admin, and
 * then had no effect whatsoever on the published site.
 *
 * This copies a replaced object over the repo file in the build output. It runs
 * after the build rather than before, because the repo copy already satisfies
 * prerendering; only the bytes need swapping, and writing into static/ would
 * dirty the working tree with files that are checked in.
 *
 * Nothing is downloaded unless it actually changed: Storage exposes each
 * object's md5 as its eTag, which is compared against the local file.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const STATIC_SRC = 'static/assets';
const OUTPUT = '.vercel/output/static/assets';
const BUCKET = 'media';

/** Storage rejects some characters that are legal on disk; mirrors migrate.py. */
const storageKey = (name) => name.replace(/[^A-Za-z0-9._/-]/g, '-');

/** "assets/logos/x.png" -> "logos/x.png", "assets/x.png" -> "site/x.png" */
function keyFor(relPath) {
	const unix = relPath.split(/[\\/]/).join('/');
	return storageKey(unix.startsWith('logos/') ? `logos/${basename(unix)}` : `site/${unix}`);
}

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
	console.log('[media] Supabase not configured — repo images used as they are.');
	process.exit(0);
}
if (!existsSync(OUTPUT)) {
	console.log('[media] No build output — nothing to override.');
	process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// One listing per folder, then compare locally.
const remote = new Map();
for (const prefix of ['site', 'logos']) {
	const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 500 });
	if (error) {
		console.warn(`[media] Could not list ${prefix}/: ${error.message}`);
		continue;
	}
	for (const f of data ?? []) {
		if (!f.id) continue;
		const etag = (f.metadata?.eTag ?? '').replace(/"/g, '');
		remote.set(`${prefix}/${f.name}`, etag);
	}
}

let replaced = 0;
const failed = [];

for (const localPath of walk(STATIC_SRC)) {
	const rel = relative(STATIC_SRC, localPath);
	// Images fetched by tools/fetch-media.mjs are already the Storage copy.
	if (rel.split(/[\\/]/)[0] === 'media') continue;

	const objectKey = keyFor(rel);
	const remoteHash = remote.get(objectKey);
	if (!remoteHash) continue;

	const localHash = createHash('md5').update(readFileSync(localPath)).digest('hex');
	if (localHash === remoteHash) continue;

	const { data, error } = await db.storage.from(BUCKET).download(objectKey);
	if (error || !data) {
		failed.push(`${objectKey}: ${error?.message ?? 'no data'}`);
		continue;
	}

	writeFileSync(join(OUTPUT, rel), Buffer.from(await data.arrayBuffer()));
	console.log(`[media] ${rel} replaced from the media library`);
	replaced++;
}

console.log(
	replaced
		? `[media] ${replaced} image(s) overridden by the media library.`
		: '[media] No replaced images; repo copies used as they are.'
);

if (failed.length) {
	console.error('[media] Could not fetch:');
	for (const f of failed) console.error(`  ${f}`);
	process.exit(1);
}
