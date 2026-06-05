import { writeScreen, ico, appBar, tabBar, multiRing } from './_gen.mjs';

/* ============================================================
   ONE shared Today template → today / empty / over / dark.
   Single source of truth so the variants can never drift.
   ============================================================ */

/** Resting Sloe cards — #F6F5F2 + soft lift, no hairline (matches sim). */
const CARD_SLAB =
  'bg-surface-card rounded-xl shadow-[0_4px_14px_rgba(34,27,38,0.10)]';

const MAC = {
  light: { protein:'#7C8466', carbs:'#C8794E', fat:'#C9892C', fiber:'#4A7878' },
  dark:  { protein:'#A2AE88', carbs:'#D58A5E', fat:'#D6A24A', fiber:'#6FA3A3' },
};
// inline glyphs (kept local so they render identically in every state)
const g = (p, cls='') => `<svg class="sloe-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const FLAME = '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>';
const CLOCK = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';

function weekStrip(){
  // st: 0 plain · 1 logged · 2 selected (today in mock) — minimal strip, no filled pill
  const days=[['S','22',1],['M','23',1],['T','24',2],['W','25',0],['T','26',0],['F','27',0],['S','28',0]];
  return `<section class="mb-7"><div class="flex justify-between gap-1.5">${days.map(([d,n,st])=>{
    const sel=st===2;
    const numCls=sel?'font-headline text-sm text-clay font-semibold':'font-headline text-sm text-ink';
    const dotCls=sel?'bg-clay':st===1?'bg-sage':'bg-transparent';
    return `<button class="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-2xl"><span class="text-[10px] uppercase tracking-wide text-ink-faint">${d}</span><span class="${numCls}">${n}</span><span class="w-1 h-1 rounded-full ${dotCls}"></span></button>`;
  }).join('')}</div></section>`;
}
function chip(text, tone){
  const map={under:['bg-sage/15','text-sage','circle-check'], over:['bg-destructive/10','text-destructive','circle-alert'], fresh:['bg-frost-mist','text-plum','sparkles']};
  const [bg,tx,ic]=map[tone]||map.under;
  return `<span class="inline-flex items-center gap-1.5 ${bg} ${tx} font-label text-xs font-semibold px-2.5 py-1 rounded-full">${ico(ic,'text-[14px]')} ${text}</span>`;
}
function heroToggle(dark) {
  const activeBg = dark ? '#35323A' : '#FFFFFF';
  const activeFg = dark ? '#F5F3F4' : '#3B2A4D';
  return `<span class="inline-flex bg-[#EFEFEF] rounded-full p-0.5 text-[10px] font-medium"><span class="px-3 py-1 rounded-full shadow-sm" style="background:${activeBg};color:${activeFg}">Remaining</span><span class="px-3 py-1 text-ink-soft">Consumed</span></span>`;
}

function macroTile(name, val, target, pct, color, icon){
  return `<div class="${CARD_SLAB} p-4 flex flex-col justify-between h-24">
    <div class="flex items-start justify-between"><span class="text-xs text-ink-soft font-medium">${name}</span><span style="color:${color}">${ico(icon,'text-lg')}</span></div>
    <div class="flex items-baseline gap-1"><span class="font-headline text-xl text-ink">${val}<span class="text-base text-ink-soft font-body font-normal ml-0.5">g</span></span><span class="text-xs text-ink-faint ml-1">/ ${target}g</span></div>
    <div class="h-1 w-full bg-line rounded-full mt-2 overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
}
function whatNextCard(img, title, kcal, min){
  return `<section id="figma-capture-what-next" class="mb-10"><h3 class="font-headline text-2xl text-plum mb-4">What to eat next</h3>
  <div class="recipe-card rounded-2xl overflow-hidden shadow-[0_4px_14px_rgba(34,27,38,0.10)] relative cursor-pointer block h-80">
    <div class="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent z-20"></div>
    <img src="./img/${img}" class="absolute inset-0 w-full h-full object-cover z-0"/>
    <div class="absolute top-4 left-4 z-30"><span class="bg-sage/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">${g(CHECK,'text-[14px]')} Fits your day</span></div>
    <div class="absolute bottom-0 left-0 w-full p-5 z-30 text-white"><p class="text-[10px] uppercase tracking-widest text-frost/90 mb-1 font-medium">Dinner suggestion</p><h4 class="font-headline text-2xl mb-1 text-white">${title}</h4><div class="flex items-center gap-3 text-sm text-white/80"><span class="flex items-center gap-1">${g(FLAME,'text-[14px]')} ${kcal} kcal</span><span class="w-1 h-1 bg-white/40 rounded-full"></span><span class="flex items-center gap-1">${g(CLOCK,'text-[14px]')} ${min} min</span></div></div>
  </div></section>`;
}
function mealRow(img, slot, title, sub, logged){
  return `<div class="${CARD_SLAB} p-3 flex items-center gap-4">
    <div class="w-16 h-16 rounded-lg overflow-hidden shrink-0"><img src="./img/${img}" class="w-full h-full object-cover"/></div>
    <div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-1"><span class="text-[10px] text-ink-soft uppercase tracking-wider font-medium">${slot}</span>${logged?`<span class="text-xs text-ink-faint flex items-center gap-1">${g(CHECK,'text-[14px]')} Logged</span>`:''}</div><h4 class="font-headline text-lg text-ink truncate">${title}</h4><p class="text-xs text-ink-soft mt-0.5">${sub}</p></div>
  </div>`;
}
function mealsSection(meals, total, showDinnerCTA){
  return `<section class="mb-10"><div class="flex items-center justify-between mb-4"><h3 class="font-headline text-2xl text-plum">Today's Meals</h3><span class="text-xs text-ink-faint font-medium">${total} kcal total</span></div>
  <div class="space-y-3">${meals.map(m=>mealRow(...m)).join('')}${showDinnerCTA?`<button class="w-full bg-surface rounded-xl border border-dashed border-line p-4 flex items-center justify-center gap-2 group"><span class="text-clay">${ico('plus','text-xl')}</span><span class="font-medium text-ink-soft">Log Dinner</span></button>`:''}</div></section>`;
}
function insightCard(title, text){
  return `<section class="mb-4"><div class="bg-frost-mist/40 rounded-xl border border-line p-5 relative overflow-hidden"><div class="flex items-start gap-3 relative z-10"><div class="bg-surface p-2 rounded-lg shadow-sm border border-line/50 mt-1 text-plum">${ico('trending-up','text-lg')}</div><div><h4 class="font-headline text-lg text-plum mb-1">${title}</h4><p class="text-sm text-ink-soft leading-relaxed">${text}</p></div></div></div></section>`;
}
function logFirstMeal(){
  return `<section class="mb-10"><div class="${CARD_SLAB} p-8 flex flex-col items-center text-center"><span class="w-12 h-12 rounded-full bg-frost-mist flex items-center justify-center text-clay mb-3">${ico('plus','text-2xl')}</span><h3 class="font-headline text-xl text-ink mb-1">Log your first meal</h3><p class="font-body text-sm text-ink-soft">Tap + to add breakfast — or import a recipe.</p></div></section>`;
}

