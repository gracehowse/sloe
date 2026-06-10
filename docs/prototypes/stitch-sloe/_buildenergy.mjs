import { writeScreen, ico, backHeader } from './_gen.mjs';

/* ============================================================
   ENERGY BALANCE detail + "Where this comes from" sheet.
   Best-in-class ref: Bevel "Net energy" (net headline + state chip
   + deficit↔surplus bar). Sloe-skinned: flat #F6F5F2 slabs,
   radius 24, NO border, NO shadow; hairline #E8E2EC.
   State chip colours: Deficit=sage, Maintenance=ink, Surplus=clay.
   Two artifacts:
     energy-balance.html       — the card detail screen
     energy-source-sheet.html  — the source sheet over a light backdrop
   ============================================================ */

const overline = (t, c='text-ink-faint') => `<span class="font-label text-[10px] uppercase tracking-[0.12em] ${c} font-semibold">${t}</span>`;

/* small Steps + Active energy card (kept above the balance, per spec) */
function stepsActiveCard({steps, stepGoal, active}){
  const pct = Math.min(100, Math.round(steps / stepGoal * 100));
  return `<section class="mb-5">
    <div class="bg-surface-card rounded-[24px] px-5 py-5">
      <div class="flex items-center justify-between mb-2">
        <span class="flex items-center gap-2.5 font-body text-[15px] text-ink">${ico('footprints','text-lg text-ink-soft')} Steps</span>
        <span class="font-headline text-lg text-ink tabular-nums">${steps.toLocaleString()} <span class="font-body text-sm text-ink-faint">/ ${stepGoal.toLocaleString()}</span></span>
      </div>
      <div class="h-1.5 w-full bg-line rounded-full overflow-hidden"><div class="h-full rounded-full bg-clay" style="width:${pct}%"></div></div>
      <div class="flex items-center justify-between border-t border-line mt-4 pt-4">
        <span class="flex items-center gap-2.5 font-body text-[15px] text-ink"><span style="color:#D6A24A">${ico('flame','text-lg')}</span> Active energy</span>
        <span class="font-headline text-lg text-ink tabular-nums">${active} <span class="font-body text-sm text-ink-faint">kcal</span></span>
      </div>
    </div>
  </section>`;
}

/* Marker position derived from net state so it can NEVER disagree with the chip:
   DEFICIT → left third, MAINTENANCE → centre, SURPLUS → right third.
   Within each band the distance from maintenance nudges the marker further out,
   but it is clamped inside its third (deficit 8–42%, surplus 58–92%) so a clear
   deficit/surplus never reads as ambiguously mid-bar. SSOT for the shipped
   netEnergyMarkerFraction() in src/lib/nutrition/netEnergyBalance.ts. */
function markerPctForNet(net, maintenance){
  const THRESHOLD = 60;
  if (net <= THRESHOLD && net >= -THRESHOLD) return 50;            // maintenance → centre
  const span = Math.max(maintenance, 1);
  // how far past the maintenance band, 0..1 of a full maintenance-worth of kcal
  const intensity = Math.min(1, (Math.abs(net) - THRESHOLD) / span);
  if (net > THRESHOLD) return Math.round(42 - intensity * 34);     // deficit → 42%→8% (left third)
  return Math.round(58 + intensity * 34);                          // surplus → 58%→92% (right third)
}

/* NET ENERGY card — Bevel-style: net number + coloured state chip,
   deficit↔maintenance↔surplus gradient bar with marker, 3-stat row. */
