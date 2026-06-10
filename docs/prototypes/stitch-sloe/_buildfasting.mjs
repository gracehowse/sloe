import { writeScreen, ico, arcD } from './_gen.mjs';

/* ============================================================
   KEEP #4 · Today fasting entry — the card on Today.
   Expands to the full fasting timer (already designed, 305:2).
   Mobbin anchor: Zero (ring + window + stage + End fast),
   translated OUT of Zero's dark/orange into the Sloe calm skin.
   Shown in both states: idle (no fast) + active (fasting).
   Tokens: exact Sloe palette via _gen HEAD.
   ============================================================ */

const overline = (t, c = 'text-ink-faint') => `<span class="font-label text-[10px] uppercase tracking-[0.12em] ${c} font-semibold">${t}</span>`;

/* compact elapsed ring */
function miniRing(frac, big, sub, color = '#C8794E', size = 108) {
  const c = size / 2, r = (size - 14) / 2;
  const f = Math.min(frac, 0.9999);
  return `<div class="relative shrink-0" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#EDEAF1" stroke-width="9"/>
      <path d="${arcD(c, c, r, f)}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="font-headline text-xl text-ink leading-none">${big}</span>
      <span class="font-body text-[11px] text-ink-faint mt-0.5">${sub}</span>
    </div>
  </div>`;
}

/* IDLE — no fast running */
const idle = `<div class="bg-surface-card border border-line rounded-2xl p-4 flex items-center gap-4">
  <span class="w-12 h-12 rounded-full bg-frost-mist flex items-center justify-center text-plum shrink-0">${ico('moon', 'text-[22px]')}</span>
  <div class="flex-1 min-w-0">
    <p class="font-headline text-lg text-ink leading-tight">Start a fast</p>
    <p class="font-body text-[13px] text-ink-soft mt-0.5">16:8 window · last fast 16h 04m</p>
  </div>
  <button class="bg-clay text-white font-body text-sm font-semibold rounded-full px-5 py-2.5 shrink-0">Start</button>
</div>`;

/* ACTIVE — fasting in progress */
const active = `<div class="bg-surface-card border border-line rounded-2xl p-5">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-2">${overline('Fasting', 'text-clay')}<span class="font-label text-[10px] font-semibold text-ink-soft bg-frost-mist rounded-full px-2 py-0.5">16:8</span></div>
    <span class="inline-flex items-center gap-1.5 font-body text-[11px] text-ink-soft"><span class="w-1.5 h-1.5 rounded-full bg-clay"></span>Fat burning</span>
  </div>
  <div class="flex items-center gap-5">
    ${miniRing(14.53 / 16, '14:32', 'of 16h')}
    <div class="flex-1 min-w-0">
      <p class="font-body text-sm text-ink"><span class="text-sage font-medium">1h 28m</span> to go</p>
      <div class="mt-3 space-y-1.5">
        <div class="flex justify-between font-body text-[12px]"><span class="text-ink-faint">Started</span><span class="text-ink tabular-nums">8:00 PM</span></div>
        <div class="flex justify-between font-body text-[12px]"><span class="text-ink-faint">Goal</span><span class="text-ink tabular-nums">12:00 PM</span></div>
      </div>
    </div>
  </div>
  <button class="w-full mt-4 border border-line rounded-full py-2.5 font-body text-sm font-semibold text-ink">End fast</button>
</div>`;

const stateBlock = (label, sub, card) => `<section class="mb-7">
  <div class="flex items-baseline gap-2 px-1 mb-2.5">${overline(label)}<span class="font-body text-[11px] text-ink-faint">${sub}</span></div>
  ${card}
</section>`;

const body = `<div id="cap" class="mx-auto bg-surface" style="width:500px;position:relative">
  <header class="px-5 pt-6 pb-2">
    <h1 class="font-headline text-2xl text-plum leading-tight">Fasting on Today</h1>
    <p class="font-body text-sm text-ink-soft mt-1 leading-relaxed">A quiet entry point in the Today feed. Tapping it opens the full timer (already designed) — this is just how it lives between meals.</p>
  </header>
  <main class="px-5 pt-4 pb-10">
    ${stateBlock('Idle', 'no fast running', idle)}
    ${stateBlock('Active', 'fasting in progress', active)}
  </main>
</div>`;

console.log(writeScreen('fasting-card.html', 'Sloe · Today fasting card', body));
