/**
 * Responsiveness audit.
 *
 * Loads the built site in a real browser at several viewports and reports the
 * things that actually break a layout and cannot be seen by reading CSS:
 *
 *   - horizontal overflow (the page scrolling sideways)
 *   - any element wider than the viewport, named so it can be found
 *   - content running under the viewport edge, i.e. a missing gutter
 *   - text below a legible size
 *   - tap targets under 24x24 (WCAG 2.5.8, AA), and separately under 44x44
 *     (WCAG 2.5.5 AAA and platform guidance) as advisory
 *   - images with no intrinsic size, which cause layout shift
 *
 *   node tools/responsive.mjs [--base http://localhost:4173] [--all]
 *
 * With no --base it serves .vercel/output/static itself. That matters: a generic
 * static server in SPA mode rewrites every extensionless URL to index.html, so
 * the audit silently measures the home page once per route and reports a clean
 * sweep. The built-in server maps /prijzen to prijzen.html the way Vercel does,
 * and 404s anything missing so a bad route is visible.
 *
 * Pass --all to sweep every page rather than the representative set.
 */

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.xml': 'application/xml',
	'.txt': 'text/plain; charset=utf-8'
};

/** Serves the build with Vercel's clean-URL mapping. Returns [origin, close]. */
async function serveBuild(root) {
	const server = createServer((req, res) => {
		const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		const candidates =
			path === '/'
				? ['index.html']
				: [path.slice(1), `${path.slice(1)}.html`, join(path.slice(1), 'index.html')];

		for (const rel of candidates) {
			const file = join(root, rel);
			if (existsSync(file) && statSync(file).isFile()) {
				res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
				res.end(readFileSync(file));
				return;
			}
		}
		res.writeHead(404, { 'content-type': 'text/plain' });
		res.end('not found');
	});

	await new Promise((resolve) => server.listen(0, resolve));
	const { port } = server.address();
	return [`http://127.0.0.1:${port}`, () => new Promise((r) => server.close(r))];
}
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const i = args.indexOf(name);
	return i === -1 ? fallback : args[i + 1];
};

const EXPLICIT_BASE = flag('--base', null);
const ALL = args.includes('--all');
const ROOT = '.vercel/output/static';

const [BASE, stopServer] = EXPLICIT_BASE
	? [EXPLICIT_BASE.replace(/\/$/, ''), async () => {}]
	: await serveBuild(ROOT);

const VIEWPORTS = [
	{ name: 'mobile-small', width: 320, height: 720 },
	{ name: 'mobile', width: 375, height: 812 },
	{ name: 'mobile-large', width: 430, height: 932 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'laptop', width: 1024, height: 768 },
	{ name: 'desktop', width: 1440, height: 900 }
];

const SAMPLE = [
	'/',
	'/diensten',
	'/diensten/webdesign',
	'/prijzen',
	'/blog',
	'/blog/marketingbudget-de-vuistregel',
	'/referenties',
	'/contact',
	'/gratis-marketingscan',
	'/afspraak',
	'/veelgestelde-vragen',
	'/regio/marketingbureau-aalst',
	'/sectoren/horeca-en-retail',
	'/404'
];

function everyRoute(dir = ROOT, prefix = '') {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry === 'admin' || entry === '_app') continue;
			out.push(...everyRoute(full, `${prefix}/${entry}`));
		} else if (entry.endsWith('.html')) {
			out.push(entry === 'index.html' ? prefix || '/' : `${prefix}/${entry.slice(0, -5)}`);
		}
	}
	return out;
}

const ROUTES = ALL ? [...new Set(everyRoute())].sort() : SAMPLE;

