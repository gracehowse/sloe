import { writeScreen, ico } from './_gen.mjs';

/* ============================================================
   KEEP #1 · Nutrients — all-micronutrient panel (sheet).
   Reached from the Today macro tiles. Cronometer-level depth,
   Sloe-skinned. Mobbin best-of:
   - MacroFactor row: name · consumed/target · % + thin bar under
   - Lifesum grouping: macros (with sub-rows) / minerals / vitamins
   - Bevel framing: vitamins "meet or exceed" · sodium/sat "near or below"
   - calm coaching summary line (Sloe voice)
   Tokens: exact Sloe palette via _gen HEAD. Page = white sheet.
   ============================================================ */

const overline = (t, c = 'text-ink-faint') => `<span class="font-label text-[10px] uppercase tracking-[0.12em] ${c} font-semibold">${t}</span>`;

/* one nutrient row — MacroFactor pattern. opts: sub, over (amber), met (sage, vitamins ≥100), noTarget */
function row(name, consumed, target, unit, color, opts = {}) {
  const pct = target != null ? Math.round((consumed / target) * 100) : null;
  const valTxt = target != null
    ? `<span class="tabular-nums text-ink">${consumed.toLocaleString()}</span><span class="text-ink-faint"> / ${target.toLocaleString()} ${unit}</span>`
    : `<span class="tabular-nums text-ink">${consumed.toLocaleString()} ${unit}</span>`;
  const pctTxt = target != null ? `${pct}%` : '—';
  const pctColor = opts.over ? 'text-amber' : opts.met ? 'text-sage' : 'text-ink-soft';
  const barColor = opts.over ? '#C9892C' : opts.met ? '#5E7C5A' : color;
  const barW = target != null ? Math.min(100, pct) : 0;
  const nameCls = opts.sub ? 'text-ink-soft text-[13px] pl-3.5' : 'text-ink text-sm';
  return `<div class="px-1 py-3">
    <div class="flex items-baseline justify-between gap-3 mb-1.5">
      <span class="font-body ${nameCls} ${opts.sub ? '' : 'font-medium'} flex items-center gap-1.5">${opts.over ? '<span class="w-1.5 h-1.5 rounded-full bg-amber"></span>' : ''}${name}</span>
      <span class="font-body text-[13px] flex items-baseline gap-2 shrink-0">${valTxt}<span class="${pctColor} tabular-nums w-9 text-right font-medium">${pctTxt}</span></span>
    </div>
    <div class="h-1.5 bg-line rounded-full overflow-hidden">${target != null ? `<div class="h-full rounded-full" style="width:${barW}%;background:${barColor}"></div>` : ''}</div>
  </div>`;
}

function group(title, caption, rows) {
  return `<section class="mb-6">
    <div class="flex items-baseline justify-between px-1 mb-1">${overline(title)}${caption ? `<span class="font-body text-[11px] text-ink-faint">${caption}</span>` : ''}</div>
    <div class="border-t border-line divide-y divide-line">${rows.join('')}</div>
  </section>`;
}

const macros = group('Energy & macros', '', [
  row('Calories', 1420, 2040, 'kcal', '#3B2A4D'),
  row('Protein', 96, 140, 'g', '#7C8466'),
  row('Carbs', 142, 200, 'g', '#C8794E'),
  row('Fibre', 18, 30, 'g', '#4A7878', { sub: true }),
  row('Sugars', 44, null, 'g', '#9B93A3', { sub: true }),
  row('Fat', 44, 68, 'g', '#C9892C'),
  row('Saturated', 12, 20, 'g', '#C9892C', { sub: true }),
  row('Unsaturated', 28, null, 'g', '#5E7C5A', { sub: true }),
]);

const minerals = group('Minerals', 'near or below where flagged', [
  row('Sodium', 1180, 2300, 'mg', '#6A4B7A'),
  row('Potassium', 2400, 3500, 'mg', '#6A4B7A'),
  row('Calcium', 760, 1000, 'mg', '#6A4B7A'),
  row('Iron', 12, 18, 'mg', '#6A4B7A'),
  row('Magnesium', 280, 400, 'mg', '#6A4B7A'),
  row('Zinc', 8, 11, 'mg', '#6A4B7A'),
]);

const vitamins = group('Vitamins', 'meet or exceed', [
  row('Vitamin A', 640, 900, 'µg', '#6A4B7A'),
  row('Vitamin C', 62, 90, 'mg', '#6A4B7A'),
  row('Vitamin D', 8, 20, 'µg', '#6A4B7A'),
  row('Vitamin B12', 3.1, 2.4, 'µg', '#5E7C5A', { met: true }),
  row('Folate', 320, 400, 'µg', '#6A4B7A'),
]);

const sheet = `<div id="cap" class="mx-auto bg-surface rounded-t-3xl" style="width:500px;position:relative">
  <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1.5 rounded-full bg-line"></div></div>
  <header class="px-5 pt-3 pb-3 flex items-start justify-between">
    <div>
      <h1 class="font-headline text-2xl text-ink leading-tight">Nutrients</h1>
      <p class="font-body text-[13px] text-ink-soft mt-0.5">Today · Tue 3 Jun</p>
    </div>
    <button class="text-ink-soft">${ico('x', 'text-2xl')}</button>
  </header>
  <div class="px-5 pb-2">
    <div class="flex items-center gap-2 bg-frost-mist/60 border border-line rounded-xl px-3.5 py-2.5 mb-4">
      <span class="text-sage">${ico('circle-check', 'text-[16px]')}</span>
      <p class="font-body text-[13px] text-ink-soft">12 of 16 nutrients on track — vitamin D is the one to nudge.</p>
    </div>
    ${macros}${minerals}${vitamins}
    <p class="font-body text-[11px] text-ink-faint text-center pt-1 pb-6">Targets personalised from your goal and recent intake.</p>
  </div>
</div>`;

console.log(writeScreen('nutrients.html', 'Sloe · Nutrients', sheet));