function todayBody(o){
  const M = o.dark ? MAC.dark : MAC.light;
  // Ring = calories + Protein/Carbs/Fat only. Fibre is a tile, never a ring arc (keeps it to 4 arcs, matches web).
  const ringMacros = o.macros.filter(m=>m.key!=='fiber').map(m=>({ value:o.empty?0:m.val, of:m.target, color:M[m.key] }));
  const ring = multiRing(o.empty?0:o.cal, o.calOf, ringMacros, o.track, 220, o.calColor);
  const tiles = o.macros.map(m=>{
    const v = o.empty?0:m.val, pct = Math.min(100, Math.round(v/m.target*100));
    return macroTile(m.name, v, m.target, pct, M[m.key], m.icon);
  }).join('');
  const statsRow = `<div class="grid grid-cols-3 divide-x divide-line mt-6 pt-6 border-t border-line">${
    [['Goal',o.goal,''],['Eaten',o.eaten,''],[o.bonusLabel,o.bonus,o.bonusTone]].map(([l,v,t])=>
      `<div class="text-center px-2"><span class="block text-[10px] uppercase tracking-wider mb-1 ${t||'text-ink-faint'}">${l}</span><span class="font-headline text-[19px] leading-tight ${t||'text-ink'}">${v}</span></div>`).join('')}</div>`;
  const captureBg = o.dark ? '#19181C' : '#FFFFFF';
  return `
${appBar()}
<div id="figma-capture-root" style="width:390px;margin:0 auto;background:${captureBg}">
<main class="pt-3 px-4 pb-12">
  <section class="mt-2 mb-5 text-center"><h2 class="font-headline text-2xl font-medium text-plum mb-1 tracking-tight">${o.greeting}</h2><p class="text-ink-soft text-[13px]">${o.date}</p></section>
  ${weekStrip()}
  <section class="mb-8"><div class="${CARD_SLAB} p-6 pt-5 relative">
    <div class="flex justify-between items-center mb-3">${chip(o.chipText,o.chipTone)}${heroToggle(o.dark)}</div>
    ${ring}
    ${statsRow}
  </div>
  <div class="mt-4 text-center px-6"><p class="font-headline italic text-[17px] text-plum/90">"${o.coach}"</p></div></section>
  <section class="mb-10 grid grid-cols-2 gap-3">${tiles}</section>
  ${o.empty ? logFirstMeal() : whatNextCard(...o.whatNext)}
  ${o.empty ? '' : mealsSection(o.meals, o.total, o.showDinnerCTA)}
  ${o.insight ? insightCard(...o.insight) : ''}
</main>
${tabBar('Today')}
</div>`;
}

