import { writeScreen, ico, appBar, tabBar } from './_gen.mjs';

/* ============================================================
   05 · Progress — TRUE SUPERSET of v1 + v2 (2026-06-03).
   Every element from BOTH, bordered-card standard (matches 01 Today).
   v1: adherence%+dots, weight chart+toggle+Log, 3 BORDERED stat cards,
       daily-cal "avg"+goal DOTS, "6 on-target days"+medal card.
   v2: digest story, weight Start/Current/Goal/Rate, adaptive Est.TDEE,
       per-macro adherence bars.
   Page = white #FFFFFF, cards = card #F6F5F2 + line border (Figma palette).
   ============================================================ */

const overline = (t,c='text-ink-faint') => `<span class="font-label text-[10px] uppercase tracking-[0.12em] ${c} font-semibold">${t}</span>`;
const wrap = (inner,active='Progress') => `<div id="cap" class="mx-auto bg-surface" style="width:500px;min-height:100vh;position:relative">${appBar()}<main class="pt-3 px-4 pb-12">${inner}</main>${tabBar(active)}</div>`;
const card = (inner) => `<section class="mb-4"><div class="bg-surface-card rounded-xl border border-line">${inner}</div></section>`;
const rangeTabs = `<div class="flex gap-1.5 mb-5">${['7d','30d','90d','All'].map((r,i)=>`<button class="flex-1 py-1.5 rounded-full font-body text-[13px] ${i===1?'bg-plum text-white':'bg-surface-card border border-line text-ink-soft'}">${r}</button>`).join('')}</div>`;

/* digest story (v2) — trend/coaching narrative (medal owns the achievement). */
function digestCard(){
  return `<section class="mb-4"><div class="bg-frost-mist/60 rounded-xl border border-line p-5">
    <div class="flex items-center gap-2 mb-2"><span class="text-clay">${ico('sparkles','text-[15px]')}</span> ${overline('This week','text-clay')}</div>
    <h3 class="font-headline text-xl text-plum mb-1.5 leading-snug">Down 0.4 kg — and steady</h3>
    <p class="font-body text-sm text-ink-soft leading-relaxed">Your protein habit is doing the work: above goal every day this week. Keep the rhythm and you'll hit 72 kg around 5 Jan.</p>
  </div></section>`;
}

/* adherence (v1 94%+up6%+dots) + per-macro bars (v2). */
function adherenceCard(){
  const days=[1,1,1,0,1,1,0];
  const m=[['Protein','#7C8466',95],['Carbs','#C8794E',88],['Fat','#C9892C',102],['Fibre','#4A7878',70]];
  return card(`<div class="p-5">
    <div class="flex items-center justify-between mb-2">${overline('Average adherence')}<span class="inline-flex items-center gap-1 font-body text-[11px] text-sage">${ico('trending-up','text-[13px]')} up 6%</span></div>
    <div class="flex items-end justify-between mb-4">
      <span class="font-headline text-4xl text-ink tabular-nums leading-none">94<span class="text-xl text-ink-soft">%</span></span>
      <div class="flex gap-1.5 mb-1.5">${days.map(d=>`<span class="w-2.5 h-2.5 rounded-full ${d?'bg-sage':'bg-line'}"></span>`).join('')}</div>
    </div>
    <div class="border-t border-line pt-4 space-y-3">${m.map(([n,c,p])=>`<div><div class="flex justify-between font-body text-[13px] mb-1.5"><span class="text-ink">${n}</span><span class="text-ink-soft tabular-nums">${p}%${p>100?' · over':''}</span></div><div class="h-1.5 bg-line rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${Math.min(100,p)}%;background:${c}"></div></div></div>`).join('')}</div>
  </div>`);
}

