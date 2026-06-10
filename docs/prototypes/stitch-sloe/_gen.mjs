#!/usr/bin/env node
// Sloe screen generator — produces NEW screens that match the existing 11
// (same tokens, Newsreader/Inter, lucide line-icons, capture-ready).
// Usage: import { writeScreen, ico, backHeader, tabBar } and call gen funcs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.resolve(__dir, '../../../node_modules/lucide-react/dist/esm/icons');

// --- lucide path loader (follows re-export aliases) ---
function lucide(name, depth = 0) {
  if (depth > 4) throw new Error('alias loop ' + name);
  const src = fs.readFileSync(path.join(ICONS, name + '.js'), 'utf8');
  const re = src.match(/export \{ default \} from '\.\/([\w-]+)\.js'/);
  if (re) return lucide(re[1], depth + 1);
  const m = src.match(/const __iconNode = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('no __iconNode in ' + name);
  // eslint-disable-next-line no-eval
  const arr = eval('(' + m[1] + ')');
  return arr.map(([tag, attrs]) => {
    const a = Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a}/>`;
  }).join('');
}
export function ico(name, cls = '') {
  return `<svg class="sloe-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${lucide(name)}</svg>`;
}

// Arc path 'd' for a custom ring (start at 12 o'clock, clockwise).
export function arcD(cx, cy, r, frac) {
  let f = frac; if (f >= 1) f = 0.9999; if (f <= 0) return '';
  const a0 = -Math.PI / 2, a1 = a0 + 2 * Math.PI * f;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

// Clean progress-ring as a real SVG arc PATH (no stroke-dasharray — captures reliably in Figma).
// size = svg px (square, matches viewBox), r = radius, frac 0..1, colors hex, sub = center caption.
export function arcRing(value, of, frac, colorHex, trackHex, sub, size = 230) {
  const c = size / 2, r = (size - 26) / 2;
  let f = frac; if (f >= 1) f = 0.9999;
  const a0 = -Math.PI / 2, a1 = a0 + 2 * Math.PI * f;
  const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
  const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
  const large = f > 0.5 ? 1 : 0;
  const arc = f > 0 ? `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${colorHex}" stroke-width="13" stroke-linecap="round"/>` : '';
  return `<div class="relative mx-auto" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${trackHex}" stroke-width="13"/>${arc}</svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center"><span class="font-headline text-5xl text-ink">${value.toLocaleString()}</span><span class="font-body text-[13px] text-ink-faint mt-1">${sub}</span></div></div>`;
}

// Concentric MULTI-RING (calories outer + macro rings) as real arc PATHS — captures clean in Figma.
// Sloe Today standard (Grace 2026-06-02): calories ring + protein/carbs/fat rings, with macro tiles kept below.
// calVal/calOf = calories; macros = [{value, of, color}] outer→inner (protein, carbs, fat). trackHex = ring track.
export function multiRing(calVal, calOf, macros, trackHex = '#EDEAF1', size = 230, calColor = '#3B2A4D', overColor = '#6A4B7A') {
  const c = size / 2;
  const arc = (r, w, frac, color) => {
    let f = frac; if (f >= 1) f = 0.9999; if (f <= 0) return '';
    const a0 = -Math.PI / 2, a1 = a0 + 2 * Math.PI * f;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
    const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    return `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  // rings outer→inner: calories (thick), then macros (thin). radii scale to size.
  const rCal = c - 13, rings = [{ r: rCal, w: 11, frac: calVal / calOf, color: calColor }];
  const step = (rCal - 30) / Math.max(macros.length, 1) * 0.62;
  macros.forEach((m, i) => rings.push({ r: rCal - 16 - i * 12, w: 6, frac: m.value / m.of, color: m.color }));
  const tracks = rings.map(rg => `<circle cx="${c}" cy="${c}" r="${rg.r}" fill="none" stroke="${trackHex}" stroke-width="${rg.w}"/>`).join('');
  // when a ring is at/over 100% draw a FULL circle (not a 99.99% arc) so "complete" reads as complete; overage handled below.
  const arcs = rings.map(rg => rg.frac >= 1
    ? `<circle cx="${c}" cy="${c}" r="${rg.r}" fill="none" stroke="${rg.color}" stroke-width="${rg.w}"/>`
    : arc(rg.r, rg.w, rg.frac, rg.color)).join('');
  // over-budget: plum base lap full + lighter plum second lap (matches shipped CalorieRing)
  const overFrac = (calVal / calOf) > 1 ? Math.min(calVal / calOf - 1, 0.5) : 0;
  const overArc = overFrac > 0 ? arc(rCal, 11, overFrac, overColor) : '';
  return `<div class="relative mx-auto" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${tracks}${arcs}${overArc}</svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center"><span class="font-headline text-[40px] leading-none tracking-tight text-ink">${calVal.toLocaleString()}</span><span class="font-body text-xs text-ink-faint mt-1">of ${calOf.toLocaleString()} kcal</span></div></div>`;
}

const HEAD = (title) => `<!DOCTYPE html>
<html class="light" lang="en"><head>
<meta name="viewport" content="width=500, initial-scale=1, viewport-fit=cover"/>
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
<meta charset="utf-8"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>tailwind.config={theme:{extend:{colors:{plum:'#3B2A4D','plum-deep':'#241733',damson:'#6A4B7A',frost:'#C9C2D6','frost-mist':'#EDEAF1',clay:'#C8794E','clay-soft':'#F4E2D2',honey:'#D6A24A',sage:'#5E7C5A',amber:'#C9892C',destructive:'#C0533F',ink:{DEFAULT:'#221B26',soft:'#6A6072',faint:'#9B93A3'},line:'#E8E2EC',surface:{DEFAULT:'#FFFFFF',card:'#F6F5F2'},oat:'#FBF8F3',macro:{protein:'#7C8466',carbs:'#C8794E',fat:'#C9892C',fiber:'#4A7878'}},borderRadius:{DEFAULT:'0.5rem',lg:'1rem',xl:'1.5rem','2xl':'1.25rem',full:'9999px'},fontFamily:{headline:['Newsreader','serif'],display:['Newsreader','serif'],body:['Inter','sans-serif'],label:['Inter','sans-serif']}}}}</script>
<style>
svg.sloe-ico{width:1em;height:1em;font-size:24px;display:inline-block;vertical-align:-0.15em;flex:none;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
body{position:relative;padding-bottom:0}
[class~="fixed"][class*="bottom-"],[class~="sticky"][class*="bottom-"]{position:static !important;width:100% !important}
</style></head>`;

// Back header (pushed/detail screens). action = optional right-side html.
export function backHeader(title, action = '') {
  return `<header class="w-full bg-surface border-b border-line flex items-center justify-between px-4 h-16">
<button onclick="history.back()" class="p-1 -ml-1 text-plum">${ico('chevron-left','text-2xl')}</button>
<h1 class="font-headline text-xl text-plum">${title}</h1>
<div class="w-8 flex items-center justify-end text-ink-soft">${action}</div>
</header>`;
}

// Canonical top app bar (tab screens): minimal — Sloe wordmark left, avatar right. No hamburger (nav = tabs, settings = avatar).
export function appBar() {
  return `<header class="w-full bg-surface flex items-center justify-between px-5 h-14">
<span class="font-headline text-xl font-semibold text-plum tracking-tight">Sloe</span>
<a href="settings.html" class="w-9 h-9 rounded-full bg-damson flex items-center justify-center text-white font-label text-xs font-semibold">G</a>
</header>`;
}
// Canonical bottom tab bar (in-flow / static for capture). active = Today|Plan|Recipes|Progress
export function tabBar(active) {
  const TAB = { Today: ['calendar','today.html'], Plan: ['book-open','planner.html'], Recipes: ['utensils','cookbook.html'], Progress: ['chart-no-axes-column','progress.html'] };
  const item = (label) => {
    const on = label === active;
    return `<a href="${TAB[label][1]}" class="flex flex-col items-center justify-center gap-1" style="color:${on ? '#C8794E' : '#9B93A3'}">${ico(TAB[label][0], 'mb-0.5')}<span class="font-label text-[10px] tracking-wide uppercase font-medium">${label}</span></a>`;
  };
  return `<nav class="w-full bg-surface border-t border-line flex justify-around items-end px-4 pt-3 pb-6">
${item('Today')}${item('Plan')}
<a href="logmeal.html" class="-mt-8"><span class="w-14 h-14 rounded-full bg-plum flex items-center justify-center text-white shadow-lg border-4 border-surface">${ico('plus','text-3xl')}</span></a>
${item('Recipes')}${item('Progress')}
</nav>`;
}

// Dark theme — warm plum-charcoal, cream text, lifted accents. Same token NAMES so helpers reuse.
const HEAD_DARK = (title) => `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta name="viewport" content="width=500, initial-scale=1, viewport-fit=cover"/>
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
<meta charset="utf-8"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>tailwind.config={theme:{extend:{colors:{plum:'#815E91','plum-deep':'#100F12',damson:'#6A4B7A',frost:'#815E91','frost-mist':'#2A282E',clay:'#D58A5E','clay-soft':'#3A2A20',honey:'#D6A24A',sage:'#83A57E',amber:'#D6A24A',destructive:'#DC6B55',ink:{DEFAULT:'#F5F3F4',soft:'#B7B2BA',faint:'#857F8B'},line:'#35323A',surface:{DEFAULT:'#19181C',card:'#232126'},oat:'#232126',macro:{protein:'#A2AE88',carbs:'#D58A5E',fat:'#D6A24A',fiber:'#6FA3A3'}},borderRadius:{DEFAULT:'0.5rem',lg:'1rem',xl:'1.5rem','2xl':'1.25rem',full:'9999px'},fontFamily:{headline:['Newsreader','serif'],display:['Newsreader','serif'],body:['Inter','sans-serif'],label:['Inter','sans-serif']}}}}</script>
<style>
svg.sloe-ico{width:1em;height:1em;font-size:24px;display:inline-block;vertical-align:-0.15em;flex:none;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
body{position:relative;padding-bottom:0;background:#19181C}
[class~="fixed"][class*="bottom-"],[class~="sticky"][class*="bottom-"]{position:static !important;width:100% !important}
@keyframes sh{0%{opacity:.5}50%{opacity:.9}100%{opacity:.5}} .sk{animation:sh 1.4s ease-in-out infinite}
</style></head>`;

// Web head — responsive (viewport=device-width, no fixed 500). Same light tokens.
// Also neutralise the sticky TOP nav for capture (else html-to-design floats it at the scroll offset).
const HEAD_WEB = (title) => HEAD(title)
  .replace('<meta name="viewport" content="width=500, initial-scale=1, viewport-fit=cover"/>',
           '<meta name="viewport" content="width=device-width, initial-scale=1"/>')
  .replace('</style></head>',
           '[class~="sticky"][class*="top-"]{position:static !important}</style></head>');

// Julienne-style top nav bar (canonical web shell). active = Today|Plan|Recipes|Progress
// Inline links on md+; wordmark + avatar + hamburger on mobile. Upgrade chip + dark toggle right.
export function webTopNav(active) {
  const NAV = [['Today','today-web.html'],['Plan','planner.html'],['Recipes','cookbook.html'],['Progress','progress.html']];
  const link = ([label,href]) => { const on = label===active; return `<a href="${href}" class="relative font-body text-[15px] ${on?'text-ink font-semibold':'text-ink-soft hover:text-ink'} pb-1">${label}${on?'<span class="absolute left-0 -bottom-px w-full h-0.5 bg-ink rounded-full"></span>':''}</a>`; };
  return `<header class="sticky top-0 z-20 bg-surface/85 backdrop-blur border-b border-line">
  <div class="max-w-6xl mx-auto flex items-center justify-between px-5 md:px-8 h-[68px]">
    <a href="today-web.html" class="font-headline text-2xl font-semibold text-plum">Sloe</a>
    <nav class="hidden md:flex items-center gap-8">${NAV.map(link).join('')}</nav>
    <div class="flex items-center gap-2.5">
      <a href="paywall.html" class="hidden sm:inline-flex items-center gap-1.5 bg-clay text-white font-body font-semibold text-[13px] rounded-full px-3.5 py-2">${ico('sparkles','text-[15px]')} Go Pro</a>
      <button class="hidden sm:flex w-9 h-9 rounded-full border border-line items-center justify-center text-ink-soft">${ico('moon','text-[17px]')}</button>
      <a href="settings.html" class="w-9 h-9 rounded-full bg-damson flex items-center justify-center text-white font-label text-xs font-semibold">G</a>
      <button class="md:hidden w-9 h-9 flex items-center justify-center text-ink">${ico('menu','text-[22px]')}</button>
    </div>
  </div>
</header>`;
}

// Desktop left sidebar nav (lg+) — DEPRECATED for app shell (Grace 2026-06-02 chose webTopNav). Kept for reference.
export function webSidebar(active) {
  const NAV = { Today:'calendar', Plan:'book-open', Recipes:'utensils', Progress:'chart-no-axes-column' };
  const item = (label) => { const on = label===active; return `<a class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl ${on?'bg-frost-mist text-plum font-semibold':'text-ink-soft hover:bg-surface-card'}">${ico(NAV[label],'text-[20px]')}<span class="font-body text-[15px]">${label}</span></a>`; };
  return `<aside class="hidden lg:flex flex-col w-[248px] shrink-0 h-screen sticky top-0 border-r border-line px-4 py-6">
<div class="px-3 mb-8"><span class="font-headline text-2xl font-semibold text-plum">Sloe</span></div>
<nav class="flex flex-col gap-1">${item('Today')}${item('Plan')}${item('Recipes')}${item('Progress')}</nav>
<button class="mt-4 mx-1 bg-clay text-white font-body font-semibold text-sm rounded-full py-3 flex items-center justify-center gap-2">${ico('plus','text-[18px]')} Log a meal</button>
<div class="flex-1"></div>
<div class="flex items-center gap-3 px-2 py-2"><span class="w-9 h-9 rounded-full bg-damson flex items-center justify-center text-white font-label text-xs font-semibold">G</span><div><p class="font-body text-sm font-medium text-ink leading-tight">Grace</p><p class="font-body text-[11px] text-ink-faint">Free plan</p></div></div>
</aside>`;
}

// Shared prototype click-router: makes key CTAs + recipe cards navigate without hand-linking every button.
export const PROTO_ROUTER = `<script>document.addEventListener('click',function(e){
 var n=e.target.closest('[data-nav]'); if(n){e.preventDefault();location.href=n.getAttribute('data-nav');return;}
 var el=e.target.closest('a,button,[role=button],label'); if(!el) return;
 var t=(el.textContent||'').trim().toLowerCase().replace(/\\s+/g,' ');
 var nx=document.body.getAttribute('data-next');
 var map={'get started':'onboarding.html','i already have an account':'auth.html','continue with apple':'onboarding.html','continue with google':'onboarding.html','continue with email':'onboarding.html','continue':nx,'next step':nx,'no allergies':'onboarding-plan.html','start using sloe':'today.html','start cooking':'cook.html','cook':'cook.html','import recipe':'recipe-verify.html','add custom item':null,'log a meal':'logmeal.html'};
 if(t in map && map[t]){e.preventDefault();location.href=map[t];return;}
 var card=e.target.closest('[data-recipe],.recipe-card'); if(card){e.preventDefault();location.href='recipe.html';}
},true);</script>`;

export function writeScreen(filename, title, bodyHtml, opts = {}) {
  const bodyClass = opts.bodyClass || 'bg-surface text-ink font-body antialiased';
  const head = opts.web ? HEAD_WEB(title) : (opts.dark ? HEAD_DARK(title) : HEAD(title));
  const nextAttr = opts.next ? ` data-next="${opts.next}"` : '';
  const html = `${head}
<body class="${bodyClass}"${nextAttr}>
${bodyHtml}
${PROTO_ROUTER}
</body></html>`;
  fs.writeFileSync(path.join(__dir, filename), html);
  return filename;
}
