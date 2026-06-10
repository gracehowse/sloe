import { writeScreen, ico, backHeader } from './_gen.mjs';

/* ============================================================
   ACTIVITY SUMMARY (the burn-detail screen).
   Best-in-class refs: Apple Fitness (hero + icon'd stat rows),
   Fitbit (calm coaching), MacroFactor (clean equation summary).
   Two variants written:
     burn-detail.html        — burn ≤ maintenance, "No bonus earned"
     burn-detail-bonus.html  — burn > maintenance, "+N kcal bonus"
   Sloe locked Today card treatment: flat #F6F5F2 slabs, radius 24,
   NO border, NO shadow. Hairline = #E8E2EC. Burn/active = honey.
   ============================================================ */

/* HERO — final burn as a large serif number with a flame glyph + caption,
   over a calm honey-tinted slab with a slim baseline progress feel. */
function burnHero(burn, caption){
  return `<section class="bg-surface-card rounded-[24px] px-6 pt-7 pb-6 text-center">
    <span class="inline-flex w-11 h-11 rounded-full bg-honey/15 items-center justify-center mb-3" style="color:#D6A24A">${ico('flame','text-[22px]')}</span>
    <div class="flex items-baseline justify-center gap-2 leading-none">
      <span class="font-headline text-[64px] leading-none text-ink tabular-nums">${burn.toLocaleString()}</span>
    </div>
    <p class="font-body text-[13px] text-ink-soft mt-2.5">kcal burned · ${caption}</p>
  </section>`;
}

/* ICON'D STAT ROW — leading tinted circle + label + grey descriptor + right value.
   opts.bar = optional {pct, goal, color} thin progress under the row. */
function statRow(icon, color, tint, title, sub, val, opts={}){
  const bar = opts.bar
    ? `<div class="mt-3 ml-[52px]"><div class="h-1.5 w-full bg-line rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${opts.bar.pct}%;background:${opts.bar.color}"></div></div></div>`
    : '';
  return `<div class="py-4 border-b border-line last:border-0">
    <div class="flex items-center gap-3">
      <span class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background:${tint};color:${color}">${ico(icon,'text-[18px]')}</span>
      <div class="flex-1 min-w-0"><p class="font-body text-[15px] font-medium text-ink leading-tight">${title}</p>${sub?`<p class="font-body text-[12px] text-ink-faint mt-0.5">${sub}</p>`:''}</div>
      <span class="font-headline text-xl text-ink tabular-nums shrink-0">${val}${opts.bar?.goal?`<span class="font-body text-[13px] text-ink-faint"> / ${opts.bar.goal}</span>`:''}</span>
    </div>${bar}
  </div>`;
}

function statList(rows){
  return `<section class="mb-7">
    <h2 class="font-label text-[10px] uppercase tracking-[0.12em] text-ink-faint font-semibold mb-2 px-1">Breakdown</h2>
    <div class="bg-surface-card rounded-[24px] px-5">${rows}</div>
  </section>`;
}

/* BONUS — MacroFactor-style equation summary. earned=false → calm muted
   "No bonus earned"; earned=true → honey "+N kcal bonus". */
function bonusEquation(burn, maint, earned){
  const bonus = burn - maint;
  const resultLabel = earned ? `+${bonus.toLocaleString()} kcal` : 'No bonus earned';
  const resultColor = earned ? '#D6A24A' : '#9B93A3';
  const resultSerif = earned ? 'text-[28px]' : 'text-xl';
  return `<section class="mb-7">
    <h2 class="font-label text-[10px] uppercase tracking-[0.12em] text-ink-faint font-semibold mb-2 px-1">Activity bonus</h2>
    <div class="bg-surface-card rounded-[24px] px-5 py-5">
      <div class="flex items-center justify-between py-1.5">
        <span class="font-body text-[14px] text-ink-soft">Final burn</span>
        <span class="font-headline text-lg text-ink tabular-nums">${burn.toLocaleString()}</span>
      </div>
      <div class="flex items-center justify-between py-1.5">
        <span class="font-body text-[14px] text-ink-soft">Maintenance estimate</span>
        <span class="font-headline text-lg text-ink tabular-nums">− ${maint.toLocaleString()}</span>
      </div>
      <div class="flex items-center justify-between border-t border-line mt-2.5 pt-3.5">
        <span class="font-body text-[15px] font-semibold text-ink">${earned?'Bonus earned':'Bonus'}</span>
        <span class="font-headline ${resultSerif} tabular-nums leading-none" style="color:${resultColor}">${resultLabel}</span>
      </div>
    </div>
    <p class="font-body text-[12px] text-ink-faint leading-relaxed mt-3 px-1">Burn above your maintenance estimate adds to your daily food budget.</p>
  </section>`;
}

