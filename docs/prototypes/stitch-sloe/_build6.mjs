import { writeScreen, ico, backHeader, appBar, tabBar } from './_gen.mjs';

/* ---------------- PLAN ---------------- */
function dayPill(d, n, active){
  return `<button class="flex flex-col items-center gap-1 px-3.5 py-2 rounded-2xl ${active?'bg-clay text-white shadow-sm':'text-ink-soft'}"><span class="font-label text-[10px] uppercase tracking-wide ${active?'text-white/70':'text-ink-faint'}">${d}</span><span class="font-headline text-lg leading-none">${n}</span></button>`;
}
function mealRow(img, slot, name, kcal){
  return `<div class="flex items-center gap-3 py-3 border-b border-line last:border-0">
    <div class="w-12 h-12 rounded-xl overflow-hidden bg-surface-card border border-line flex-none"><img src="img/${img}" class="w-full h-full object-cover"/></div>
    <div class="flex-1 min-w-0"><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">${slot}</p><p class="font-headline text-[16px] text-ink leading-tight truncate">${name}</p><p class="font-body text-xs text-ink-faint">${kcal} kcal</p></div>
    <button class="w-9 h-9 rounded-full bg-surface-card border border-line flex items-center justify-center text-ink-soft">${ico('arrow-left-right','text-[16px]')}</button>
  </div>`;
}
function macroBar(name, pct, hex){
  return `<div class="flex items-center gap-3"><span class="font-label text-[11px] uppercase tracking-wide text-ink-faint w-14">${name}</span><div class="flex-1 h-2 rounded-full bg-line"><div class="h-2 rounded-full" style="width:${pct}%;background:${hex}"></div></div></div>`;
}
const plan = `
${appBar()}
<main class="px-5 pt-5 pb-8 max-w-2xl mx-auto space-y-6">
  <div><h1 class="font-headline text-3xl text-plum">Plan</h1><p class="font-body text-sm text-ink-soft mt-0.5">Your week is looking balanced and nourishing.</p></div>
  <div class="flex justify-between -mx-1">${[['M','22',0],['T','23',0],['W','24',1],['T','25',0],['F','26',0],['S','27',0],['S','28',0]].map(([d,n,a])=>dayPill(d,n,a)).join('')}</div>
  <section class="bg-surface-card border border-line rounded-2xl p-5 space-y-3">
    <div class="flex items-baseline justify-between"><h2 class="font-headline text-xl text-ink">Wednesday</h2><span class="font-body text-[13px] text-ink-soft">1,840 <span class="text-ink-faint">/ 2,040 kcal</span></span></div>
    ${macroBar('Protein',68,'#7C8466')}${macroBar('Carbs',74,'#C8794E')}${macroBar('Fat',60,'#C9892C')}
  </section>
  <section>
    ${mealRow('e427c86a0d4f.png','Breakfast','Blueberry Baked Oats','320')}
    ${mealRow('a6610a1bee6c.png','Lunch','Mediterranean Grain Bowl','480')}
    ${mealRow('babbc6edccce.png','Dinner','Three Cheese Fusilli','520')}
  </section>
  <div class="flex flex-col gap-3">
    <button class="w-full bg-clay text-white font-body font-semibold text-sm rounded-full py-3.5 flex items-center justify-center gap-2">${ico('shopping-basket','text-[16px]')} Add this week to shopping list</button>
    <button class="w-full bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3.5 flex items-center justify-center gap-2">${ico('sparkles','text-[16px]')} Regenerate plan</button>
  </div>
</main>
${tabBar('Plan')}`;

