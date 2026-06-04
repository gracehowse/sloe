import { writeScreen, ico, webTopNav, multiRing } from './_gen.mjs';

// Sloe Today standard: concentric multi-ring (calories + protein/carbs/fat) + macro tiles.
const ringHtml = multiRing(1420, 2040, [
  { value: 96, of: 140, color: '#7C8466' },  // protein (sage)
  { value: 142, of: 200, color: '#C8794E' }, // carbs (clay)
  { value: 44, of: 68, color: '#C9892C' },   // fat (amber)
], '#EDEAF1', 220, '#3B2A4D');

function macroTile(name, val, target, icon, col){
  return `<div class="bg-surface-card border border-line rounded-2xl p-4"><div class="flex items-center justify-between"><span class="font-label text-[12px] uppercase tracking-wide text-ink-soft">${name}</span><span class="${col}">${ico(icon,'text-[18px]')}</span></div><div class="flex items-baseline gap-1 mt-2"><span class="font-headline text-2xl text-ink">${val}</span><span class="font-body text-[13px] text-ink-soft">g</span>${target?`<span class="font-body text-[12px] text-ink-faint ml-0.5">/ ${target}g</span>`:''}</div></div>`;
}
function macrosGrid(cls){
  return `<div class="${cls}">
  ${macroTile('Protein','96','140','dumbbell','text-macro-protein')}${macroTile('Carbs','142','200','wheat','text-macro-carbs')}${macroTile('Fat','44','68','droplet','text-macro-fat')}${macroTile('Fibre','18','30','sprout','text-macro-fiber')}
</div>`;
}

const statCells = `<div class="flex md:gap-2">${[['Goal','2,040','text-ink'],['Eaten','620','text-ink'],['Bonus','+120','text-sage']].map(([l,v,c])=>`<div class="flex-1 text-center md:text-left"><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">${l}</p><p class="font-headline text-2xl ${c} mt-1">${v}</p></div>`).join('')}</div>`;

/* Energy hero — vertical on mobile, HORIZONTAL (ring beside stats) on md+ */
const energyCard = `
<section class="bg-surface-card border border-line rounded-3xl p-6 md:p-8">
  <div class="flex flex-wrap gap-2 justify-between items-center mb-4">
    <span class="inline-flex items-center gap-1.5 bg-frost-mist text-sage font-label text-xs font-semibold px-2.5 py-1 rounded-full">${ico('circle-check','text-[14px]')} Under budget</span>
    <span class="inline-flex bg-surface border border-line rounded-full p-0.5 text-[11px] font-medium"><span class="px-3 py-1 rounded-full bg-white text-plum shadow-sm">Remaining</span><span class="px-3 py-1 text-ink-faint">Consumed</span></span>
  </div>
  <div class="md:flex md:items-center md:gap-8 lg:gap-10">
    <div class="md:flex-none mx-auto md:mx-0">${ringHtml}</div>
    <div class="md:flex-1 md:min-w-0 mt-5 md:mt-0 pt-5 md:pt-0 border-t md:border-t-0 border-line">
      <p class="hidden md:block font-headline italic text-lg text-ink-soft mb-5">Room for dinner — about 620 kcal to play with.</p>
      ${statCells}
    </div>
  </div>
</section>`;

const coachQuote = `Room for dinner — about 620 kcal to play with. No rush.`;

/* What to eat — carousel on mobile/tablet, 2-col grid on desktop (fills the wide left column) */
function suggCard(img, title, meta, fits, wide){
  return `<div class="${wide?'':'snap-start shrink-0 w-[300px]'} rounded-2xl overflow-hidden border border-line bg-surface relative">
    <div class="relative h-44"><img src="img/${img}" class="w-full h-full object-cover"/><div class="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent"></div>
      <div class="absolute bottom-0 p-4 text-white">${fits?`<span class="inline-flex items-center gap-1 bg-sage/90 text-white font-label text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full mb-1.5">${ico('circle-check','text-[12px]')} Fits your day</span>`:''}<p class="font-headline text-xl leading-tight">${title}</p><p class="font-body text-[12px] text-white/80 mt-0.5">${meta}</p></div>
    </div></div>`;
}
const suggData = [
  ['a6610a1bee6c.png','Warm Tahini Grain Bowl','580 kcal · 25 min',true],
  ['1eded18039f9.png','Chicken Kale Salad','410 kcal · 20 min',true],
  ['babbc6edccce.png','Three Cheese Fusilli','520 kcal · 30 min',false],
  ['e427c86a0d4f.png','Blueberry Baked Oats','320 kcal · 15 min',false],
];
const whatNext = `
<section>
  <div class="flex items-end justify-between mb-3 px-1"><h3 class="font-headline text-2xl text-ink">What to eat next</h3><a class="font-body text-sm text-clay font-medium">See all</a></div>
  <!-- mobile/tablet: horizontal carousel -->
  <div class="flex lg:hidden gap-4 overflow-x-auto snap-x pb-2 -mx-1 px-1">${suggData.map(d=>suggCard(...d,false)).join('')}</div>
  <!-- desktop: 2-col grid, fills the wide left column -->
  <div class="hidden lg:grid grid-cols-2 gap-4">${suggData.slice(0,4).map(d=>suggCard(...d,true)).join('')}</div>
</section>`;

