/**
 * Reading the page editor's form into a row update.
 *
 * Shared by Save and by the live preview, so the preview shows the page exactly
 * as saving would store it rather than a second guess at the same form.
 */

/** Fields the editor may write. Anything else is ignored. */
const JSON_FIELDS = [
	'faq',
	'prices',
	'packages',
	'projects',
	'figures',
	'testimonials',
	'sector_list',
	'cta_primary',
	'cta_secondary'
];

const TEXT_FIELDS = [
	'title',
	'seo_title',
	'meta_description',
	'intro',
	'body',
	'todo_note',
	'booking_url',
	'portrait_url',
	'portrait_alt',
	'header_image_url',
	'header_alt',
	'menu_label',
	'menu_summary',
	'menu_group'
];

/** Checkboxes: absent means false, which is not the same as "leave alone". */
const BOOLEAN_FIELDS = ['in_services', 'is_published'];

/** Whole numbers. An empty box means "no position given", not zero. */
const NUMBER_FIELDS = ['menu_order'];

/**
 * Fields the database restricts to a fixed set of values.
 *
 * form_variant was readable and rendered but had no way in: it was set once
 * during the migration and never again. When a new page needed a form, there
 * was no switch to find — so the offerte page shipped asking visitors to fill
 * in a form that was not there. Empty means no form.
 */
const ENUM_FIELDS: Record<string, string[]> = {
	form_variant: ['contact', 'scan', 'offerte']
};

/** The fields the form carries, parsed; or why one could not be read. */
export function readPagePatch(
	form: FormData
): { patch: Record<string, unknown> } | { message: string } {
	const patch: Record<string, unknown> = {};

	for (const field of TEXT_FIELDS) {
		if (form.has(field)) {
			const value = String(form.get(field) ?? '');
			patch[field] = value === '' && field !== 'body' && field !== 'title' ? null : value;
		}
	}

	for (const field of JSON_FIELDS) {
		if (form.has(field)) {
			const raw = String(form.get(field) ?? '');
			try {
				const parsed = raw ? JSON.parse(raw) : null;
				patch[field] = Array.isArray(parsed) && parsed.length === 0 ? null : parsed;
			} catch {
				return { message: `Kon het veld "${field}" niet opslaan.` };
			}
		}
	}

	for (const field of BOOLEAN_FIELDS) {
		if (form.has(field)) patch[field] = String(form.get(field) ?? '') === 'on';
	}

	for (const field of NUMBER_FIELDS) {
		if (!form.has(field)) continue;
		const raw = String(form.get(field) ?? '').trim();
		if (!raw) {
			patch[field] = null;
			continue;
		}
		const value = Number(raw);
		if (!Number.isInteger(value)) {
			return { message: `"${raw}" is geen geheel getal.` };
		}
		patch[field] = value;
	}

	for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
		if (!form.has(field)) continue;
		const value = String(form.get(field) ?? '');
		if (value && !allowed.includes(value)) {
			return { message: `"${value}" is geen geldige keuze voor "${field}".` };
		}
		patch[field] = value || null;
	}

	return { patch };
}
