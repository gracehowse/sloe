import { writeScreen, ico, webTopNav } from './_gen.mjs';

/* ============================================================
   WEB variants of the three shipped iOS energy screens, in the
   Sloe design language, for capture into Figma.

   Screens:
     web-today-energy.html     — web Today TD1 stack (steps · net energy ·
                                 SEPARATE burn-breakdown card · 7-day rolling)
     web-activity-summary.html — web Activity Summary as a CENTERED DIALOG
                                 over a faintly-dimmed Today (NOT a black scrim)
     web-source-sheet.html     — web "Where this comes from" as a centered DIALOG

   Card spec (locked Sloe): FLAT #F6F5F2 slabs, radius 24, NO border, NO shadow.
   The stale today-web.html `border border-line` is intentionally NOT copied.
   IA mirrors src/app/components/BurnDetailPanel.tsx (dialog) +
   today-activity-bonus-card.tsx (net-energy card), but with the redesigned look.
   ============================================================ */

const SLAB = 'bg-surface-card rounded-[24px]'; // flat, no border, no shadow
const overline = (t, cls = 'text-ink-faint') =>
  `<span class="font-label text-[10px] uppercase tracking-[0.12em] ${cls} font-semibold">${t}</span>`;

/* Marker position derived from net state — identical logic to the mobile fix in
   _buildenergy.mjs so web ↔ mobile can never disagree with the chip. */
function markerPctForNet(net, maintenance) {
  const THRESHOLD = 60;
  if (net <= THRESHOLD && net >= -THRESHOLD) return 50;
  const span = Math.max(maintenance, 1);
  const intensity = Math.min(1, (Math.abs(net) - THRESHOLD) / span);
  if (net > THRESHOLD) return Math.round(42 - intensity * 34);
  return Math.round(58 + intensity * 34);
}

/* ---------- Steps & activity card (web) ---------- */
function stepsCard({ steps, stepGoal, active }) {
  const pct = Math.min(100, Math.round((steps / stepGoal) * 100));
  return `<section class="${SLAB} p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-headline text-xl text-plum">Steps &amp; activity</h3>
      <span class="font-body text-[13px] text-ink-faint">Today</span>
    </div>
    <div class="space-y-4">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="flex items-center gap-2.5 font-body text-[15px] text-ink">${ico('footprints', 'text-lg text-ink-soft')} Steps</span>
          <span class="font-headline text-lg text-ink tabular-nums">${steps.toLocaleString()} <span class="font-body text-sm text-ink-faint">/ ${stepGoal.toLocaleString()}</span></span>
        </div>
        <div class="h-1.5 w-full bg-line rounded-full overflow-hidden"><div class="h-full rounded-full bg-clay" style="width:${pct}%"></div></div>
      </div>
      <div class="flex items-center justify-between border-t border-line pt-4">
        <span class="flex items-center gap-2.5 font-body text-[15px] text-ink"><span style="color:#D6A24A">${ico('flame', 'text-lg')}</span> Active energy</span>
        <span class="font-headline text-lg text-ink tabular-nums">${active} <span class="font-body text-sm text-ink-faint">kcal</span></span>
      </div>
    </div>
  </section>`;
}

