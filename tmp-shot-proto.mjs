import pkg from '/Users/graceturner/Suppr-1/node_modules/playwright/index.js';
const { chromium } = pkg;
const root = '/Users/graceturner/Suppr-1/';
const files = [
  ['docs/prototypes/stitch-sloe/progress-full.html','/tmp/proto-progress.png'],
  ['docs/prototypes/stitch-sloe/progress-empty.html','/tmp/proto-progress-empty.png'],
  ['docs/prototypes/stitch-sloe/progress-metric.html','/tmp/proto-progress-metric.png'],
];
const b = await chromium.launch();
for (const [f,out] of files) {
  const p = await b.newPage({ viewport:{width:500,height:900}, deviceScaleFactor:2 });
  await p.goto('file://'+root+f, {waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  await p.screenshot({path:out, fullPage:true});
  console.log('wrote', out);
  await p.close();
}
await b.close();
