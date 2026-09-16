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
	{ token: '{{blogindex}}', label: 'Blogoverzicht', description: 'Alle gepubliceerde artikels' }
] as const;

/**
 * Tokens that render nothing. They exist in the source as authoring markers and
 * are stripped, exactly as build.py does.
 */
export const NOOP_TOKENS = new Set(['{{intro-blok}}', '{{einde-blok}}']);

const KNOWN = new Set<string>(SHORTCODES.map((s) => s.token));

export type BodyPart = { kind: 'prose' | 'block'; value: string };

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