/* ---------------- STATE DEFINITIONS ---------------- */
const macrosUnder = [
  {key:'protein',name:'Protein',val:96, target:140,icon:'dumbbell'},
  {key:'carbs',  name:'Carbs',  val:142,target:200,icon:'wheat'},
  {key:'fat',    name:'Fat',    val:44, target:68, icon:'droplet'},
  {key:'fiber',  name:'Fibre',  val:18, target:30, icon:'sprout'},
];
const macrosOver = [
  {key:'protein',name:'Protein',val:118,target:140,icon:'dumbbell'},
  {key:'carbs',  name:'Carbs',  val:240,target:200,icon:'wheat'},
  {key:'fat',    name:'Fat',    val:72, target:68, icon:'droplet'},
  {key:'fiber',  name:'Fibre',  val:24, target:30, icon:'sprout'},
];
const mealsLogged = [
  ['e427c86a0d4f.png','Breakfast','Blueberry Baked Oats','320 kcal • 12g P',true],
  ['1eded18039f9.png','Lunch','Chicken & Avocado Salad','480 kcal • 42g P',true],
];
const mealsOver = [
  ['e427c86a0d4f.png','Breakfast','Blueberry Baked Oats','420 kcal • 12g P',true],
  ['1eded18039f9.png','Lunch','Chicken & Avocado Salad','620 kcal • 42g P',true],
  ['babbc6edccce.png','Dinner','Three Cheese Fusilli','1,140 kcal • 38g P',true],
];

const STATE_UNDER = {
  greeting:'Morning, Grace', date:'Tuesday, 24 October',
  chipText:'Under budget', chipTone:'under',
  cal:1420, calOf:2040, calColor:'#3B2A4D', track:'#EDEAF1', macros:macrosUnder,
  goal:'2,040', eaten:'620', bonusLabel:'Bonus', bonus:'+120', bonusTone:'text-sage',
  coach:'Room for dinner — about 620 kcal to play with. No rush.',
  whatNext:['a6610a1bee6c.png','Warm Tahini Grain Bowl','580','25'],
  meals:mealsLogged, total:'1,420', showDinnerCTA:true,
  insight:['Weekly Insight',"You've hit your protein goal 4 days in a row. This is helping keep your afternoon energy levels stable."],
};
const STATE_EMPTY = {
  greeting:'Morning, Grace', date:'Tuesday, 24 October',
  chipText:'Fresh start', chipTone:'fresh', empty:true,
  cal:0, calOf:2040, calColor:'#3B2A4D', track:'#EDEAF1', macros:macrosUnder,
  goal:'2,040', eaten:'0', bonusLabel:'Left', bonus:'2,040', bonusTone:'',
  coach:"A blank canvas. What's first today?",
};
const STATE_OVER = {
  greeting:'Evening, Grace', date:'Tuesday, 24 October',
  chipText:'Over budget', chipTone:'over',
  cal:2180, calOf:2040, calColor:'#3B2A4D', track:'#EDEAF1', macros:macrosOver,
  goal:'2,040', eaten:'2,180', bonusLabel:'Over', bonus:'−140', bonusTone:'text-destructive',
  coach:"A little over today — tomorrow's a clean slate. No guilt.",
  whatNext:['a6610a1bee6c.png','Lighter Tahini Bowl','420','20'],
  meals:mealsOver, total:'2,180', showDinnerCTA:false,
  insight:['Gentle nudge','One over-day won’t move the needle — your 7-day average is still right on target.'],
};
const STATE_DARK = { ...STATE_UNDER,
  greeting:'Evening, Grace',
  calColor:'#815E91', track:'#372F44', dark:true,
};

console.log(writeScreen('today.html','Sloe · Today', todayBody(STATE_UNDER)));
console.log(writeScreen('today-empty.html','Sloe · Today (empty)', todayBody(STATE_EMPTY)));
console.log(writeScreen('today-over.html','Sloe · Today (over)', todayBody(STATE_OVER)));
console.log(writeScreen('today-dark.html','Sloe · Today (dark)', todayBody(STATE_DARK).replace(/bg-plum\b/g,'bg-clay'), {dark:true}));