const mealsList = `
<section>
  <h3 class="font-headline text-2xl text-ink mb-3">Today's meals</h3>
  <div class="space-y-0">
    <div class="flex items-center gap-3 py-3.5 border-b border-line"><div class="w-12 h-12 rounded-xl overflow-hidden flex-none"><img src="img/e427c86a0d4f.png" class="w-full h-full object-cover"/></div><div class="flex-1"><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Breakfast</p><p class="font-headline text-[16px] text-ink">Blueberry Baked Oats</p></div><span class="font-body text-sm text-ink-soft">420 kcal</span></div>
    <div class="flex items-center gap-3 py-3.5"><div class="w-12 h-12 rounded-xl overflow-hidden flex-none"><img src="img/1eded18039f9.png" class="w-full h-full object-cover"/></div><div class="flex-1"><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Lunch</p><p class="font-headline text-[16px] text-ink">Chicken Kale Salad</p></div><span class="font-body text-sm text-ink-soft">200 kcal</span></div>
  </div>
</section>`;

const railCoach = `<div class="bg-frost-mist/50 rounded-2xl p-5"><p class="font-headline italic text-base text-ink leading-relaxed">"${coachQuote}"</p></div>`;
const weightCard = `<div class="bg-surface-card border border-line rounded-2xl p-5"><div class="flex items-center justify-between mb-1"><span class="font-label text-[11px] uppercase tracking-wide text-ink-soft">On track</span><span class="text-sage">${ico('trending-down','text-[16px]')}</span></div><p class="font-headline text-2xl text-ink">76.0 <span class="text-base text-ink-soft font-body">kg</span></p><p class="font-body text-[13px] text-sage mt-0.5">−0.4 kg this week · goal 72.0</p></div>`;

const greeting = `
<div class="md:flex md:items-end md:justify-between">
  <div class="text-center md:text-left">
    <p class="font-body text-sm text-ink-faint">Tuesday, 24 October</p>
    <h1 class="font-headline text-4xl md:text-5xl text-plum mt-1">Evening, Grace</h1>
    <p class="font-headline italic text-lg text-ink-soft mt-3 max-w-md mx-auto md:mx-0 md:hidden">${coachQuote}</p>
  </div>
  <div class="hidden md:flex items-center gap-1.5"><button class="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink-soft">${ico('chevron-left','text-[18px]')}</button><span class="font-body text-sm font-medium text-ink px-3">Today</span><button class="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink-soft">${ico('chevron-right','text-[18px]')}</button></div>
</div>`;

// week strip — mobile web parity with the app (desktop uses the ‹Today› date nav in the greeting)
const weekStrip = `<div class="md:hidden flex justify-between gap-1.5 mt-6">${[['S','22',1],['M','23',1],['T','24',2],['W','25',0],['T','26',0],['F','27',0],['S','28',0]].map(([d,n,st])=>`<button class="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-2xl ${st===2?'bg-clay text-white shadow-sm':''}"><span class="text-[10px] uppercase tracking-wide ${st===2?'text-white/70':'text-ink-faint'}">${d}</span><span class="font-headline text-base ${st===2?'text-white':'text-ink'}">${n}</span><span class="w-1 h-1 rounded-full ${st===2?'bg-white':st===1?'bg-sage':'bg-transparent'}"></span></button>`).join('')}</div>`;

const body = `
${webTopNav('Today')}
<main class="max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto px-5 md:px-8 pt-10 md:pt-10 pb-20">
  ${greeting}
  ${weekStrip}
  <div class="mt-7 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start space-y-8 lg:space-y-0">
    <!-- LEFT / MAIN -->
    <div class="lg:col-span-8 space-y-8">
      ${energyCard}
      ${macrosGrid('grid grid-cols-2 md:grid-cols-4 gap-3 lg:hidden')}
      ${whatNext}
      ${mealsList}
    </div>
    <!-- RIGHT RAIL (desktop only) -->
    <aside class="hidden lg:block lg:col-span-4 space-y-5 lg:sticky lg:top-24">
      ${macrosGrid('grid grid-cols-2 gap-3')}
      ${railCoach}
      ${weightCard}
    </aside>
  </div>
</main>`;

console.log(writeScreen('today-web.html','Sloe · Today (web)', body, { web:true }));