function activitySummary({burn, maint, active, resting, steps, earned}){
  const caption = 'Yesterday';
  return `<div id="cap" class="mx-auto bg-surface" style="width:500px;position:relative">
${backHeader('Activity Summary', ico('ellipsis'))}
<main class="px-5 pt-5 pb-12">
  <div class="mb-7">${burnHero(burn, caption)}</div>
  ${statList(`
    ${statRow('flame','#D6A24A','rgba(214,162,74,0.14)','Active energy','Exercise, walking, movement above resting', active.toLocaleString())}
    ${statRow('moon','#6A6072','rgba(106,96,114,0.10)','Resting energy','Energy your body uses while minimally active', resting.toLocaleString())}
    ${statRow('footprints','#6A6072','rgba(106,96,114,0.10)','Steps','Daily movement goal', steps.toLocaleString(), {bar:{pct:Math.min(100,Math.round(steps/10000*100)),goal:'10,000',color:'#3B2A4D'}})}
  `)}
  ${bonusEquation(burn, maint, earned)}
</main>
</div>`;
}

const burn = activitySummary({ burn:492, maint:1289, active:11, resting:481, steps:538, earned:false });
const burnBonus = activitySummary({ burn:1437, maint:1289, active:159, resting:481, steps:9240, earned:true });

/* ---------------- MEAL NUTRITION ---------------- */
function nutri(label, val, indent){
  return `<div class="flex items-center justify-between py-2.5 ${indent?'pl-4':''} border-b border-line last:border-0">
    <span class="font-body text-sm ${indent?'text-ink-soft':'text-ink font-medium'}">${label}</span>
    <span class="font-body text-sm ${indent?'text-ink-soft':'text-ink font-semibold'}">${val}</span></div>`;
}
function macroChip(name, val, colorCls){
  return `<div class="flex-1 bg-surface-card border border-line rounded-xl py-3 text-center">
    <p class="font-headline text-2xl ${colorCls}">${val}</p><p class="font-label text-[11px] uppercase tracking-[0.06em] text-ink-faint mt-0.5">${name}</p></div>`;
}
const meal = `
${backHeader('Chicken Grain Bowl', ico('ellipsis'))}
<main class="pb-10 max-w-2xl mx-auto">
  <div class="w-full aspect-[16/10] bg-surface-card overflow-hidden"><img src="img/a6610a1bee6c.png" class="w-full h-full object-cover"/></div>
  <div class="px-5 pt-5 space-y-7">
    <div class="flex items-center justify-between">
      <div><p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Lunch · 1 serving</p><p class="font-headline text-2xl text-ink">580 <span class="text-lg text-ink-soft font-body">kcal</span></p></div>
      <span class="inline-flex items-center gap-1.5 bg-frost-mist text-sage font-label text-xs font-semibold px-2.5 py-1 rounded-full">${ico('circle-check','text-[14px]')} Fits your day</span>
    </div>
    <div class="flex gap-3">
      ${macroChip('Protein','38g','text-macro-protein')}
      ${macroChip('Carbs','52g','text-macro-carbs')}
      ${macroChip('Fat','18g','text-macro-fat')}
    </div>
    <section>
      <h2 class="font-headline text-lg text-ink mb-1">Nutrition</h2>
      <div>
        ${nutri('Protein','38 g')}
        ${nutri('Carbohydrate','52 g')}
        ${nutri('Fibre','9 g',true)}
        ${nutri('Sugars','6 g',true)}
        ${nutri('Fat','18 g')}
        ${nutri('Saturated','4 g',true)}
        ${nutri('Unsaturated','13 g',true)}
        ${nutri('Sodium','480 mg')}
        ${nutri('Potassium','720 mg')}
      </div>
    </section>
    <div class="flex gap-3 pt-1">
      <button class="flex-1 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3 flex items-center justify-center gap-2">${ico('pencil','text-[16px]')} Edit</button>
      <button class="flex-1 text-destructive font-body font-semibold text-sm rounded-full py-3 flex items-center justify-center gap-2">${ico('trash-2','text-[16px]')} Remove</button>
    </div>
  </div>
</main>`;

