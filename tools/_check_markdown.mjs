// Development helper: compare the JS Markdown renderer against the exact HTML
// python-markdown produced for every body chunk in content/.
//   node tools/_check_markdown.mjs [--show N]
import fs from 'node:fs';
import { renderMarkdown } from '../src/lib/markdown.ts';

const bodies = JSON.parse(fs.readFileSync('.tmp_bodies.json', 'utf8'));
const show = process.argv.includes('--show')
	? Number(process.argv[process.argv.indexOf('--show') + 1])
	: 3;

const norm = (s) => s.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

let total = 0;
let matched = 0;
let semantic = 0;
const failures = [];

for (const [file, chunks] of Object.entries(bodies)) {
	for (const chunk of chunks) {
		total++;
		const got = renderMarkdown(chunk.md).trim();
		const want = chunk.html.trim();
		if (got === want) {
			matched++;
			semantic++;
		} else if (norm(got) === norm(want)) {
			semantic++;
		} else {
			failures.push({ file, want, got });
		}
	}
}

console.log(`${matched}/${total} chunks byte-identical`);
console.log(`${semantic}/${total} chunks identical ignoring whitespace`);
for (const f of failures.slice(0, show)) {
	console.log('\n=== ' + f.file);
	// print the first differing region
	let i = 0;
	while (i < f.want.length && f.want[i] === f.got[i]) i++;
	console.log('WANT:', JSON.stringify(f.want.slice(Math.max(0, i - 80), i + 160)));
	console.log('GOT :', JSON.stringify(f.got.slice(Math.max(0, i - 80), i + 160)));
}
if (failures.length > show) console.log(`\n...and ${failures.length - show} more`);
