import { chromium } from 'playwright';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const BASE='https://one-man-agency-impact-5d90.vercel.app';
const fails=[]; const ok=(n,c,d='')=>{console.log(`  [${c?'PASS':'FAIL'}] ${n}${d?'  '+d:''}`); if(!c)fails.push(n);};

const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:1000}});
await p.goto(BASE+'/admin/login');
await p.fill('#email','lathif.sihab-dewantoro@drpbuildlab.com');
await p.fill('#password','ZMxrv6H%I#joXhICOYrk');
await p.click('button[type=submit]');
await p.waitForURL('**/admin', { timeout: 90000 });

const NAME=`Flowtest ${Date.now()}`;
const FILE=`flowtest-${Date.now()}.png`;
const fp=join(tmpdir(),FILE);
writeFileSync(fp, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));

await p.goto(BASE+'/admin/logos'); await p.waitForLoadState('networkidle');
const before = await p.locator('.cms-logos .cms-logo').count();

await p.setInputFiles('#new-file', fp);
await p.fill('#new-name', NAME);
await p.click('form[action="?/upload"] button[type=submit]');
await p.waitForSelector('.cms-ok', { timeout: 30000 }).catch(()=>{});
await p.waitForTimeout(1500);

ok('upload reports success', /staat nu op de logomuur/.test(await p.locator('.cms-ok').innerText().catch(()=>'')));
const named = p.locator('.cms-logo', { hasText: NAME });
ok('logo appears on the wall', (await named.count()) >= 1, NAME);
ok('wall grew by one', (await p.locator('.cms-logos .cms-logo').count()) === before + 1);
ok('no longer listed as unlinked', !(await p.locator('.cms-banner.pending').innerText().catch(()=>'')).includes(FILE));
rmSync(fp,{force:true});
await b.close();
console.log(fails.length?`\n${fails.length} FAILED`:'\nFlow OK');
process.exit(fails.length?1:0);
