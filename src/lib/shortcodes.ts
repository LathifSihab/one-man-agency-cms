/**
 * Shortcode tokens embedded in page bodies.
 *
 * Bodies are stored as Markdown with the tokens intact, and resolved to
 * components at render time (handover/04). The splitting rule is copied from
 * build.py: split on /(\{\{[a-z\-]+\}\})/ and alternate prose and blocks.
 */

export const TOKEN_PATTERN = /(\{\{[a-z-]+\}\})/;

/** Tokens that render a component. Presented in the CMS as insertable buttons. */
export const SHORTCODES = [
	{ token: '{{diensten}}', label: 'Dienstenoverzicht', description: 'De tien diensten, korte vorm' },
	{ token: '{{diensten-volledig}}', label: 'Diensten, gegroepeerd', description: 'De tien diensten in vier thema’s' },
	{ token: '{{citaten}}', label: 'Klantencitaten', description: 'Wat klanten zeggen' },
	{ token: '{{stappen}}', label: 'Zo verloopt het', description: 'De vier vaste stappen' },
	{ token: '{{sectoren}}', label: 'Sectorenlijst', description: 'Ik werk vooral met…' },
	{ token: '{{scan-blok}}', label: 'Oproep gratis scan', description: 'Call to action voor de marketingscan' },
	{ token: '{{logos}}', label: 'Alle klantenlogo’s', description: 'De volledige logomuur' },
	{ token: '{{logos-strook}}', label: 'Logostrook', description: 'De eerste twaalf logo’s' },
	{ token: '{{pakketten}}', label: 'Maandpakketten', description: 'De pakketkaarten' },
	{ token: '{{projecten}}', label: 'Projectprijzen', description: 'Tabel met projectprijzen' },
	{ token: '{{faq}}', label: 'Veelgestelde vragen', description: 'De FAQ-lijst van deze pagina' },
	{ token: '{{agenda}}', label: 'Agenda', description: 'De afsprakenkalender' },
	{ token: '{{blogindex}}', label: 'Blogoverzicht', description: 'Alle gepubliceerde artikels' },
	{
		token: '{{portret}}',
		label: 'Portretfoto',
		description: 'De portretfoto van deze pagina, naast de tekst die erop volgt'
	}
] as const;

/**
 * Tokens that render nothing. They exist in the source as authoring markers and
 * are stripped, exactly as build.py does.
 */
export const NOOP_TOKENS = new Set(['{{intro-blok}}', '{{einde-blok}}']);

const KNOWN = new Set<string>(SHORTCODES.map((s) => s.token));

export type BodyPart = { kind: 'prose' | 'block' | 'portretprose'; value: string };

/** The block that folds into the prose after it; see foldPortrait. */
export const PORTRAIT_TOKEN = '{{portret}}';

/**
 * Fold a {{portret}} into the prose run that follows it.
 *
 * The portrait floats and the text wraps beside it, and a float only reaches
 * content inside its own containing block — so the two cannot be rendered as
 * separate sections, the way every other block is. With nothing after it, it
 * stands on its own.
 */
export function foldPortrait(parts: BodyPart[]): BodyPart[] {
	const out: BodyPart[] = [];
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part.kind === 'block' && part.value === PORTRAIT_TOKEN) {
			const next = parts[i + 1];
			const followed = next?.kind === 'prose';
			out.push({ kind: 'portretprose', value: followed ? next.value : '' });
			if (followed) i++;
			continue;
		}
		out.push(part);
	}
	return out;
}

export function splitBody(body: string): BodyPart[] {
	const parts: BodyPart[] = [];
	for (const chunk of body.split(TOKEN_PATTERN)) {
		const trimmed = chunk.trim();
		if (KNOWN.has(trimmed)) {
			parts.push({ kind: 'block', value: trimmed });
		} else if (NOOP_TOKENS.has(trimmed)) {
			continue;
		} else if (trimmed) {
			parts.push({ kind: 'prose', value: chunk });
		}
	}
	return parts;
}

/** Tokens present in a body that no component backs — surfaced as a CMS warning. */
export function unknownTokens(body: string): string[] {
	const found = body.match(/\{\{[a-z-]+\}\}/g) ?? [];
	return [...new Set(found.filter((t) => !KNOWN.has(t) && !NOOP_TOKENS.has(t)))];
}
