import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { building } from '$app/environment';
import type { Logo, Page, Post, Settings, SiteContent } from '$lib/types';

/**
 * Build-time content access.
 *
 * Everything the public site renders is read through here, during prerendering,
 * with the service role key and server-side only. The published output contains
 * no Supabase URL and makes no runtime request to the database (decision D4).
 *
 * During a build, if no credentials are configured, the loader falls back to
 * supabase/seed.json — the same payload tools/migrate.py uploads — so `npm run
 * build` and the parity check stay runnable before the Supabase project exists,
 * and in CI. That fallback is build-time only; see fromSeed().
 */

let cache: SiteContent | null = null;

function fromSeed(): SiteContent {
	// The seed file lives in the repo, not in a deployed function bundle. Falling
	// back to it at request time would fail with a confusing ENOENT, so refuse
	// clearly instead: at runtime, missing credentials are a misconfiguration.
	if (!building) {
		throw new Error(
			'Supabase is not configured. PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
				'must be set for this environment. The supabase/seed.json fallback is ' +
				'build-time only and is not deployed.'
		);
	}

	const path = resolve('supabase/seed.json');
	const seed = JSON.parse(readFileSync(path, 'utf8'));
	console.warn(
		'[content] No Supabase credentials configured — building from supabase/seed.json.'
	);
	return normalise(seed.pages, seed.posts, seed.logos, seed.settings);
}

function normalise(
	pages: Page[],
	posts: Post[],
	logos: Logo[],
	settings: Settings
): SiteContent {
	return {
		// Ordering is explicit everywhere; never rely on insertion order.
		pages: [...pages].sort((a, b) => a.sort_order - b.sort_order),
		// Newest first. The comparator returns 0 for equal dates so the sort stays
		// stable: same-day posts keep their slug order, as the reference build does.
		posts: [...posts]
			.filter((p) => p.is_published)
			.sort((a, b) =>
				a.published_on === b.published_on ? 0 : a.published_on < b.published_on ? 1 : -1
			),
		logos: [...logos].sort((a, b) => a.sort_order - b.sort_order),
		settings
	};
}

async function fromSupabase(url: string, key: string): Promise<SiteContent> {
	const db = createClient(url, key, { auth: { persistSession: false } });

	const [pages, posts, logos, settings] = await Promise.all([
		db.from('pages').select('*').order('slug'),
		db.from('posts').select('*').order('slug'),
		db.from('logos').select('*'),
		db.from('settings').select('*').single()
	]);

	for (const result of [pages, posts, logos, settings]) {
		if (result.error) throw new Error(`Supabase read failed: ${result.error.message}`);
	}

	return normalise(
		pages.data as Page[],
		posts.data as Post[],
		logos.data as Logo[],
		settings.data as Settings
	);
}

export async function getContent(): Promise<SiteContent> {
	if (cache) return cache;

	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;

	cache = url && key ? await fromSupabase(url, key) : fromSeed();
	return cache;
}

export async function getPage(type: Page['type'], slug: string): Promise<Page | undefined> {
	const { pages } = await getContent();
	return pages.find((p) => p.type === type && p.slug === slug);
}

export async function getPagesOfType(type: Page['type']): Promise<Page[]> {
	const { pages } = await getContent();
	return pages.filter((p) => p.type === type);
}

export async function getPost(slug: string): Promise<Post | undefined> {
	const { posts } = await getContent();
	return posts.find((p) => p.slug === slug);
}
