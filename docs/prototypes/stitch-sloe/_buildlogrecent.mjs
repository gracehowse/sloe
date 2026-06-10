import { writeScreen, ico } from './_gen.mjs';

/* ============================================================
   KEEP #2 · Log sheet — Recent / Go-Tos tab (one-tap re-log).
   Extends the canonical Log sheet (11 · Log a meal, 336:2).
   Mobbin best-of: MFP Recent/Frequent + MacroFactor recency,
   Sloe-skinned. The retention move: your staples, one tap.
   Tokens: exact Sloe palette via _gen HEAD.
   ============================================================ */

const tabs = ['Recent', 'Go-Tos', 'Saved'];
function tabRow(active) {
  return `<div class="flex gap-6 px-5 border-b border-line">${tabs.map(t => {
    const on = t === active;
    return `<button class="relative pb-2.5 pt-1 font-body text-sm ${on ? 'text-clay font-semibold' : 'text-ink-soft'}">${t}${on ? '<span class="absolute left-0 -bottom-px w-full h-0.5 bg-clay rounded-full"></span>' : ''}</button>`;
  }).join('')}</div>`;
}

/* food row — tile + name(+freq) + macros + one-tap add */
function foodRow(initial, name, portion, kcal, p, c, f, freq) {
  return `<div class="flex items-center gap-3 px-5 py-3">
    <span class="w-11 h-11 rounded-xl bg-frost-mist flex items-center justify-center font-headline text-[15px] text-plum shrink-0">${initial}</span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="font-body text-sm font-medium text-ink truncate">${name}</p>
        ${freq ? `<span class="inline-flex items-center gap-0.5 font-body text-[10px] text-honey shrink-0">${ico('star', 'text-[10px]')}${freq}</span>` : ''}
      </div>
      <p class="font-body text-[12px] text-ink-soft mt-0.5">${portion} · <span class="text-ink tabular-nums">${kcal}</span> kcal · <span class="tabular-nums">P${p} C${c} F${f}</span></p>
    </div>
    <button class="w-9 h-9 rounded-full border border-clay text-clay flex items-center justify-center shrink-0">${ico('plus', 'text-[18px]')}</button>
  </div>`;
}

const methodChip = (icon, label) => `<button class="flex-1 flex items-center justify-center gap-1.5 bg-surface-card border border-line rounded-full py-2.5 font-body text-[13px] text-ink">${ico(icon, 'text-[16px] text-plum')} ${label}</button>`;

const goTos = [
  ['FW', 'Flat white', '1 cup', 120, 7, 10, 6, '41×'],
  ['GY', 'Greek yogurt & berries', '1 bowl', 220, 18, 24, 6, '32×'],
  ['BN', 'Banana', '1 medium', 105, 1, 27, 0, '28×'],
  ['CR', 'Chicken & rice bowl', '1 serving', 540, 42, 58, 14, '24×'],
  ['PO', 'Protein oats', '1 bowl', 380, 28, 46, 9, '19×'],
  ['SE', 'Scrambled eggs on toast', '2 eggs', 330, 22, 26, 16, '15×'],
];

const sheet = `<div id="cap" class="mx-auto bg-surface" style="width:500px;position:relative">
  <div class="pt-2.5 pb-1 flex justify-center"><span class="w-9 h-1 rounded-full bg-line"></span></div>
  <header class="px-5 pt-2 pb-3 flex items-center justify-between">
    <button class="flex items-center gap-1.5 font-headline text-2xl text-plum leading-tight">Add to Lunch ${ico('chevron-down', 'text-[18px] text-ink-soft')}</button>
    <button class="w-8 h-8 rounded-full bg-surface-card border border-line flex items-center justify-center text-ink-soft">${ico('x', 'text-[17px]')}</button>
  </header>

  <div class="px-5 pb-3">
    <div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 h-11">
      ${ico('search', 'text-[18px] text-ink-faint')}
      <span class="font-body text-sm text-ink-faint flex-1">Search foods, brands, dishes</span>
      ${ico('scan-line', 'text-[18px] text-ink-soft')}
    </div>
    <div class="flex gap-2 mt-3">
      ${methodChip('mic', 'Voice')}
      ${methodChip('camera', 'Photo')}
      ${methodChip('bookmark', 'Saved meals')}
    </div>
  </div>

  ${tabRow('Go-Tos')}

  <div class="px-5 pt-3 pb-1 flex items-center justify-between">
    <p class="font-body text-[13px] text-ink-soft">Your staples — tap <span class="text-clay font-medium">+</span> to log instantly</p>
  </div>
  <div class="divide-y divide-line border-t border-line">
    ${goTos.map(r => foodRow(...r)).join('')}
  </div>

  <div class="px-5 py-4">
    <button class="w-full border border-line rounded-full py-3 flex items-center justify-center gap-2 font-body text-sm font-semibold text-ink">${ico('plus', 'text-base text-clay')} Add a custom item</button>
  </div>
</div>`;

console.log(writeScreen('logrecent.html', 'Sloe · Log — Go-Tos', sheet));