/* ---------------- PROGRESS METRIC (Weight) ---------------- */
function rangeToggle(active){
  return `<div class="inline-flex bg-surface-card border border-line rounded-full p-1 w-full">${['7d','30d','90d','All'].map(r=>`<span class="flex-1 text-center font-label text-[13px] font-semibold py-1.5 rounded-full ${r===active?'bg-surface text-ink shadow-sm':'text-ink-faint'}">${r}</span>`).join('')}</div>`;
}
function stat(label,val,cls){return `<div class="flex-1"><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">${label}</p><p class="font-headline text-xl ${cls||'text-ink'} mt-1">${val}</p></div>`;}
// simple line chart polyline
const pts="20,70 75,64 130,66 185,52 240,55 295,44 350,46 405,38 460,40";
const metric = `
${backHeader('Weight', ico('plus','text-2xl'))}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-7">
  ${rangeToggle('30d')}
  <section class="bg-surface-card border border-line rounded-2xl p-6">
    <div class="flex items-end justify-between">
      <div><div class="flex items-baseline gap-2"><span class="font-headline text-5xl text-ink">74.2</span><span class="font-body text-lg text-ink-soft">kg</span></div>
      <p class="inline-flex items-center gap-1 font-body text-[13px] text-sage mt-1">${ico('trending-down','text-[15px]')} 0.4 kg this week</p></div>
      <span class="font-body text-[13px] text-ink-faint">Goal 72.0</span>
    </div>
    <svg viewBox="0 0 480 100" class="w-full mt-4" style="height:120px">
      <line x1="0" y1="86" x2="480" y2="86" stroke="#E8E2EC" stroke-dasharray="3 4"/>
      <polyline points="${pts}" fill="none" stroke="#C8794E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.split(' ').map(p=>{const[x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r="2.5" fill="#C8794E"/>`}).join('')}
    </svg>
  </section>
  <section class="flex gap-2">
    ${stat('Start','76.0 kg')}${stat('Current','74.2 kg')}${stat('Goal','72.0 kg')}${stat('Rate','−0.4/wk','text-sage')}
  </section>
  <section>
    <h2 class="font-headline text-xl text-ink mb-1">Recent entries</h2>
    <div>
      ${['Today · 74.2 kg','Sun · 74.4 kg','Fri · 74.6 kg','Wed · 74.5 kg'].map(e=>{const[d,v]=e.split(' · ');return `<div class="flex items-center justify-between py-3 border-b border-line last:border-0"><span class="font-body text-sm text-ink-soft">${d}</span><span class="font-body text-sm font-semibold text-ink">${v}</span></div>`}).join('')}
    </div>
  </section>
</main>`;

console.log(writeScreen('burn-detail.html','Sloe · Activity Summary', burn));
console.log(writeScreen('burn-detail-bonus.html','Sloe · Activity Summary (bonus)', burnBonus));
console.log(writeScreen('meal-nutrition.html','Sloe · Meal nutrition', meal));
console.log(writeScreen('progress-metric.html','Sloe · Weight', metric));
