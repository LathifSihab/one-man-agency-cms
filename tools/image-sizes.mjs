/**
 * Record the pixel size of every image the site can serve.
 *
 * An <img> without width and height gives the browser nothing to reserve, so
 * the page reflows when it loads — the responsiveness audit flags it, and on
 * /contact it was the office photo pushing the text down as it arrived.
 *
 * The image fields know their own dimensions because a component writes them;
 * an image placed in a body does not, because Markdown carries only a source.
 * This writes a manifest the Markdown renderer can look up. It is generated
 * before the build, and committed as well, so `vite dev` and the CMS preview
 * have it without running a build first.
 *
 * Only PNG and JPEG are read. Anything else is left out and simply renders
 * without dimensions, exactly as everything did before — never guessed, because
 * a wrong size is worse than none.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOTS = ['static/assets'];
const OUT = 'src/lib/generated/image-sizes.json';

/** width/height from a PNG header, or null if it is not one. */
function pngSize(buf) {
	if (buf.length < 24) return null;
	const signature = buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a;
	if (!signature) return null;
	// IHDR is always the first chunk; its width and height follow the type.
	if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
	return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

/** width/height from a JPEG's frame header, or null. */
function jpegSize(buf) {
	if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
	let i = 2;
	while (i < buf.length - 9) {
		if (buf[i] !== 0xff) {
			i++;
			continue;
		}
		const marker = buf[i + 1];
		// Standalone markers carry no length.
		if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			i += 2;
			continue;
		}
		const length = buf.readUInt16BE(i + 2);
		// Any start-of-frame: baseline, progressive and the rest.
		const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
		if (isFrame) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
		i += 2 + length;
	}
	return null;
}

function sizeOf(file) {
	const ext = extname(file).toLowerCase();
	if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null;
	try {
		const buf = readFileSync(file);
		return ext === '.png' ? pngSize(buf) : jpegSize(buf);
	} catch {
		return null;
	}
}

function walk(dir, files = []) {
	if (!existsSync(dir)) return files;
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, files);
		else files.push(full);
	}
	return files;
}

const sizes = {};
for (const root of ROOTS) {
	for (const file of walk(root)) {
		const size = sizeOf(file);
		if (!size) continue;
		// The path the published site serves it at.
		sizes[`/${relative('static', file).split(/[\\/]/).join('/')}`] = size;
	}
}

const entries = Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b));
// One image per line. A hundred entries pretty-printed four lines deep is
// unreadable in a diff, and this file is committed.
const body = entries.map(([k, [w, h]]) => `\t${JSON.stringify(k)}: [${w}, ${h}]`).join(',\n');
writeFileSync(OUT, `{\n${body}\n}\n`, 'utf8');
console.log(`[sizes] Measured ${entries.length} image(s) into ${OUT}.`);
