/**
 * Copy every Storage-hosted image that content refers to into the published
 * output, so the live site serves its own images.
 *
 * Decision Q2 was "Supabase Storage, baked into the static output at build
 * time". Without this step an image uploaded through the CMS would be served
 * straight from Supabase on the public site: a runtime dependency on the
 * database for something a visitor waits on, which is exactly what prerendering
 * was chosen to avoid.
 *
 * Only referenced objects are fetched, not the whole bucket — an image deleted
 * from a page should stop being published.
 *
 * Runs BEFORE the build, writing into static/ so the files are part of the build
 * input. Fetching afterwards is too late: prerendering follows the links on each
 * page and fails on a missing image, which is how this ordering bug was found.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const STATIC = 'static';
const OUT_DIR = 'assets/media';
const BUCKET = 'media';
const PREFIXES = ['site', 'logos', 'blog'];

function isStorageKey(value) {
	if (!value || typeof value !== 'string') return false;
	if (value.startsWith('/') || value.startsWith('http')) return false;
	return PREFIXES.includes(value.split('/')[0]);
}

function referencedImages(content) {
	const found = new Set();
	const add = (v) => {
		if (typeof v === 'string' && v.trim()) found.add(v.trim());
	};
	for (const p of content.pages ?? []) {
		add(p.portrait_url);
		add(p.header_image_url);
	}
	for (const p of content.posts ?? []) add(p.image_url);
	for (const l of content.logos ?? []) add(l.file_path);
	return [...found].filter(isStorageKey);
}

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

let content;
let db = null;

if (url && key) {
	db = createClient(url, key, { auth: { persistSession: false } });
	const [pages, posts, logos] = await Promise.all([
		db.from('pages').select('portrait_url, header_image_url'),
		db.from('posts').select('image_url'),
		db.from('logos').select('file_path')
	]);
	content = { pages: pages.data ?? [], posts: posts.data ?? [], logos: logos.data ?? [] };
} else if (existsSync('supabase/seed.json')) {
	content = JSON.parse(readFileSync('supabase/seed.json', 'utf8'));
} else {
	console.log('[media] No content source — nothing to fetch.');
	process.exit(0);
}

const wanted = referencedImages(content);

/* Start clean so an image removed from the site stops being published. */
rmSync(join(STATIC, OUT_DIR), { recursive: true, force: true });

if (!wanted.length) {
	console.log('[media] No Storage-hosted images referenced; all images ship with the repo.');
	process.exit(0);
}

if (!db) {
	// Referenced but unreachable: say so rather than publishing broken images.
	console.warn(
		`[media] ${wanted.length} image(s) live in Storage but Supabase is not configured, ` +
			`so they cannot be fetched and will 404 on the published site.`
	);
	process.exit(0);
}

let copied = 0;
const failed = [];

for (const key of wanted) {
	const { data, error } = await db.storage.from(BUCKET).download(key);
	if (error || !data) {
		failed.push(`${key}: ${error?.message ?? 'no data'}`);
		continue;
	}
	const target = join(STATIC, OUT_DIR, key);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, Buffer.from(await data.arrayBuffer()));
	copied++;
}

console.log(`[media] Copied ${copied} Storage image(s) into ${OUT_DIR}/.`);

if (failed.length) {
	// A missing image is a visible hole on the page, so fail the build.
	console.error('[media] Could not fetch:');
	for (const f of failed) console.error(`  ${f}`);
	process.exit(1);
}
