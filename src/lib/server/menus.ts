import type { SupabaseClient } from '@supabase/supabase-js';
import { pagePath } from '$lib/site';
import type { NavItem, PageType } from '$lib/types';

/**
 * Putting a page in one of the menus the CMS edits, from the page itself.
 *
 * The lists live in settings and are edited in Instellingen, but a person who
 * has just made a page should not have to go there and type its address to make
 * it findable. Services need none of this: they list themselves on /diensten.
 */

/** Which settings list each kind of page can be placed in, by choice. */
export const MENU_FOR: Partial<Record<PageType, Record<string, 'navigation' | 'footer_sectors' | 'footer_regions'>>> = {
	page: { menu: 'navigation' },
	sector: { footer: 'footer_sectors' },
	region: { footer: 'footer_regions' }
};

/**
 * A title as a menu entry. Every sector and region title starts with the same
 * words ("Marketing voor bouw", "Marketingbureau in Aalst"), which the footer
 * column's heading already says.
 */
export function menuLabel(title: string): string {
	const short = title.replace(/^(marketing voor|marketingbureau( in)?)\s+/i, '');
	return short.charAt(0).toUpperCase() + short.slice(1);
}

/**
 * Append the page to the list its placement names. Does nothing for a
 * placement that kind of page does not have, or when it is already there.
 * Returns an error message, or null.
 */
export async function addToMenu(
	db: SupabaseClient,
	page: { type: PageType; slug: string; title: string },
	placement: string
): Promise<string | null> {
	const list = MENU_FOR[page.type]?.[placement];
	if (!list) return null;

	const { data, error } = await db.from('settings').select(list).eq('id', true).single();
	if (error) return error.message;

	const link = pagePath(page);
	const current = ((data as Record<string, NavItem[] | null>)[list] ?? []) as NavItem[];
	if (current.some((item) => item.link === link)) return null;

	const { error: saveError } = await db
		.from('settings')
		.update({ [list]: [...current, { label: menuLabel(page.title), link }] })
		.eq('id', true);
	return saveError?.message ?? null;
}