/* weight (v1 chart+toggle+Log) + Start/Current/Goal/Rate (v2). */
function weightCard(){
  const w=[76.0,75.8,75.9,75.5,75.3,75.4,75.0,74.8,74.9,74.6,74.5,74.4,74.3,74.2];
  const min=71.6,max=76.4,W=436,H=120;
  const pts=w.map((v,i)=>[(i/(w.length-1))*W, H-((v-min)/(max-min))*H]);
  const poly=pts.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const goalY=(H-((72.0-min)/(max-min))*H).toFixed(1);
  const last=pts[pts.length-1]; const area=`0,${H} ${poly} ${W},${H}`;
  const toggle=`<span class="inline-flex bg-frost-mist rounded-full p-0.5 font-body text-[11px]"><span class="px-2.5 py-1 rounded-full bg-white shadow-sm text-plum font-medium">Trend</span><span class="px-2.5 py-1 text-ink-soft">Scale</span></span>`;
  return card(`<div class="p-5">
    <div class="flex items-start justify-between mb-1"><div class="flex items-baseline gap-2"><span class="font-headline text-3xl text-ink tabular-nums">74.2</span><span class="font-body text-sm text-ink-soft">kg</span><span class="font-body text-xs text-sage ml-1">↓ 0.4 this week</span></div>${toggle}</div>
    <p class="font-body text-xs text-ink-faint mb-4">Goal 72.0 kg · on track for ~5 Jan</p>
    <svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:118px" preserveAspectRatio="none">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8794E" stop-opacity="0.16"/><stop offset="1" stop-color="#C8794E" stop-opacity="0"/></linearGradient></defs>
      <polygon points="${area}" fill="url(#wg)"/>
      <line x1="0" y1="${goalY}" x2="${W}" y2="${goalY}" stroke="#9B93A3" stroke-width="1.2" stroke-dasharray="5 4"/>
      <polyline points="${poly}" fill="none" stroke="#C8794E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="#C8794E" stroke="#FFFFFF" stroke-width="2"/>
    </svg>
    <div class="grid grid-cols-4 divide-x divide-line border-t border-line mt-4 pt-4">
      ${[['Start','76.0'],['Current','74.2'],['Goal','72.0'],['Rate','−0.4/wk']].map(([l,v])=>`<div class="text-center px-1"><span class="block font-label text-[9px] uppercase tracking-wide text-ink-faint mb-1">${l}</span><span class="font-headline text-[15px] text-ink tabular-nums">${v}</span></div>`).join('')}
    </div>
    <button class="w-full mt-4 border border-line rounded-full py-2.5 flex items-center justify-center gap-2 font-body text-sm font-semibold text-ink">${ico('plus','text-base text-clay')} Log weight</button>
  </div>`);
}

/* energy — 3 BORDERED stat cards (v1) + adaptive label (v2). */
function energyStats(){
  const s=[['Avg intake','1,840','',''],['Est. TDEE','2,250','Adaptive','sage'],['Deficit','−410','','sage']];
  return `<section class="mb-4"><div class="grid grid-cols-3 gap-2">${s.map(([l,v,tag,tone])=>`<div class="bg-surface-card rounded-xl border border-line p-4 text-center"><span class="block font-label text-[9px] uppercase tracking-wide text-ink-faint mb-1.5">${l}</span><span class="font-headline text-xl ${tone==='sage'?'text-sage':'text-ink'} tabular-nums">${v}</span>${tag?`<span class="block font-label text-[8px] uppercase tracking-wide text-sage mt-1">${tag}</span>`:''}</div>`).join('')}</div></section>`;
}

/* daily calories (v1) — "avg" headline + goal DOTS above bars + legend. */
function dailyCaloriesCard(){
  const days=[['M',1750],['T',1900],['W',2100],['T',1840],['F',2300],['S',1700],['S',1650]];
  const target=1840,maxV=2450;
  return card(`<div class="p-5">
    <div class="flex items-center justify-between mb-1">${overline('Daily calories')}<span class="font-body text-[11px] text-ink-faint flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-clay"></span>goal</span></div>
    <div class="flex items-baseline gap-1.5 mb-4"><span class="font-headline text-2xl text-ink tabular-nums">1,840</span><span class="font-body text-sm text-ink-soft">avg</span></div>
    <div class="flex items-end justify-between gap-2" style="height:108px">
      ${days.map(([d,v])=>{const h=Math.round(v/maxV*100);const over=v>target;return `<div class="flex-1 flex flex-col justify-end items-center" style="height:100%"><span class="w-1.5 h-1.5 rounded-full bg-clay mb-auto mt-0.5"></span><div class="w-full rounded-t-md" style="height:${h}%;background:${over?'#C9892C':'#5E7C5A'}"></div><span class="font-label text-[10px] text-ink-faint mt-1.5">${d}</span></div>`;}).join('')}
    </div>
    <div class="flex items-center gap-4 mt-3 font-body text-[11px] text-ink-faint"><span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm bg-sage"></span>On target</span><span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm bg-amber"></span>Over</span></div>
  </div>`);
}

/* "6 on-target days" + medal (v1) — the achievement card. */
function medalCard(){
  return card(`<div class="p-5 flex items-center gap-4">
    <span class="w-10 h-10 rounded-full bg-frost-mist flex items-center justify-center text-clay shrink-0">${ico('award','text-xl')}</span>
    <div><h4 class="font-headline text-lg text-ink leading-tight">6 on-target days this week</h4><p class="font-body text-sm text-ink-soft mt-0.5">Your most consistent week this month.</p></div>
  </div>`);
}

const body = `<section class="mt-2 mb-4"><h2 class="font-headline text-3xl text-plum">Progress</h2><p class="font-body text-sm text-ink-soft mt-0.5">You're trending right where you want to be.</p></section>${rangeTabs}${digestCard()}${adherenceCard()}${weightCard()}${energyStats()}${dailyCaloriesCard()}${medalCard()}`;
console.log(writeScreen('progress-full.html','Sloe · Progress', wrap(body)));
