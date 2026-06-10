import { writeScreen, ico } from './_gen.mjs';

/* ============================================================
   KEEP #2 (REBUILT) · Log sheet — Favourites / Go-Tos.
   Grace: K2 must match the canonical "11 · Log a meal" (336:2),
   which she prefers; "add more detail to 11". So this replicates
   11's EXACT chrome (ink title, 4 circular methods incl Voice-PRO,
   ink-underline Recent/Favourites/My-recipes, photo thumbs + clay +,
   daily-progress footer) and adds the missing detail: per-item
   macros + a frequency signal on the Favourites (Go-Tos) tab.
   Pure 11 parity — no new design language.
   ============================================================ */

function logMode(icon, label, pro) {
  return `<div class="flex flex-col items-center gap-2"><span class="w-14 h-14 rounded-full bg-surface-card border border-line flex items-center justify-center text-plum relative">${ico(icon, 'text-[22px]')}${pro ? '<span class="absolute -top-1 -right-1 bg-plum text-white font-label text-[8px] font-bold px-1.5 py-0.5 rounded-full">PRO</span>' : ''}</span><span class="font-label text-[11px] text-ink-soft">${label}</span></div>`;
}

/* 11's foodRow + per-item macros (the "more detail") + optional frequency meta */
function foodRow(img, name, kcal, p, c, f) {
  return `<div class="flex items-center gap-3 py-3 border-b border-line last:border-0">
    <div class="w-11 h-11 rounded-xl overflow-hidden bg-surface-card border border-line flex-none"><img src="img/${img}" class="w-full h-full object-cover"/></div>
    <div class="flex-1 min-w-0">
      <p class="font-body text-[15px] text-ink leading-tight truncate">${name}</p>
      <p class="font-body text-xs text-ink-faint mt-0.5">${kcal} · <span style="color:#7C8466">P${p}</span> <span style="color:#C8794E">C${c}</span> <span style="color:#C9892C">F${f}</span></p>
    </div>
    <button class="w-8 h-8 rounded-full bg-surface-card border border-line flex items-center justify-center text-clay flex-none">${ico('plus', 'text-[16px]')}</button>
  </div>`;
}

const tab = (label, on) => on
  ? `<span class="font-body text-sm text-ink font-semibold pb-3 border-b-2 border-ink -mb-px">${label}</span>`
  : `<span class="font-body text-sm text-ink-faint pb-3">${label}</span>`;

/* Go-Tos = your most-logged staples, ranked most-used first (no count shown — the order is the signal) */
const goTos = [
  ['ing-greek-yoghurt.png', 'Greek yogurt', '170 g · 100 kcal', 17, 6, 0],
  ['4978a9fb6702.png', 'Brown eggs', '2 large · 144 kcal', 13, 1, 10],
  ['7a448cef1613.png', 'Jumbo oats', '40 g · 152 kcal', 5, 27, 3],
  ['e427c86a0d4f.png', 'Fresh blueberries', '100 g · 57 kcal', 1, 14, 0],
  ['ing-avocado.png', 'Avocado', '½ · 160 kcal', 2, 9, 15],
  ['ing-chickpeas.png', 'Chickpeas', '100 g · 164 kcal', 9, 27, 3],
];

const sheet = `<div id="cap" class="mx-auto bg-surface rounded-t-3xl pb-8" style="width:500px;position:relative">
  <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1.5 rounded-full bg-line"></div></div>
  <div class="px-6 pt-3 flex items-center justify-between"><h2 class="font-headline text-2xl text-ink">Log a meal</h2><button class="text-ink-soft">${ico('x', 'text-2xl')}</button></div>
  <div class="px-6 mt-4"><div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-3">${ico('search', 'text-ink-faint text-[18px]')}<span class="flex-1 font-body text-sm text-ink-faint">Search foods or scan</span>${ico('scan-barcode', 'text-ink-faint text-[18px]')}</div></div>
  <div class="px-6 mt-5 flex justify-between">${logMode('scan', 'Scan')}${logMode('mic', 'Voice', true)}${logMode('camera', 'Photo')}${logMode('square-pen', 'Quick add')}</div>
  <div class="px-6 mt-6 flex gap-6 border-b border-line">${tab('Recent', false)}${tab('Favourites', true)}${tab('My recipes', false)}</div>
  <div class="px-6">
    ${goTos.map(r => foodRow(...r)).join('')}
  </div>
  <div class="px-6 mt-3 pt-4 border-t border-line flex items-center justify-between">
    <div><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Daily progress</p><p class="font-headline text-xl text-ink">353 <span class="text-sm text-ink-faint font-body">/ 1,593 kcal</span></p></div>
    <div class="flex gap-4 text-center">${[['P', '24g', '#7C8466'], ['C', '42g', '#C8794E'], ['F', '12g', '#C9892C']].map(([l, v, c]) => `<div><p class="font-headline text-[15px]" style="color:${c}">${v}</p><p class="font-label text-[10px] text-ink-faint">${l}</p></div>`).join('')}</div>
  </div>
</div>`;

console.log(writeScreen('log-gotos.html', 'Sloe · Log — Favourites', sheet));