function netEnergyCard({burned, eaten, maintenance}){
  const net = burned - eaten;                // 0 eaten → full deficit
  const markerPct = markerPctForNet(net, maintenance);
  const state = net > 60 ? ['Deficit', '#5E7C5A'] : net < -60 ? ['Surplus', '#C8794E'] : ['Maintenance', '#3B2A4D'];
  const stats = [
    ['Burned', burned.toLocaleString(), 'flame', '#D6A24A'],
    ['Eaten', eaten.toLocaleString(), 'utensils', '#6A6072'],
    ['Maintenance', maintenance.toLocaleString(), 'target', '#3B2A4D'],
  ];
  return `<section class="mb-5">
    <div class="bg-surface-card rounded-[24px] px-5 py-6">
      <div class="flex items-center justify-between mb-2">
        ${overline('Net energy')}
        <span class="inline-flex items-center font-label text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full text-white" style="background:${state[1]}">${state[0]}</span>
      </div>
      <div class="flex items-baseline gap-2">
        <span class="font-headline text-[52px] leading-none tabular-nums" style="color:${state[1]}">${net.toLocaleString()}</span>
        <span class="font-body text-sm text-ink-soft">kcal ${state[0].toLowerCase()}</span>
      </div>
      <p class="font-body text-[13px] text-ink-faint mt-2 mb-6">${burned.toLocaleString()} kcal burned so far · no food logged yet.</p>

      <div class="relative h-2.5 rounded-full mb-2" style="background:linear-gradient(90deg,#5E7C5A 0%,#EDEAF1 50%,#C8794E 100%)">
        <div class="absolute top-1/2 w-5 h-5 rounded-full bg-surface" style="left:${markerPct}%;transform:translate(-50%,-50%);border:3px solid ${state[1]}"></div>
      </div>
      <div class="flex justify-between font-label text-[9px] uppercase tracking-[0.08em] text-ink-faint mb-6"><span>Deficit</span><span>Maintenance</span><span>Surplus</span></div>

      <div class="grid grid-cols-3 divide-x divide-line border-t border-line pt-5">
        ${stats.map(([l,v,i,c])=>`<div class="px-2 text-center">
          <span class="flex items-center justify-center gap-1.5 mb-2" style="color:${c}">${ico(i,'text-[15px]')}<span class="font-label text-[9px] uppercase tracking-[0.08em] text-ink-faint">${l}</span></span>
          <span class="font-headline text-xl text-ink tabular-nums">${v}</span>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

/* THE SOURCE SHEET body — drag handle, title + close X, sub-headline,
   grouped rows card, caption, full-width CLAY primary "Sync now". */
function sourceSheetInner(){
  const rows = [
    ['Source', 'Apple Health (active) + estimate (resting)'],
    ['Range', 'Yesterday, full day'],
    ['Last synced', '1 min ago'],
  ];
  return `<div class="bg-surface rounded-t-[28px] pb-8">
    <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1.5 rounded-full bg-line"></div></div>
    <div class="px-6 pt-3 flex items-start justify-between">
      <h2 class="font-headline text-2xl text-ink leading-tight">Where this comes from</h2>
      <button class="text-ink-soft -mr-1 mt-0.5">${ico('x','text-2xl')}</button>
    </div>
    <p class="px-6 mt-1 font-body text-[14px] text-ink-soft tabular-nums">492 kcal · Active 11 · Resting 481</p>
    <div class="px-6 mt-5">
      <div class="bg-surface-card rounded-[24px] px-5 divide-y divide-line">
        ${rows.map(([l,v])=>`<div class="flex items-start justify-between gap-4 py-4">
          <span class="font-body text-[14px] text-ink-soft shrink-0">${l}</span>
          <span class="font-body text-[14px] text-ink font-medium text-right">${v}</span>
        </div>`).join('')}
      </div>
    </div>
    <p class="px-6 mt-5 font-body text-[13px] text-ink-soft leading-relaxed">Active energy comes straight from Apple Health. Resting energy is estimated from your profile when Health doesn't report it — so your full burn is always accounted for.</p>
    <div class="px-6 mt-6">
      <button class="w-full bg-clay text-white font-body text-[15px] font-semibold rounded-full py-3.5 flex items-center justify-center gap-2">${ico('refresh-cw','text-[17px]')} Sync now</button>
    </div>
  </div>`;
}

/* ---------------- WRITE: energy-balance detail ---------------- */
const balanceBody = `<div id="cap" class="mx-auto bg-surface" style="width:500px;position:relative">
  ${backHeader('Energy balance', ico('ellipsis'))}
  <main class="px-5 pt-5 pb-12">
    ${stepsActiveCard({steps:538, stepGoal:10000, active:11})}
    ${netEnergyCard({burned:492, eaten:0, maintenance:1289})}
  </main>
</div>`;
/* Note (2026-06-05): the redundant bottom "A deficit means…" info caption was
   removed — the state chip + the net subline already carry that meaning; per the
   "keep the state chip + ONE coach line" trim. */

/* ---------------- WRITE: source sheet over a LIGHT backdrop ---------------- */
/* Not a heavy dark scrim — a clean, faintly-dimmed light backdrop so the
   sheet reads as a calm Sloe surface sitting over the balance screen. */
const sheetBody = `<div id="cap" class="mx-auto relative overflow-hidden bg-surface" style="width:500px;height:880px">
  <!-- faint backdrop preview of the balance screen behind the sheet -->
  <div class="absolute inset-0">
    ${backHeader('Energy balance', ico('ellipsis'))}
    <div class="px-5 pt-5">
      ${stepsActiveCard({steps:538, stepGoal:10000, active:11})}
      ${netEnergyCard({burned:492, eaten:0, maintenance:1289})}
    </div>
  </div>
  <!-- light dim veil (not a black scrim) -->
  <div class="absolute inset-0" style="background:rgba(34,27,38,0.22)"></div>
  <!-- the sheet, anchored to the bottom -->
  <div class="absolute inset-x-0 bottom-0">${sourceSheetInner()}</div>
</div>`;

console.log(writeScreen('energy-balance.html', 'Sloe · Energy balance', balanceBody));
console.log(writeScreen('energy-source-sheet.html', 'Sloe · Where this comes from', sheetBody));
