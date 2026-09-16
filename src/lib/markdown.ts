import { marked, type Tokens } from 'marked';

/**
 * Markdown -> HTML, matching the reference implementation (build.py, which uses
 * python-markdown with the `extra`, `sane_lists` and `smarty` extensions).
 *
 * The public site's HTML is the product's whole value, so this renderer is held
 * to the reference output rather than to marked's defaults. Every deviation
 * below exists because a real page in content/ depends on it; the check lives in
 * tools/_check_markdown.mjs and tools/parity.py.
 */

/** smarty: ASCII punctuation becomes the HTML entities python-markdown emits. */
function smarty(html: string): string {
	return html
		.split(/(<[^>]+>)/)
		.map((segment, i) => {
			if (i % 2 === 1) return segment; // a tag — never rewrite inside one
			return segment
				// marked escapes quotes before we get here; python-markdown leaves
				// them for smarty to convert, so undo that first.
				.replace(/&#39;/g, "'")
				.replace(/&quot;/g, '"')
				.replace(/---/g, '&mdash;')
				.replace(/(^|[-—\s(["])'/g, '$1&lsquo;')
				.replace(/'/g, '&rsquo;')
				.replace(/(^|[-—/[(‘\s])"/g, '$1&ldquo;')
				.replace(/"/g, '&rdquo;')
				.replace(/\.\.\./g, '&hellip;');
		})
		.join('');
}

const renderer = new marked.Renderer();

renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
	return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
};

renderer.paragraph = function ({ tokens }: Tokens.Paragraph) {
	return `<p>${this.parser.parseInline(tokens)}</p>\n`;
};

renderer.hr = () => '<hr />\n';

renderer.br = () => '<br />';

renderer.list = function (token: Tokens.List) {
	const tag = token.ordered ? 'ol' : 'ul';
	const items = token.items.map((item) => this.listitem(item)).join('');
	return `<${tag}>\n${items}</${tag}>\n`;
};

renderer.listitem = function (item: Tokens.ListItem) {
	// python-markdown keeps a "loose" item's children as block elements on their
	// own lines, and renders a "tight" item's content inline.
	const inner = this.parser.parse(item.tokens);
	if (!item.loose) {
		return `<li>${inner.replace(/^<p>/, '').replace(/<\/p>\s*$/, '').trimEnd()}</li>\n`;
	}
	return `<li>\n${inner}</li>\n`;
};

renderer.link = function ({ href, title, tokens }: Tokens.Link) {
	const text = this.parser.parseInline(tokens);
	return title ? `<a href="${href}" title="${title}">${text}</a>` : `<a href="${href}">${text}</a>`;
};

renderer.blockquote = function ({ tokens }: Tokens.Blockquote) {
	return `<blockquote>\n${this.parser.parse(tokens)}</blockquote>\n`;
};

marked.setOptions({
	renderer,
	gfm: false, // python-markdown's `extra` is not GFM: no autolinking, no strikethrough
	breaks: false,
	pedantic: false
});

export function renderMarkdown(source: string): string {
	if (!source) return '';
	const html = marked.parse(source, { async: false }) as string;
	return smarty(html).trimEnd();
}
