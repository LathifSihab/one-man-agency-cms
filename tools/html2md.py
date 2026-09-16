# -*- coding: utf-8 -*-
"""
HTML -> Markdown, tuned to exactly the tag vocabulary that build.py's Markdown
renderer emits for this site: p, h2, h3, ul/ol/li, strong, em, code, a, blockquote.

This is deliberately NOT a general converter. It only has to be correct for this
content, and correctness is verified by round-tripping: markdown(html2md(x)) == x.
See tools/extract.py --verify.
"""
from bs4 import BeautifulSoup, NavigableString, Tag

# The source mixes two conventions, and the rendered HTML distinguishes them:
#
#   * a LITERAL typographic character in dist/ came from a literal character in
#     the source Markdown, which smarty left alone;
#   * an HTML ENTITY (&rsquo;) in dist/ came from an ASCII quote/dash that smarty
#     converted.
#
# BeautifulSoup decodes both to the same character, which would erase the
# distinction and break the round-trip. So callers substitute entities for
# private-use sentinels *before* parsing (see SENTINELS / presentinel), and we
# map each sentinel back to the ASCII spelling that produced it.
SENTINELS = [
    ('&rsquo;', '', '’', "'"),
    ('&lsquo;', '', '‘', "'"),
    ('&ldquo;', '', '“', '"'),
    ('&rdquo;', '', '”', '"'),
    ('&mdash;', '', '—', '---'),
    ('&ndash;', '', '–', '--'),
    ('&hellip;', '', '…', '...'),
]


def presentinel(raw_html):
    """Replace smarty-produced entities with sentinels, pre-parse."""
    for entity, sentinel, _char, _ascii in SENTINELS:
        raw_html = raw_html.replace(entity, sentinel)
    return raw_html


def sentinel_to_ascii(text):
    """For Markdown bodies: restore the ASCII spelling smarty converted from."""
    for _entity, sentinel, _char, ascii_source in SENTINELS:
        text = text.replace(sentinel, ascii_source)
    return text


def sentinel_to_char(text):
    """For front-matter values: restore the real typographic character."""
    for _entity, sentinel, char, _ascii in SENTINELS:
        text = text.replace(sentinel, char)
    return text


def unsmarty(text):
    return sentinel_to_ascii(text)


def escape_md(text):
    # Only escape what would otherwise be read as Markdown syntax at parse time.
    out = []
    for i, line in enumerate(text.split('\n')):
        stripped = line.lstrip()
        indent = line[:len(line) - len(stripped)]
        if stripped[:2] in ('- ', '* ', '+ '):
            stripped = '\\' + stripped
        elif stripped[:2] in ('# ',) or stripped[:3] in ('## ', '###'):
            stripped = '\\' + stripped
        out.append(indent + stripped)
    return '\n'.join(out)


def inline(node):
    """Render an inline run of nodes back to Markdown."""
    parts = []
    for child in node.children:
        if isinstance(child, NavigableString):
            parts.append(unsmarty(str(child)))
        elif isinstance(child, Tag):
            inner = inline(child)
            if child.name in ('strong', 'b'):
                parts.append(f'**{inner}**')
            elif child.name in ('em', 'i'):
                parts.append(f'*{inner}*')
            elif child.name == 'code':
                parts.append(f'`{inner}`')
            elif child.name == 'a':
                href = child.get('href', '')
                title = child.get('title')
                if title:
                    parts.append(f'[{inner}]({href} "{title}")')
                else:
                    parts.append(f'[{inner}]({href})')
            elif child.name == 'br':
                parts.append('  \n')
            elif child.name == 'img':
                parts.append(f'![{child.get("alt","")}]({child.get("src","")})')
            elif child.name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                # Headings nested inside a list item: the source really did write
                # "1. ### Tijdsaudit". Reproduce it rather than flattening.
                parts.append('#' * int(child.name[1]) + ' ' + inner)
            else:
                parts.append(inner)
    return ''.join(parts)


def list_block(tag, depth=0):
    lines = []
    ordered = tag.name == 'ol'
    n = 0
    for li in tag.find_all('li', recursive=False):
        n += 1
        marker = f'{n}. ' if ordered else '- '
        # Split the <li> into its own inline content and any nested lists.
        nested = [c for c in li.children if isinstance(c, Tag) and c.name in ('ul', 'ol')]
        for c in nested:
            c.extract()
        text = inline(li).strip()
        pad = '  ' * depth
        body_lines = text.split('\n')
        lines.append(pad + marker + body_lines[0])
        # Continuation lines keep the indentation the source used (3 spaces under
        # an ordered marker, 2 under a bullet). Markdown preserves that leading
        # whitespace in the rendered text, so re-indenting would change output.
        for extra in body_lines[1:]:
            lines.append(extra)
        for c in nested:
            lines.extend(list_block(c, depth + 1))
    return lines


def to_markdown(html_fragment):
    soup = BeautifulSoup(html_fragment, 'html.parser')
    blocks = []
    for el in soup.children:
        if isinstance(el, NavigableString):
            if el.strip():
                blocks.append(unsmarty(str(el).strip()))
            continue
        if not isinstance(el, Tag):
            continue
        if el.name == 'p':
            blocks.append(inline(el).strip())
        elif el.name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            level = int(el.name[1])
            blocks.append('#' * level + ' ' + inline(el).strip())
        elif el.name in ('ul', 'ol'):
            blocks.append('\n'.join(list_block(el)))
        elif el.name == 'blockquote':
            inner = to_markdown(el.decode_contents())
            blocks.append('\n'.join('> ' + l if l else '>' for l in inner.split('\n')))
        elif el.name == 'pre':
            code = el.get_text()
            blocks.append('```\n' + code.rstrip('\n') + '\n```')
        elif el.name == 'hr':
            blocks.append('---')
        else:
            # Anything else is a build.py-generated block, not body prose.
            blocks.append(str(el))
    return '\n\n'.join(b for b in blocks if b.strip())