/* ---------- Net energy card (web) — NO burn breakdown inside (TD1 split) ---------- */
function netEnergyCard({ burned, eaten, maintenance, goalToday }) {
  const net = burned - eaten;
  const markerPct = markerPctForNet(net, maintenance);
  const state =
    net > 60 ? ['Deficit', '#5E7C5A'] : net < -60 ? ['Surplus', '#C8794E'] : ['Maintenance', '#3B2A4D'];
  const subline =
    eaten === 0
      ? `${burned.toLocaleString()} kcal burned so far · no food logged yet.`
      : net >= 0
        ? `You've burned ${Math.abs(net).toLocaleString()} more than you've eaten today.`
        : `You've eaten ${Math.abs(net).toLocaleString()} more than you've burned today.`;
  const stats = [
    ['Burned', burned.toLocaleString(), 'flame', '#D6A24A'],
    ['Eaten', eaten.toLocaleString(), 'utensils', '#6A6072'],
    ['Maintenance', maintenance.toLocaleString(), 'target', '#3B2A4D'],
  ];
  return `<section class="${SLAB} p-6 md:p-7">
    <div class="flex items-center justify-between mb-3">
      ${overline('Net energy')}
      <span class="inline-flex items-center font-label text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full text-white" style="background:${state[1]}">${state[0]}</span>
    </div>
    <div class="flex items-baseline gap-2">
      <span class="font-headline text-[56px] leading-none tabular-nums" style="color:${state[1]}">${Math.abs(net).toLocaleString()}</span>
      <span class="font-body text-sm text-ink-soft">kcal ${state[0].toLowerCase()}</span>
    </div>
    <p class="font-body text-[13px] text-ink-soft mt-2.5 mb-6">${subline}</p>

    <div class="relative h-2.5 rounded-full mb-2" style="background:linear-gradient(90deg,#5E7C5A 0%,#EDEAF1 50%,#C8794E 100%)">
      <div class="absolute top-1/2 w-5 h-5 rounded-full bg-surface" style="left:${markerPct}%;transform:translate(-50%,-50%);border:3px solid ${state[1]}"></div>
    </div>
    <div class="flex justify-between font-label text-[9px] uppercase tracking-[0.08em] text-ink-faint mb-6"><span>Deficit</span><span>Maintenance</span><span>Surplus</span></div>

    <div class="grid grid-cols-3 divide-x divide-line border-t border-line pt-5">
      ${stats
        .map(
          ([l, v, i, c]) => `<div class="px-3 text-center">
        <span class="flex items-center justify-center gap-1.5 mb-2" style="color:${c}">${ico(i, 'text-[15px]')}<span class="font-label text-[9px] uppercase tracking-[0.08em] text-ink-faint">${l}</span></span>
        <span class="font-headline text-2xl text-ink tabular-nums">${v}</span>
      </div>`,
        )
        .join('')}
    </div>

    <p class="text-center font-body text-[12px] text-ink-soft mt-5">Calorie goal today · <span class="text-ink font-medium">${goalToday.toLocaleString()} kcal</span></p>
  </section>`;
}

/* ---------- Burn breakdown card (web) — SEPARATE, tappable → Activity Summary ---------- */
function burnBreakdownCard({ burned, resting, active }) {
  return `<a href="web-activity-summary.html" class="block ${SLAB} p-6 group">
    <div class="flex items-center gap-4">
      <span class="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style="background:rgba(214,162,74,0.14);color:#D6A24A">${ico('flame', 'text-[22px]')}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2">
          <span class="font-headline text-3xl text-ink tabular-nums leading-none">${burned.toLocaleString()}</span>
          <span class="font-body text-[13px] text-ink-soft">kcal burned today</span>
        </div>
        <p class="font-body text-[12px] text-ink-faint mt-1.5">Resting ${resting.toLocaleString()} · Active ${active.toLocaleString()}</p>
      </div>
      <span class="text-ink-faint group-hover:text-ink-soft transition-colors shrink-0">${ico('chevron-right', 'text-2xl')}</span>
    </div>
  </a>`;
}

/* ---------- 7-day rolling summary (web) ---------- */
function rollingCard() {
  const rows = [
    ['Avg daily deficit', '455 kcal'],
    ['Weekly deficit', '4,729 kcal'],
    ['Projected weekly loss', '0.61 kg'],
  ];
  return `<section class="${SLAB} p-6">
    <div class="flex items-center gap-2 mb-4">${ico('trending-down', 'text-base text-sage')} ${overline('7-day rolling')}</div>
    <div class="space-y-3.5">${rows
      .map(
        ([l, v]) =>
          `<div class="flex items-center justify-between"><span class="font-body text-sm text-ink-soft">${l}</span><span class="font-headline text-base text-sage tabular-nums">${v}</span></div>`,
      )
      .join('')}</div>
  </section>`;
}

/* ============================================================
   The Today TD1 stack rendered into the web main column.
   Reused (un-dimmed) as the body, and (dimmed) behind the dialogs.
   ============================================================ */
function todayEnergyStack() {
  return `<main class="max-w-3xl mx-auto px-5 md:px-8 pt-10 pb-20">
    <div class="mb-8">
      <p class="font-body text-sm text-ink-faint">Wednesday, 3 June</p>
      <h1 class="font-headline text-4xl md:text-5xl text-plum mt-1">Activity &amp; energy</h1>
    </div>
    <div class="space-y-6">
      ${stepsCard({ steps: 538, stepGoal: 10000, active: 11 })}
      ${netEnergyCard({ burned: 492, eaten: 0, maintenance: 1289, goalToday: 1781 })}
      ${burnBreakdownCard({ burned: 492, resting: 481, active: 11 })}
      ${rollingCard()}
    </div>
  </main>`;
}

