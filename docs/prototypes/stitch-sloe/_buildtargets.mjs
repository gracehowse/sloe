import { writeScreen, ico, backHeader } from './_gen.mjs';

/* ============================================================
   KEEP #3 · Targets — "why this number" explainer (/targets).
   Mobbin best-of: Alma warm numbered steps + MacroFactor
   adaptive-expenditure timeline + MFP equation breakdown.
   The trust move: every target is explained, and it adapts.
   Tokens: exact Sloe palette via _gen HEAD. No fire emoji (DS).
   ============================================================ */

const overline = (t, c = 'text-ink-faint') => `<span class="font-label text-[10px] uppercase tracking-[0.12em] ${c} font-semibold">${t}</span>`;

const hero = `<section class="px-5 pt-5 pb-3">
  ${overline('Daily target')}
  <h2 class="font-headline text-[44px] leading-none text-plum mt-1.5">1,840<span class="font-body text-xl text-ink-soft"> kcal</span></h2>
  <p class="font-body text-sm text-ink-soft mt-2 leading-relaxed">Set for losing about 0.4 kg a week — steady, and sustainable.</p>
</section>`;

/* equation card — maintenance − goal = target (MFP/MacroFactor) */
const equation = `<section class="px-5 mb-5">
  <div class="bg-surface-card border border-line rounded-xl p-5">
    <div class="flex items-center justify-between py-1">
      <div><p class="font-body text-sm text-ink font-medium">Maintenance energy</p><p class="font-body text-[12px] text-ink-faint">what your body burns on an average day</p></div>
      <span class="font-headline text-lg text-ink tabular-nums shrink-0">2,250</span>
    </div>
    <div class="flex items-center justify-between py-1 mt-1">
      <div><p class="font-body text-sm text-ink font-medium">For your goal</p><p class="font-body text-[12px] text-ink-faint">a gentle deficit to lose 0.4 kg / week</p></div>
      <span class="font-headline text-lg text-clay tabular-nums shrink-0">−410</span>
    </div>
    <div class="flex items-center justify-between border-t border-line mt-3 pt-3.5">
      <p class="font-body text-[15px] text-ink font-semibold">Daily target</p>
      <span class="font-headline text-2xl text-plum tabular-nums shrink-0">1,840</span>
    </div>
  </div>
</section>`;

/* connected timeline — Alma steps + MacroFactor adaptive promise */
function step(n, title, body, last = false) {
  return `<div class="flex gap-3.5">
    <div class="flex flex-col items-center shrink-0">
      <span class="w-7 h-7 rounded-full bg-plum text-white flex items-center justify-center font-headline text-sm">${n}</span>
      ${last ? '' : '<span class="w-px flex-1 bg-line my-1.5"></span>'}
    </div>
    <div class="${last ? 'pb-1' : 'pb-6'}">
      <h4 class="font-body text-[15px] font-semibold text-ink">${title}</h4>
      <p class="font-body text-[13px] text-ink-soft leading-relaxed mt-1">${body}</p>
    </div>
  </div>`;
}
const steps = `<section class="px-5 mb-5">
  <h3 class="font-headline text-xl text-plum mb-4">How we got to this number</h3>
  ${step(1, 'We learned what you burn', 'From your stats and 28 days of logs, your body burns about <span class="text-ink font-medium">2,250 kcal</span> on an average day. This number adapts each week as your weight and logging change — it\'s measured, not guessed.')}
  ${step(2, 'We applied your goal', 'You\'re aiming to lose 0.4 kg a week, so we set a <span class="text-ink font-medium">410 kcal</span> daily deficit — enough to make real progress without leaving you hungry or run-down.')}
  ${step(3, 'We split your macros', 'Protein is set high to protect muscle while you lose. The rest balances carbs for training energy and fat for fullness.', true)}
</section>`;

/* macro split card with rationale */
function macroRow(name, color, grams, pct, why) {
  return `<div class="py-3.5">
    <div class="flex items-baseline justify-between mb-2">
      <span class="font-body text-sm font-medium text-ink flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background:${color}"></span>${name}</span>
      <span class="font-body text-[13px] text-ink-soft"><span class="font-headline text-base text-ink tabular-nums">${grams}</span> g · ${pct} of calories</span>
    </div>
    <div class="h-1.5 bg-line rounded-full overflow-hidden mb-2"><div class="h-full rounded-full" style="width:${pct};background:${color}"></div></div>
    <p class="font-body text-[12px] text-ink-faint leading-relaxed">${why}</p>
  </div>`;
}
const macros = `<section class="px-5 mb-5">
  <div class="flex items-baseline justify-between px-1 mb-2">${overline('Your macro split')}<span class="font-body text-[11px] text-ink-faint">grams per day</span></div>
  <div class="bg-surface-card border border-line rounded-xl px-4 divide-y divide-line">
    ${macroRow('Protein', '#7C8466', 140, '30%', 'Set high to protect muscle while you\'re in a deficit.')}
    ${macroRow('Carbs', '#C8794E', 200, '44%', 'Your main fuel for training and day-to-day energy.')}
    ${macroRow('Fat', '#C9892C', 68, '26%', 'Keeps you full and supports your hormones.')}
  </div>
</section>`;

const footer = `<section class="px-5">
  <div class="flex items-center gap-2.5 bg-frost-mist/60 border border-line rounded-xl px-4 py-3 mb-4">
    <span class="text-plum shrink-0">${ico('refresh-cw', 'text-[16px]')}</span>
    <p class="font-body text-[13px] text-ink-soft leading-relaxed">Recalculates every week from your weight trend and what you log. You\'re always on a current number.</p>
  </div>
  <div class="flex gap-2.5">
    <button class="flex-1 border border-line rounded-full py-3 font-body text-sm font-semibold text-ink">Change goal</button>
    <button class="flex-1 border border-line rounded-full py-3 font-body text-sm font-semibold text-ink">Set manually</button>
  </div>
</section>`;

const body = `<div id="cap" class="mx-auto bg-surface" style="width:500px;position:relative">
  ${backHeader('Your targets')}
  <main class="pb-10">${hero}${equation}${steps}${macros}${footer}</main>
</div>`;

console.log(writeScreen('targets.html', 'Sloe · Targets', body));
