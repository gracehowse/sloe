#!/usr/bin/env node
// Unify top app bar + bottom tab nav across the Sloe screens so the chrome
// is identical everywhere (zero drift). Canonical = today.html (locked ref):
//   top bar  = [hamburger] · "Sloe" · [avatar]   (static, in-flow)
//   bottom   = Today · Plan · ⊕ · Recipes · Progress  (active per screen)
import fs from 'node:fs';

const AVATAR = './img/980dca76aa26.png';

const HEADER = `<header class="w-full bg-[#FFFFFF] border-b border-[#ECEAE4] flex items-center justify-between px-6 h-16" id="top-nav">
<button class="text-[#3B2A4D] flex items-center justify-center p-1 -ml-1">
<svg class="sloe-ico text-2xl" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
</button>
<h1 class="font-headline text-2xl font-semibold text-[#3B2A4D] tracking-tight">Sloe</h1>
<button class="w-8 h-8 rounded-full overflow-hidden border border-[#ECEAE4]">
<img alt="Profile" class="w-full h-full object-cover" src="${AVATAR}"/>
</button>
</header>`;

const ICON = {
  Today: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  Plan: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  Recipes: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  Progress: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
};
function tab(label, active) {
  const col = active ? '#C8794E' : '#9B93A3';
  return `<button class="flex flex-col items-center justify-center" style="color:${col}">
<svg class="sloe-ico mb-1" viewBox="0 0 24 24" aria-hidden="true">${ICON[label]}</svg>
<span class="font-label text-[10px] tracking-wide uppercase font-medium">${label}</span>
</button>`;
}
function nav(active) {
  return `<nav class="w-full bg-[#FFFFFF] border-t border-[#ECEAE4] flex justify-around items-center px-4 pb-6 pt-3">
${tab('Today', active === 'Today')}
${tab('Plan', active === 'Plan')}
<button class="flex flex-col items-center justify-center -mt-8 relative z-10">
<div class="bg-plum w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-surface text-white">
<svg class="sloe-ico text-3xl" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
</div>
</button>
${tab('Recipes', active === 'Recipes')}
${tab('Progress', active === 'Progress')}
</nav>`;
}

const HEADER_RE = /<header\b[^>]*>[\s\S]*?<\/header>/;
const NAV_RE = /<nav\b[^>]*\bbottom-0\b[^>]*>[\s\S]*?<\/nav>/;

const report = {};
function setMainPt(h) {
  // normalise first <main> top padding to pt-6 (header now in-flow)
  return h.replace(/(<main\b[^>]*class=")([^"]*)(")/, (m, a, cls, c) => {
    let nc = cls.replace(/\bpt-\d+\b/g, '').replace(/\s+/g, ' ').trim();
    return a + 'pt-6 ' + nc + c;
  });
}

// --- Tab screens: canonical header + canonical nav (active) + pt fix ---
const tabs = { today: 'Today', cookbook: 'Recipes', planner: 'Plan', progress: 'Progress' };
for (const [f, active] of Object.entries(tabs)) {
  const fp = f + '.html';
  let h = fs.readFileSync(fp, 'utf8');
  const hadHeader = HEADER_RE.test(h);
  const hadNav = NAV_RE.test(h);
  h = h.replace(HEADER_RE, HEADER);
  h = h.replace(NAV_RE, nav(active));
  h = setMainPt(h);
  // planner: its section title lived in the old header — reinsert into body
  if (f === 'planner' && !/Weekly Plan/.test(h.split('</header>')[1] || '')) {
    h = h.replace(/(<main\b[^>]*>)/, `$1
<div class="mb-6"><h2 class="font-headline text-3xl font-medium text-plum tracking-tight">Weekly Plan</h2><p class="text-ink-soft text-sm mt-1">Your week is looking balanced and nourishing.</p></div>`);
  }
  fs.writeFileSync(fp, h);
  report[fp] = { header: hadHeader ? 'replaced' : 'MISSING', nav: hadNav ? 'replaced' : 'MISSING' };
}

// --- Pushed/modal screens: remove the inconsistent bottom tab nav ---
for (const f of ['ask', 'import']) {
  const fp = f + '.html';
  let h = fs.readFileSync(fp, 'utf8');
  const hadNav = NAV_RE.test(h);
  h = h.replace(NAV_RE, '');
  fs.writeFileSync(fp, h);
  report[fp] = { navRemoved: hadNav };
}

// --- Fix the wrong brand name everywhere (Suppr -> Sloe) in visible text ---
let suppr = {};
for (const fp of fs.readdirSync('.').filter(x => x.endsWith('.html'))) {
  let h = fs.readFileSync(fp, 'utf8');
  const n = (h.match(/Suppr/g) || []).length;
  if (n) { h = h.replace(/Suppr/g, 'Sloe'); fs.writeFileSync(fp, h); suppr[fp] = n; }
}
report._supprFixed = suppr;
console.log(JSON.stringify(report, null, 1));