/** Runs in the page. Returns everything measurable in one pass. */
function audit() {
	const vw = document.documentElement.clientWidth;
	const describe = (el) => {
		const id = el.id ? `#${el.id}` : '';
		const cls = typeof el.className === 'string' && el.className.trim()
			? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
			: '';
		return `${el.tagName.toLowerCase()}${id}${cls}`;
	};

	const overflowing = [];
	const cutOff = [];
	const tinyText = [];
	const smallTargets = [];
	const advisoryTargets = [];
	const unsizedImages = [];

	for (const el of document.querySelectorAll('body *')) {
		const style = getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden') continue;
		const r = el.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) continue;

		// Decorative layers are allowed to bleed; they carry pointer-events: none.
		// A skip link is parked far offscreen until focused, by design.
		// Content inside a deliberately scrollable box — the price tables live in
		// .tablewrap { overflow-x: auto } — is meant to exceed the viewport and is
		// swiped, not a layout fault. Page-level horizontal scroll is checked
		// separately and is the finding that actually matters.
		let inScroller = false;
		for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
			const ox = getComputedStyle(p).overflowX;
			if (ox === 'auto' || ox === 'scroll') {
				inScroller = true;
				break;
			}
		}
		// aria-hidden marks content deliberately absent from the accessibility
		// tree — the spam honeypot on the forms is parked offscreen this way.
		const hiddenOnPurpose = el.closest('[aria-hidden="true"]') !== null;

		const decorative =
			style.pointerEvents === 'none' ||
			el.classList.contains('skip') ||
			hiddenOnPurpose ||
			inScroller;

		if (!decorative && r.width > vw + 1) {
			overflowing.push(`${describe(el)} (${Math.round(r.width)}px wide)`);
		}
		if (!decorative && (r.right > vw + 1 || r.left < -1)) {
			cutOff.push(`${describe(el)} (left ${Math.round(r.left)}, right ${Math.round(r.right)})`);
		}

		const size = parseFloat(style.fontSize);
		const hasOwnText = [...el.childNodes].some(
			(n) => n.nodeType === 3 && n.textContent.trim().length > 1
		);
		if (hasOwnText && size < 12) {
			tinyText.push(`${describe(el)} ${size.toFixed(1)}px`);
		}

		if (el.matches('a, button, summary, input, select, textarea') && !el.classList.contains('skip')) {
			// A label bound to a control activates it, so the real target is both.
			let box = r;
			if (el.id) {
				const bound = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
				if (bound) {
					const lr = bound.getBoundingClientRect();
					box = {
						width: Math.max(r.right, lr.right) - Math.min(r.left, lr.left),
						height: Math.max(r.bottom, lr.bottom) - Math.min(r.top, lr.top)
					};
				}
			}
			const r2 = box;
			const label = `${describe(el)} ${Math.round(r2.width)}x${Math.round(r2.height)}`;
			if (r2.height > 0 && r2.height < 24 && r2.width < 24) smallTargets.push(label);
			else if (r2.height > 0 && r2.height < 44 && r2.width < 44) advisoryTargets.push(label);
		}

		if (el.tagName === 'IMG' && (!el.getAttribute('width') || !el.getAttribute('height'))) {
			unsizedImages.push(describe(el));
		}
	}

	return {
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: vw,
		horizontalScroll: document.documentElement.scrollWidth > vw + 1,
		overflowing: [...new Set(overflowing)].slice(0, 6),
		cutOff: [...new Set(cutOff)].slice(0, 6),
		tinyText: [...new Set(tinyText)].slice(0, 4),
		smallTargets: [...new Set(smallTargets)].slice(0, 4),
		advisoryTargets: [...new Set(advisoryTargets)].slice(0, 4),
		unsizedImages: [...new Set(unsizedImages)].slice(0, 4),
		navVisible: (() => {
			const list = document.getElementById('navlist');
			const toggle = document.querySelector('.nav-toggle');
			if (!list || !toggle) return null;
			return {
				listDisplay: getComputedStyle(list).display,
				toggleDisplay: getComputedStyle(toggle).display
			};
		})()
	};
}

const browser = await chromium.launch();
const problems = [];
let checked = 0;

for (const viewport of VIEWPORTS) {
	const context = await browser.newContext({
		viewport: { width: viewport.width, height: viewport.height },
		deviceScaleFactor: 1
	});
	const page = await context.newPage();

	for (const route of ROUTES) {
		const response = await page.goto(BASE + route, { waitUntil: 'load' });
		if (!response || !response.ok()) {
			problems.push({ viewport: viewport.name, route, kind: 'load', detail: `HTTP ${response?.status()}` });
			continue;
		}
		// Let entrance animations settle so transforms are not measured mid-flight.
		await page.waitForTimeout(900);

		const r = await page.evaluate(audit);
		checked++;

		if (r.horizontalScroll) {
			problems.push({
				viewport: viewport.name,
				route,
				kind: 'horizontal scroll',
				detail: `scrollWidth ${r.scrollWidth} > viewport ${r.clientWidth}`
			});
		}
		for (const [kind, list] of [
			['wider than viewport', r.overflowing],
			['past the viewport edge', r.cutOff],
			['text under 12px', r.tinyText],
			['tap target under 24x24 (WCAG 2.5.8 AA)', r.smallTargets],
			['image without width/height', r.unsizedImages]
		]) {
			if (list.length) {
				problems.push({ viewport: viewport.name, route, kind, detail: list.join(', ') });
			}
		}
	}

	// The burger menu should replace the inline nav below 920px.
	await page.goto(BASE + '/', { waitUntil: 'load' });
	const nav = await page.evaluate(audit).then((r) => r.navVisible);
	const shouldCollapse = viewport.width <= 920;
	const collapsed = nav && nav.listDisplay === 'none';
	if (nav && shouldCollapse !== collapsed) {
		problems.push({
			viewport: viewport.name,
			route: '/',
			kind: 'navigation',
			detail: shouldCollapse
				? `expected the burger menu, but the list is ${nav.listDisplay}`
				: `expected the full nav, but the list is ${nav.listDisplay}`
		});
	}

	await context.close();
	console.log(`checked ${viewport.name} (${viewport.width}px)`);
}

await browser.close();
await stopServer();

console.log(`\n${checked} page renders measured across ${VIEWPORTS.length} viewports.\n`);

if (!problems.length) {
	console.log('No responsiveness problems found.');
	process.exit(0);
}

const byKind = new Map();
for (const p of problems) {
	if (!byKind.has(p.kind)) byKind.set(p.kind, []);
	byKind.get(p.kind).push(p);
}

for (const [kind, list] of byKind) {
	console.log(`${kind} — ${list.length} occurrence(s)`);
	for (const p of list.slice(0, 8)) {
		console.log(`  ${p.viewport.padEnd(13)} ${p.route.padEnd(36)} ${p.detail}`);
	}
	if (list.length > 8) console.log(`  …and ${list.length - 8} more`);
	console.log();
}
process.exit(1);
