import { chromium } from 'playwright';
const BASE = process.env.BASE;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const fails = [];
const ok = (n, c, d='') => { console.log(`  [${c?'PASS':'FAIL'}] ${n}${d?'  '+d:''}`); if(!c) fails.push(n); };

// sign in
await p.goto(BASE + '/admin/login');
await p.fill('#email', 'lathif.sihab-dewantoro@drpbuildlab.com');
await p.fill('#password', 'ZMxrv6H%I#joXhICOYrk');
await Promise.all([p.waitForURL('**/admin'), p.click('button[type=submit]')]);
ok('signed in', p.url().endsWith('/admin'));

// ---- media page ----
await p.goto(BASE + '/admin/media');
await p.waitForTimeout(700);
ok('no "Kopieer pad" button remains', (await p.getByRole('button', { name: /Kopieer pad/i }).count()) === 0);
const replaceBtns = await p.getByRole('button', { name: 'Vervangen' }).count();
ok('replace buttons present', replaceBtns > 0, `${replaceBtns} found`);

// delete opens OUR dialog, not window.confirm
let nativeCalled = false;
p.on('dialog', async (d) => { nativeCalled = true; await d.dismiss(); });
await p.getByRole('button', { name: 'Wis' }).first().click();
await p.waitForTimeout(400);
const dlg = p.locator('dialog.cms-confirm');
ok('own dialog is open', await dlg.isVisible());
ok('no browser dialog used', !nativeCalled);
ok('dialog names the file', /verwijderen\?/i.test(await dlg.locator('h2').innerText()));

// Escape cancels, nothing is deleted
const before = await p.locator('.cms-logo').count();
await p.keyboard.press('Escape');
await p.waitForTimeout(500);
ok('Escape closes the dialog', !(await dlg.isVisible()));
ok('nothing deleted on cancel', (await p.locator('.cms-logo').count()) === before, `${before} items`);

// Cancel button also closes
await p.getByRole('button', { name: 'Wis' }).first().click();
await p.waitForTimeout(300);
await p.getByRole('button', { name: 'Annuleren' }).click();
await p.waitForTimeout(400);
ok('Annuleren closes the dialog', !(await dlg.isVisible()));
ok('still nothing deleted', (await p.locator('.cms-logo').count()) === before);

// focus starts on the safe choice
await p.getByRole('button', { name: 'Wis' }).first().click();
await p.waitForTimeout(400);
const focused = await p.evaluate(() => document.activeElement?.textContent?.trim());
ok('focus starts on Annuleren', focused === 'Annuleren', `focused: ${focused}`);
await p.keyboard.press('Escape');

// ---- other screens use it too ----
for (const [url, btn] of [['/admin/submissions','Verwijderen'], ['/admin/logos','Verwijderen']]) {
  await p.goto(BASE + url);
  await p.waitForTimeout(600);
  const has = await p.locator('dialog.cms-confirm').count();
  ok(`${url} has the dialog mounted`, has === 1);
}
await p.goto(BASE + '/admin/blog');
await p.waitForTimeout(400);
await p.locator('table a').first().click();
await p.waitForTimeout(900);
ok('/admin/blog/[slug] has the dialog mounted', (await p.locator('dialog.cms-confirm').count()) === 1);
await p.getByRole('button', { name: /Artikel verwijderen/i }).click();
await p.waitForTimeout(400);
ok('blog delete opens own dialog', await p.locator('dialog.cms-confirm').isVisible());
ok('blog dialog still no browser dialog', !nativeCalled);
await p.keyboard.press('Escape');

await b.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nAll dialog checks passed.');
process.exit(fails.length ? 1 : 0);