/* ---------- SCREEN 1: web-today-energy.html ---------- */
const todayBody = `${webTopNav('Today')}
${todayEnergyStack()}`;

/* ============================================================
   Dialog scaffolding: faintly-dimmed Today behind a centered card.
   Light veil rgba(34,27,38,0.22) — a calm Sloe overlay, NOT a black scrim.
   The backdrop is render-inert (pointer-events:none) so it reads as context.
   ============================================================ */
function dialogOver(dialogHtml) {
  return `${webTopNav('Today')}
<div class="relative" style="pointer-events:none">${todayEnergyStack()}</div>
<div class="fixed inset-0 z-30 flex items-start justify-center overflow-auto px-4 py-10" style="background:rgba(34,27,38,0.22);backdrop-filter:blur(2px)">
  ${dialogHtml}
</div>`;
}

/* ---------- SCREEN 2: web-activity-summary.html (centered dialog) ---------- */
function activitySummaryDialog({ burned, active, resting, steps, stepGoal, walking, maintenance, bonus }) {
  const stepPct = Math.min(100, Math.round((steps / stepGoal) * 100));
  const breakdownRow = ({ icon, bg, color, title, sub, value, suffix, bar }) =>
    `<div class="py-4 border-b border-line last:border-0">
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background:${bg};color:${color}">${ico(icon, 'text-[18px]')}</span>
        <div class="flex-1 min-w-0"><p class="font-body text-[15px] font-medium text-ink leading-tight">${title}</p><p class="font-body text-[12px] text-ink-faint mt-0.5">${sub}</p></div>
        <span class="font-headline text-xl text-ink tabular-nums shrink-0">${value}${suffix ? `<span class="font-body text-[13px] text-ink-faint">${suffix}</span>` : ''}</span>
      </div>
      ${bar ? `<div class="mt-3 ml-[52px]"><div class="h-1.5 w-full bg-line rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${bar}%;background:#3B2A4D"></div></div></div>` : ''}
    </div>`;
  const bonusEarned = bonus > 0;
  return `<div role="dialog" aria-label="Activity Summary" class="relative w-full max-w-[460px] bg-surface rounded-[28px] shadow-[0_40px_90px_-30px_rgba(34,27,38,0.45)] overflow-hidden" style="pointer-events:auto">
    <div class="flex items-center justify-between px-6 pt-6 pb-1">
      <h2 class="font-headline text-2xl text-ink leading-tight">Activity Summary</h2>
      <a href="web-today-energy.html" aria-label="Close" class="text-ink-soft hover:text-ink -mr-1">${ico('x', 'text-2xl')}</a>
    </div>
    <div class="px-6 pb-7 pt-4">
      <!-- hero burn -->
      <div class="${SLAB} px-6 pt-7 pb-6 text-center mb-6">
        <span class="inline-flex w-11 h-11 rounded-full items-center justify-center mb-3" style="background:rgba(214,162,74,0.15);color:#D6A24A">${ico('flame', 'text-[22px]')}</span>
        <div class="leading-none"><span class="font-headline text-[60px] leading-none text-ink tabular-nums">${burned.toLocaleString()}</span></div>
        <p class="font-body text-[13px] text-ink-soft mt-2.5">kcal burned · Today</p>
      </div>

      <!-- breakdown -->
      <p class="font-label text-[10px] uppercase tracking-[0.12em] text-ink-faint font-semibold mb-2 px-1">Breakdown</p>
      <div class="${SLAB} px-5 mb-6">
        ${breakdownRow({ icon: 'flame', bg: 'rgba(214,162,74,0.14)', color: '#D6A24A', title: 'Active energy', sub: 'Exercise, walking, movement above resting', value: active.toLocaleString() })}
        ${breakdownRow({ icon: 'moon', bg: 'rgba(106,96,114,0.10)', color: '#6A6072', title: 'Resting energy', sub: "Energy your body uses while minimally active", value: resting.toLocaleString() })}
        ${breakdownRow({ icon: 'footprints', bg: 'rgba(59,42,77,0.10)', color: '#3B2A4D', title: 'Steps', sub: 'Daily movement goal', value: steps.toLocaleString(), suffix: ` / ${stepGoal.toLocaleString()}`, bar: stepPct })}
        ${breakdownRow({ icon: 'route', bg: 'rgba(74,120,120,0.12)', color: '#4A7878', title: 'Walking', sub: 'Distance covered today', value: walking })}
      </div>

      <!-- bonus equation -->
      <p class="font-label text-[10px] uppercase tracking-[0.12em] text-ink-faint font-semibold mb-2 px-1">Activity bonus</p>
      <div class="${SLAB} px-5 py-5">
        <div class="flex items-center justify-between py-1.5">
          <span class="font-body text-[14px] text-ink-soft">Final burn</span>
          <span class="font-headline text-lg text-ink tabular-nums">${burned.toLocaleString()}</span>
        </div>
        <div class="flex items-center justify-between py-1.5">
          <span class="font-body text-[14px] text-ink-soft">Maintenance estimate</span>
          <span class="font-headline text-lg text-ink tabular-nums">− ${maintenance.toLocaleString()}</span>
        </div>
        <div class="flex items-center justify-between border-t border-line mt-2.5 pt-3.5">
          <span class="font-body text-[15px] font-semibold text-ink">${bonusEarned ? 'Bonus earned' : 'Bonus'}</span>
          <span class="font-headline ${bonusEarned ? 'text-[28px]' : 'text-xl'} tabular-nums leading-none" style="color:${bonusEarned ? '#D6A24A' : '#9B93A3'}">${bonusEarned ? `+${bonus} kcal` : 'No bonus earned'}</span>
        </div>
      </div>
      <p class="font-body text-[12px] text-ink-faint leading-relaxed mt-3 px-1">Burn above your maintenance estimate adds to your daily food budget.</p>
    </div>
  </div>`;
}

