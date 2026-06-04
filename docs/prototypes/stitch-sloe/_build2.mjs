import { writeScreen, ico, backHeader, arcD } from './_gen.mjs';

/* ---------------- FASTING ---------------- */
const R=104, prog=0.62;
const fasting = `
${backHeader('Fasting', ico('ellipsis'))}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-7">
  <div class="flex justify-center gap-2">
    ${['16:8','18:6','OMAD'].map((p,i)=>`<span class="font-label text-[13px] font-semibold px-4 py-2 rounded-full ${i===0?'bg-plum text-white':'bg-surface-card border border-line text-ink-soft'}">${p}</span>`).join('')}
  </div>
  <section class="flex flex-col items-center">
    <div class="relative" style="width:248px;height:248px">
      <svg width="248" height="248" viewBox="0 0 248 248">
        <circle cx="124" cy="124" r="${R}" fill="none" stroke="#EDEAF1" stroke-width="14"/>
        <path d="${arcD(124,124,R,prog)}" fill="none" stroke="#C8794E" stroke-width="14" stroke-linecap="round"/>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="inline-flex items-center gap-1.5 bg-clay/12 text-clay font-label text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full mb-2">${ico('flame','text-[14px]')} Fat burning</span>
        <span class="font-headline text-5xl text-ink leading-none">9:54</span>
        <span class="font-body text-[13px] text-ink-faint mt-1">elapsed · 6:06 left</span>
      </div>
    </div>
  </section>
  <section class="bg-surface-card border border-line rounded-2xl p-5">
    <p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-4">Fasting stages</p>
    <div class="relative h-1.5 rounded-full bg-line mb-1"><div class="absolute left-0 top-0 h-1.5 rounded-full bg-clay" style="width:62%"></div>${[0,33,66,100].map(p=>`<span class="absolute -top-0.5 w-2.5 h-2.5 rounded-full ${p<=62?'bg-clay':'bg-line'} border-2 border-surface-card" style="left:calc(${p}% - 5px)"></span>`).join('')}<span class="absolute -top-1 w-4 h-4 rounded-full bg-clay border-2 border-surface-card shadow-sm" style="left:calc(62% - 8px)"></span></div>
    <div class="flex justify-between font-label text-[10px] text-ink-faint mt-2">${['Fed','Fat burning','Ketosis','Deep'].map((s,i)=>`<span class="${i===1?'text-clay font-semibold':''}">${s}</span>`).join('')}</div>
  </section>
  <section class="bg-surface-card border border-line rounded-2xl p-5 flex">
    <div class="flex-1 text-center"><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">Started</p><p class="font-headline text-lg text-ink mt-1">10:00 PM</p><button class="font-body text-xs text-clay mt-0.5">Edit</button></div>
    <div class="w-px bg-line"></div>
    <div class="flex-1 text-center"><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">Goal</p><p class="font-headline text-lg text-ink mt-1">2:00 PM</p><button class="font-body text-xs text-clay mt-0.5">Edit</button></div>
  </section>
  <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">End fast</button>
  <p class="font-headline italic text-base text-ink text-center px-6">"You're in the fat-burning window — a good time to keep things light."</p>
</main>`;

