import { writeScreen, ico, appBar, tabBar } from './_gen.mjs';

function rangeToggle(active){
  return `<div class="inline-flex bg-surface-card border border-line rounded-full p-1 w-full">${['7d','30d','90d','All'].map(r=>`<span class="flex-1 text-center font-label text-[13px] font-semibold py-1.5 rounded-full ${r===active?'bg-white text-plum shadow-sm':'text-ink-faint'}">${r}</span>`).join('')}</div>`;
}
function lightToggle(a,b){
  return `<div class="inline-flex bg-surface-card border border-line rounded-full p-0.5 text-[12px] font-medium"><span class="px-3 py-1 rounded-full bg-white text-plum shadow-sm">${a}</span><span class="px-3 py-1 text-ink-faint">${b}</span></div>`;
}
// crisp weight line
const pts="18,40 70,44 122,42 174,50 226,52 278,60 330,58 382,66 434,68 462,70";
// daily calorie bars: [heightFrac, over?]
const days=[['M',0.74,0],['T',0.82,0],['W',0.78,0],['T',0.88,0],['F',0.66,0],['S',0.8,0],['S',1.0,1]];
function calBars(){
  return `<div class="flex items-end gap-2" style="height:150px">${days.map(([d,h,over])=>`<div class="flex-1 flex flex-col items-center justify-end h-full gap-2">
    <div class="w-full flex items-end justify-center relative" style="height:120px">
      <span class="absolute w-1.5 h-1.5 rounded-full bg-clay" style="bottom:118px"></span>
      <div class="w-full rounded-md ${over?'bg-destructive/80':'bg-sage'}" style="height:${Math.round(h*108)}px"></div>
    </div>
    <span class="font-label text-[10px] text-ink-faint">${d}</span></div>`).join('')}</div>`;
}
function statTile(label,val,cls){return `<div class="flex-1 bg-surface-card border border-line rounded-2xl p-4 text-center"><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">${label}</p><p class="font-headline text-2xl ${cls||'text-ink'} mt-1">${val}</p></div>`;}

const body = `
${appBar()}
<main class="px-5 pt-5 pb-8 max-w-2xl mx-auto space-y-6">
  <div>
    <h1 class="font-headline text-3xl text-plum">Progress</h1>
    <p class="font-body text-sm text-ink-soft mt-0.5">You're trending right where you want to be.</p>
  </div>
  ${rangeToggle('30d')}

  <!-- Adherence hero -->
  <section class="bg-surface-card border border-line rounded-2xl p-6">
    <div class="flex items-end justify-between">
      <div><p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Average adherence</p>
        <div class="flex items-baseline gap-2 mt-1"><span class="font-headline text-5xl text-plum">94<span class="text-2xl">%</span></span><span class="inline-flex items-center gap-1 font-body text-[13px] text-sage">${ico('trending-up','text-[15px]')} up 6%</span></div></div>
      <div class="flex gap-1.5 pb-1">${[1,1,1,1,1,0,1].map(on=>`<span class="w-2.5 h-2.5 rounded-full ${on?'bg-sage':'bg-line'}"></span>`).join('')}</div>
    </div>
  </section>

  <!-- Weight -->
  <section class="bg-surface-card border border-line rounded-2xl p-6">
    <div class="flex items-start justify-between">
      <div><p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Weight</p>
        <div class="flex items-baseline gap-2 mt-1"><span class="font-headline text-3xl text-ink">74.2</span><span class="font-body text-sm text-ink-soft">kg</span>
        <span class="inline-flex items-center gap-1 font-body text-[13px] text-sage ml-1">${ico('trending-down','text-[14px]')} 0.4 this week</span></div></div>
      ${lightToggle('Trend','Scale')}
    </div>
    <svg viewBox="0 0 480 95" class="w-full mt-3" style="height:110px">
      <line x1="0" y1="84" x2="480" y2="84" stroke="#5E7C5A" stroke-dasharray="3 4"/>
      <text x="476" y="80" text-anchor="end" class="font-label" style="font-size:9px;fill:#5E7C5A">Goal 72.0 · ~5 Jan</text>
      <!-- trajectory / forecast to goal (dotted) -->
      <polyline points="462,70 480,84" fill="none" stroke="#C8794E" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round" opacity="0.55"/>
      <circle cx="480" cy="84" r="3" fill="none" stroke="#5E7C5A" stroke-width="2"/>
      <polyline points="${pts}" fill="none" stroke="#C8794E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.split(' ').map(p=>{const[x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r="2.5" fill="#C8794E"/>`}).join('')}
    </svg>
    <button class="w-full mt-3 inline-flex items-center justify-center gap-2 bg-surface border border-line text-ink font-body font-semibold text-sm rounded-full py-2.5">${ico('plus','text-[16px] text-clay')} Log weight</button>
  </section>

  <!-- Stats -->
  <div class="flex gap-3">${statTile('Avg intake','1,840')}${statTile('Est. TDEE','2,250')}${statTile('Deficit','−410','text-clay')}</div>

  <!-- Daily calories -->
  <section class="bg-surface-card border border-line rounded-2xl p-6">
    <div class="flex items-start justify-between mb-1"><div><p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Daily calories</p><p class="font-headline text-2xl text-ink mt-0.5">1,840 <span class="text-base text-ink-soft font-body">avg</span></p></div>
    <span class="inline-flex items-center gap-1.5 font-label text-[11px] text-ink-faint"><span class="w-2 h-2 rounded-full bg-clay"></span>goal</span></div>
    ${calBars()}
  </section>

  <!-- Insight -->
  <section class="bg-surface-card border border-line rounded-2xl p-5 flex items-center gap-4">
    <span class="w-11 h-11 rounded-full bg-honey/18 flex items-center justify-center text-honey flex-none">${ico('award','text-[20px]')}</span>
    <div><p class="font-headline text-[15px] text-ink leading-tight">6 on-target days this week</p><p class="font-body text-[13px] text-ink-soft">Your most consistent week this month.</p></div>
  </section>
</main>
${tabBar('Progress')}`;

console.log(writeScreen('progress.html','Sloe · Progress', body));