const activitySummaryBody = dialogOver(
  activitySummaryDialog({
    burned: 492,
    active: 11,
    resting: 481,
    steps: 538,
    stepGoal: 10000,
    walking: '0.4 km',
    maintenance: 1289,
    bonus: 0,
  }),
);

/* ---------- SCREEN 3: web-source-sheet.html (centered dialog) ---------- */
function sourceDialog() {
  const rows = [
    ['Source', 'Apple Health (active) + estimate (resting)'],
    ['Range', 'Today, so far'],
    ['Last synced', '1 min ago'],
  ];
  return `<div role="dialog" aria-label="Where this comes from" class="relative w-full max-w-[440px] bg-surface rounded-[28px] shadow-[0_40px_90px_-30px_rgba(34,27,38,0.45)] overflow-hidden self-center" style="pointer-events:auto">
    <div class="px-6 pt-6 flex items-start justify-between">
      <h2 class="font-headline text-2xl text-ink leading-tight">Where this comes from</h2>
      <a href="web-today-energy.html" aria-label="Close" class="text-ink-soft hover:text-ink -mr-1 mt-0.5">${ico('x', 'text-2xl')}</a>
    </div>
    <p class="px-6 mt-1 font-body text-[14px] text-ink-soft tabular-nums">492 kcal · Active 11 · Resting 481</p>
    <div class="px-6 mt-5">
      <div class="${SLAB} px-5 divide-y divide-line">
        ${rows
          .map(
            ([l, v]) => `<div class="flex items-start justify-between gap-4 py-4">
          <span class="font-body text-[14px] text-ink-soft shrink-0">${l}</span>
          <span class="font-body text-[14px] text-ink font-medium text-right">${v}</span>
        </div>`,
          )
          .join('')}
      </div>
    </div>
    <p class="px-6 mt-5 font-body text-[13px] text-ink-soft leading-relaxed">Active energy comes straight from Apple Health. Resting energy is estimated from your profile when Health doesn't report it — so your full burn is always accounted for. Manage this in Settings → Connections.</p>
    <div class="px-6 mt-6 mb-7">
      <button class="w-full bg-clay text-white font-body text-[15px] font-semibold rounded-full py-3.5 flex items-center justify-center gap-2">${ico('refresh-cw', 'text-[17px]')} Sync now</button>
    </div>
  </div>`;
}

const sourceBody = dialogOver(sourceDialog());

console.log(writeScreen('web-today-energy.html', 'Sloe · Today — Activity & energy (web)', todayBody, { web: true }));
console.log(writeScreen('web-activity-summary.html', 'Sloe · Activity Summary (web)', activitySummaryBody, { web: true }));
console.log(writeScreen('web-source-sheet.html', 'Sloe · Where this comes from (web)', sourceBody, { web: true }));