/* ---------------- COOK MODE ---------------- */
const cook = `
<header class="w-full bg-surface flex items-center justify-between px-4 h-16 border-b border-line">
  <button class="p-1 text-ink">${ico('x','text-2xl')}</button>
  <div class="text-center"><p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Step 2 of 6</p><p class="font-headline text-base text-plum leading-tight">Three Cheese Fusilli</p></div>
  <button class="p-1 text-ink-soft">${ico('timer','text-2xl')}</button>
</header>
<main class="pb-10 max-w-2xl mx-auto">
  <div class="w-full aspect-[16/10] bg-surface-card overflow-hidden relative">
    <img src="img/babbc6edccce.png" class="w-full h-full object-cover"/>
    <!-- active timer chip overlaid on the step image (running in background) -->
    <div class="absolute top-3 left-3 inline-flex items-center gap-2 bg-black/55 backdrop-blur text-white rounded-full pl-3 pr-1.5 py-1.5">
      <span class="font-label text-[10px] uppercase tracking-wide text-white/70">Pasta</span>
      <span class="font-headline text-[15px] tabular-nums">8:24</span>
      <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">${ico('pause','text-[12px]')}</span>
    </div>
  </div>
  <div class="px-6 pt-6">
    <div class="flex items-start gap-4">
      <span class="font-headline text-5xl text-clay leading-none">2</span>
      <p class="font-headline text-2xl text-ink leading-snug pt-1">Prepare the cheeses</p>
    </div>
    <p class="font-body text-[17px] text-ink-soft leading-relaxed mt-4">While the pasta boils, finely grate the three cheeses. Crush the pink peppercorns lightly with the back of a knife or in a mortar and pestle.</p>
    <!-- ingredients for this step -->
    <p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint mt-6 mb-2">For this step</p>
    <div class="flex gap-2 flex-wrap">
      <span class="inline-flex items-center gap-2 bg-surface-card border border-line rounded-full pl-1.5 pr-3.5 py-1.5"><span class="w-7 h-7 rounded-full overflow-hidden bg-surface flex-none"><img src="img/ing-parmesan.png" class="w-full h-full object-contain mix-blend-multiply"/></span><span class="font-body text-[13px] text-ink">Parmesan · 80g</span></span>
      <span class="inline-flex items-center gap-1.5 bg-surface-card border border-line rounded-full px-3.5 py-2"><span class="font-body text-[13px] text-ink">Gruyère · 60g</span></span>
      <span class="inline-flex items-center gap-1.5 bg-surface-card border border-line rounded-full px-3.5 py-2"><span class="font-body text-[13px] text-ink">Pink peppercorns</span></span>
    </div>
    <button class="mt-6 inline-flex items-center gap-2 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full px-5 py-3">${ico('timer','text-[18px] text-clay')} Start a timer for this step · 9:00</button>
  </div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface border-t border-line px-5 py-4">
  <div class="flex items-center gap-1.5 mb-3">${[1,1,0,0,0,0].map((on,i)=>`<div class="flex-1 h-1.5 rounded-full ${i===1?'bg-clay':on?'bg-clay/40':'bg-line'}"></div>`).join('')}</div>
  <div class="flex gap-3">
    <button class="flex-1 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3.5 flex items-center justify-center gap-2">${ico('chevron-left','text-[18px]')} Back</button>
    <button class="flex-[2] bg-clay text-white font-body font-semibold text-sm rounded-full py-3.5 flex items-center justify-center gap-2">Next step ${ico('chevron-right','text-[18px]')}</button>
  </div>
</div>`;

/* ---------------- WEEKLY RECAP ---------------- */
function rstat(big, label, cls){return `<div class="bg-surface-card border border-line rounded-2xl p-4"><p class="font-headline text-3xl ${cls||'text-ink'}">${big}</p><p class="font-body text-[13px] text-ink-soft mt-1">${label}</p></div>`;}
const recap = `
${backHeader('Your week', ico('share-2'))}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-7">
  <div class="text-center">
    <p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">20 – 26 October</p>
    <h1 class="font-headline text-3xl text-plum mt-1">A strong week, Grace</h1>
  </div>
  <section class="bg-plum rounded-2xl p-7 text-center text-white">
    <p class="font-label text-[11px] uppercase tracking-[0.1em] text-white/70">On-target days</p>
    <p class="font-headline text-6xl mt-1">6<span class="text-2xl text-white/70">/7</span></p>
    <p class="font-body text-sm text-white/80 mt-2">Your best week this month — only Saturday ran over.</p>
  </section>
  <div class="grid grid-cols-2 gap-3">
    ${rstat('1,940','avg kcal / day')}
    ${rstat('5 / 7','protein goal hit','text-macro-protein')}
    ${rstat('−0.4 kg','weight this week','text-sage')}
    ${rstat('7','meals cooked','text-clay')}
  </div>
  <section class="bg-surface-card border border-line rounded-2xl p-5 flex items-center gap-4">
    <span class="w-11 h-11 rounded-full bg-honey/18 flex items-center justify-center text-honey flex-none">${ico('award','text-[20px]')}</span>
    <div><p class="font-headline text-[15px] text-ink leading-tight">Best day: Thursday</p><p class="font-body text-[13px] text-ink-soft">Bang on target with 132 g protein.</p></div>
  </section>
  <p class="font-headline italic text-base text-ink text-center px-6">"Consistency like this is exactly what reaches the goal — keep going."</p>
  <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4 flex items-center justify-center gap-2">${ico('share-2','text-[18px]')} Share my week</button>
</main>`;

console.log(writeScreen('fasting.html','Sloe · Fasting', fasting));
console.log(writeScreen('cook.html','Sloe · Cook mode', cook));
console.log(writeScreen('weekly-recap.html','Sloe · Weekly recap', recap));
