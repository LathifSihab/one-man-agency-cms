import type { SupabaseClient } from '@supabase/supabase-js';
import { analyse, type Status } from '$lib/seo';

/**
 * The same SEO rules the editors show, run over every page and post at once.
 *
 * This is the dashboard's answer to "what should I work on next": a site-wide
 * average and the worst offenders, each a link straight into the editor that
 * fixes it. It reads the tables directly rather than through $lib/server/content
 * because it must see drafts and noindexed pages too — content.ts filters those
 * out, and an unpublished draft with no meta description is exactly the thing
 * worth catching before it goes live.
 */

export interface SeoRow {
	kind: 'page' | 'post';
	slug: string;
	title: string;
	href: string;
	score: number;
	status: Status;
	/** The failed and warned checks, worst first, for the "what's wrong" column. */
	problems: string[];
	published: boolean;
}

export interface SeoHealth {
	average: number;
	graded: number;
	/** Everything scoring under 85, worst first. */
	weakest: SeoRow[];
}

const PREFIX: Record<string, string> = {
	page: '',
	service: '/diensten',
	sector: '/sectoren',
	region: '/regio'
};

function worst(status: Status): number {
	return status === 'fail' ? 0 : status === 'warn' ? 1 : 2;
}

export async function getSeoHealth(db: SupabaseClient, limit = 8): Promise<SeoHealth> {
	const [pages, posts] = await Promise.all([
		db
			.from('pages')
			.select('slug, type, title, seo_title, meta_description, intro, body, noindex, header_image_url'),
		db
			.from('posts')
			.select('slug, title, seo_title, meta_description, intro, body, image_url, is_published')
	]);

	const rows: SeoRow[] = [];

	for (const p of pages.data ?? []) {
		// A noindexed page is not competing for anything: grading /404 and the
		// two form landing pages would only add permanent red to the dashboard.
		if (p.noindex) continue;

		const path =
			p.type === 'page'
				? p.slug === 'home'
					? '/'
					: `/${p.slug}`
				: `${PREFIX[p.type] ?? ''}/${p.slug}`;

		const result = analyse({
			kind: 'page',
			title: p.title ?? '',
			seoTitle: p.seo_title ?? '',
			metaDescription: p.meta_description ?? '',
			intro: p.intro ?? '',
			body: p.body ?? '',
			path,
			imageUrl: p.header_image_url
		});

		rows.push({
			kind: 'page',
			slug: p.slug,
			title: p.title ?? p.slug,
			href: `/admin/pages/${p.type}/${p.slug}`,
			score: result.score,
			status: result.checks.some((c) => c.status === 'fail') ? 'fail' : 'warn',
			problems: result.checks
				.filter((c) => c.status !== 'ok')
				.sort((a, b) => worst(a.status) - worst(b.status))
				.map((c) => c.label),
			published: true
		});
	}

	for (const p of posts.data ?? []) {
		const result = analyse({
			kind: 'post',
			title: p.title ?? '',
			seoTitle: p.seo_title ?? '',
			metaDescription: p.meta_description ?? '',
			intro: p.intro ?? '',
			body: p.body ?? '',
			path: `/blog/${p.slug}`,
			imageUrl: p.image_url
		});

		rows.push({
			kind: 'post',
			slug: p.slug,
			title: p.title ?? p.slug,
			href: `/admin/blog/${p.slug}`,
			score: result.score,
			status: result.checks.some((c) => c.status === 'fail') ? 'fail' : 'warn',
			problems: result.checks
				.filter((c) => c.status !== 'ok')
				.sort((a, b) => worst(a.status) - worst(b.status))
				.map((c) => c.label),
			published: Boolean(p.is_published)
		});
	}

	const average = rows.length
		? Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length)
		: 100;

	return {
		average,
		graded: rows.length,
		weakest: rows
			.filter((r) => r.score < 85)
			.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
			.slice(0, limit)
	};
}