/* ---------------- COOKBOOK / LIBRARY ---------------- */
function libCard(img, title, meta, rating){
  return `<div class="recipe-card cursor-pointer rounded-2xl overflow-hidden bg-surface-card border border-line">
    <div class="aspect-[4/3] overflow-hidden relative"><img src="img/${img}" class="w-full h-full object-cover"/>
      <span class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-clay">${ico('bookmark','text-[16px]')}</span></div>
    <div class="p-3">
      <p class="font-headline text-[15px] text-ink leading-tight">${title}</p>
      <div class="flex items-center gap-1 mt-1"><svg class="sloe-ico text-[12px] text-clay" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11.5 2.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3 8.7l5.9-.9z"/></svg><span class="font-body text-[12px] text-ink font-medium">${rating}</span><span class="font-body text-[12px] text-ink-faint">· ${meta}</span></div>
    </div>
  </div>`;
}
const cookbook = `
${appBar()}
<main class="px-5 pt-5 pb-6 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Recipes</h1>
  <div class="flex gap-6 border-b border-line mt-4 mb-4">
    <span class="font-body text-[15px] text-ink font-semibold pb-3 border-b-2 border-ink -mb-px">Library</span>
    <span class="font-body text-[15px] text-ink-faint pb-3">Discover</span>
  </div>
  <div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-3 mb-4">${ico('search','text-[18px] text-ink-faint')}<span class="font-body text-sm text-ink-faint">Search your recipes</span></div>
  <div class="flex items-center gap-2 mb-4 overflow-x-auto -mx-5 px-5 pb-1">
    ${['All','Breakfast','Lunch','Dinner','Dessert','Quick 30','Under 500 cal','High protein','Soup','Pasta','Chicken','Salad'].map((c,i)=>`<span class="font-label text-[13px] font-medium px-3.5 py-2 rounded-full whitespace-nowrap ${i===0?'bg-clay text-white':'bg-surface-card border border-line text-ink-soft'}">${c}</span>`).join('')}
  </div>
  <p class="font-body text-[13px] text-ink-faint mb-3">24 saved recipes</p>
  <div class="grid grid-cols-2 gap-3">
    ${libCard('a6610a1bee6c.png','Mediterranean Grain Bowl','25 min','4.8')}
    ${libCard('e427c86a0d4f.png','Blueberry Baked Oats','15 min','4.9')}
    ${libCard('babbc6edccce.png','Three Cheese Fusilli','30 min','4.7')}
    ${libCard('1eded18039f9.png','Chicken Kale Salad','20 min','4.8')}
  </div>
</main>
${tabBar('Recipes')}`;

/* ---------------- IMPORT ---------------- */
function importOpt(icon, label, sub){
  return `<button class="flex-1 bg-surface-card border border-line rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
    <span class="w-11 h-11 rounded-full bg-white border border-line flex items-center justify-center text-clay">${ico(icon,'text-[20px]')}</span>
    <span class="font-headline text-[15px] text-ink leading-tight">${label}</span><span class="font-body text-[11px] text-ink-faint">${sub}</span></button>`;
}
const importScreen = `
${backHeader('Add a recipe')}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-7">
  <div>
    <h1 class="font-headline text-2xl text-ink mb-1">Import from anywhere</h1>
    <p class="font-body text-sm text-ink-soft">Paste a link from Instagram, TikTok or any recipe site — we'll pull the ingredients and work out the nutrition.</p>
  </div>
  <div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-3.5">${ico('link','text-[18px] text-ink-faint')}<span class="font-body text-sm text-ink-faint flex-1">Paste a link, Reel or TikTok</span></div>
  <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4 flex items-center justify-center gap-2">${ico('download','text-[18px]')} Import recipe</button>
  <div class="flex items-center gap-3"><div class="flex-1 h-px bg-line"></div><span class="font-label text-[11px] uppercase tracking-wide text-ink-faint">or</span><div class="flex-1 h-px bg-line"></div></div>
  <div class="flex gap-3">
    ${importOpt('camera','Photo','Snap a recipe')}
    ${importOpt('file-text','Paste text','From notes')}
    ${importOpt('scan-barcode','Scan','Barcode')}
  </div>
  <section class="bg-frost-mist/60 rounded-2xl p-5 flex items-center gap-4">
    <span class="w-11 h-11 rounded-full bg-white flex items-center justify-center text-plum flex-none">${ico('sparkles','text-[18px]')}</span>
    <p class="font-body text-[13px] text-ink-soft leading-relaxed">Imported recipes are macro-checked automatically, then you confirm anything vague.</p>
  </section>
</main>`;

console.log(writeScreen('planner.html','Sloe · Plan', plan));
console.log(writeScreen('cookbook.html','Sloe · Recipes', cookbook));
console.log(writeScreen('import.html','Sloe · Add a recipe', importScreen));
