import { writeScreen, ico, backHeader, appBar, tabBar, multiRing } from './_gen.mjs';

const sk = (cls) => `<div class="bg-line/70 rounded-xl ${cls}"></div>`;

/* ---------- TODAY LOADING (skeleton) ---------- */
const todayLoading = `
${appBar()}
<main class="pt-6 px-4 pb-8 max-w-2xl mx-auto">
  <div class="flex flex-col items-center gap-2">${sk('h-7 w-44')}${sk('h-3 w-24')}</div>
  <section class="bg-surface-card border border-line rounded-2xl p-6 mt-5 flex flex-col items-center">
    <div class="w-full flex justify-between mb-4">${sk('h-5 w-24')}${sk('h-6 w-32 rounded-full')}</div>
    <div class="w-[200px] h-[200px] rounded-full border-[13px] border-line/70"></div>
    <div class="w-full flex gap-3 mt-5 pt-5 border-t border-line">${sk('h-10 flex-1')}${sk('h-10 flex-1')}${sk('h-10 flex-1')}</div>
  </section>
  <div class="grid grid-cols-2 gap-3 mt-5">${sk('h-20')}${sk('h-20')}${sk('h-20')}${sk('h-20')}</div>
  <div class="mt-6 space-y-3">${sk('h-16')}${sk('h-16')}</div>
</main>
${tabBar('Today')}`;

/* ---------- RECIPES LOADING (skeleton) ---------- */
const recipesLoading = `
${appBar()}
<main class="px-5 pt-5 pb-6 max-w-2xl mx-auto">
  ${sk('h-8 w-40')}
  <div class="flex gap-6 mt-5 mb-5">${sk('h-5 w-16')}${sk('h-5 w-20')}</div>
  ${sk('h-12 w-full rounded-full')}
  <div class="grid grid-cols-2 gap-3 mt-5">${Array.from({length:4},()=>`<div class="rounded-2xl overflow-hidden border border-line">${sk('h-32 rounded-none')}<div class="p-3 space-y-2">${sk('h-4 w-3/4')}${sk('h-3 w-1/2')}</div></div>`).join('')}</div>
</main>
${tabBar('Recipes')}`;

/* ---------- ERROR: OFFLINE ---------- */
const errorOffline = `
${appBar()}
<main class="px-6 pt-24 pb-10 max-w-2xl mx-auto flex flex-col items-center text-center">
  <span class="w-16 h-16 rounded-full bg-surface-card border border-line flex items-center justify-center text-ink-faint mb-5">${ico('cloud-off','text-3xl')}</span>
  <h1 class="font-headline text-2xl text-ink">You're offline</h1>
  <p class="font-body text-sm text-ink-soft mt-2 max-w-[280px] leading-relaxed">Your meals are saved on this device — we'll sync them the moment you're back online.</p>
  <button class="mt-7 bg-clay text-white font-body font-semibold text-sm rounded-full py-3 px-8 inline-flex items-center gap-2">${ico('refresh-cw','text-[16px]')} Try again</button>
</main>
${tabBar('Today')}`;

/* ---------- ERROR: IMPORT FAILED ---------- */
const errorImport = `
${backHeader('Add a recipe')}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-6">
  <div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-3.5"><span class="text-ink-faint">${ico('link','text-[18px]')}</span><span class="font-body text-sm text-ink-soft flex-1 truncate">instagram.com/reel/Cx9…</span></div>
  <section class="bg-destructive/8 border border-destructive/30 rounded-2xl p-6 text-center">
    <span class="w-12 h-12 rounded-full bg-destructive/12 flex items-center justify-center text-destructive mx-auto mb-3">${ico('circle-alert','text-2xl')}</span>
    <h2 class="font-headline text-xl text-ink">We couldn't read that link</h2>
    <p class="font-body text-[14px] text-ink-soft mt-2 leading-relaxed max-w-[300px] mx-auto">It might be private, or not a recipe. You can paste the recipe text instead and we'll do the rest.</p>
  </section>
  <div class="flex flex-col gap-2.5">
    <button class="w-full bg-clay text-white font-body font-semibold text-sm rounded-full py-3.5 flex items-center justify-center gap-2">${ico('file-text','text-[16px]')} Paste the text instead</button>
    <button class="w-full bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3.5">Try another link</button>
  </div>
</main>`;

// Today dark now lives in the shared template _buildtoday.mjs.

/* ---------- COOKBOOK DARK ---------- */
function darkCard(img, title, meta){
  return `<div class="rounded-2xl overflow-hidden bg-surface-card border border-line"><div class="aspect-[4/3] overflow-hidden relative"><img src="img/${img}" class="w-full h-full object-cover"/><span class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-clay">${ico('bookmark','text-[16px]')}</span></div><div class="p-3"><p class="font-headline text-[15px] text-ink leading-tight">${title}</p><p class="font-body text-[12px] text-ink-faint mt-1">${meta}</p></div></div>`;
}
const cookbookDark = `
${appBar()}
<main class="px-5 pt-5 pb-6 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Recipes</h1>
  <div class="flex gap-6 border-b border-line mt-4 mb-4"><span class="font-body text-[15px] text-ink font-semibold pb-3 border-b-2 border-ink -mb-px">Library</span><span class="font-body text-[15px] text-ink-faint pb-3">Discover</span></div>
  <div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-3 mb-4">${ico('search','text-[18px] text-ink-faint')}<span class="font-body text-sm text-ink-faint">Search your recipes</span></div>
  <div class="flex items-center gap-2 mb-4 overflow-x-auto -mx-5 px-5 pb-1">${['All','Breakfast','Lunch','Dinner','Dessert','Quick 30','Under 500 cal','High protein','Soup','Pasta','Chicken','Salad'].map((c,i)=>`<span class="font-label text-[13px] font-medium px-3.5 py-2 rounded-full whitespace-nowrap ${i===0?'bg-clay text-white':'bg-surface-card border border-line text-ink-soft'}">${c}</span>`).join('')}</div>
  <div class="grid grid-cols-2 gap-3">${darkCard('a6610a1bee6c.png','Mediterranean Grain Bowl','480 kcal · 25 min')}${darkCard('e427c86a0d4f.png','Blueberry Baked Oats','320 kcal · 15 min')}${darkCard('babbc6edccce.png','Three Cheese Fusilli','520 kcal · 30 min')}${darkCard('1eded18039f9.png','Chicken Kale Salad','410 kcal · 20 min')}</div>
</main>
${tabBar('Recipes')}`;

console.log(writeScreen('today-loading.html','Sloe · Today (loading)', todayLoading));
console.log(writeScreen('recipes-loading.html','Sloe · Recipes (loading)', recipesLoading));
console.log(writeScreen('error-offline.html','Sloe · Offline', errorOffline));
console.log(writeScreen('error-import.html','Sloe · Import error', errorImport));
// Dark FAB fix: tabBar uses bg-plum, which flips light in dark mode → use clay for a visible FAB.
console.log(writeScreen('cookbook-dark.html','Sloe · Recipes (dark)', cookbookDark.replace(/bg-plum\b/g,'bg-clay'), {dark:true}));
