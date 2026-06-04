import { writeScreen, ico, backHeader, appBar, tabBar } from './_gen.mjs';

function emptyCard(icon, title, body, cta){
  return `<div class="bg-surface-card border border-dashed border-line rounded-2xl px-8 py-12 text-center">
    <span class="w-14 h-14 rounded-full bg-frost-mist flex items-center justify-center text-plum mx-auto mb-4">${ico(icon,'text-2xl')}</span>
    <h2 class="font-headline text-xl text-ink">${title}</h2>
    <p class="font-body text-[14px] text-ink-soft mt-2 leading-relaxed max-w-[260px] mx-auto">${body}</p>
    ${cta||''}
  </div>`;
}

/* ---------- RECIPES / LIBRARY EMPTY ---------- */
const recipesEmpty = `
${appBar()}
<main class="px-5 pt-5 pb-6 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Recipes</h1>
  <div class="flex gap-6 border-b border-line mt-4 mb-5"><span class="font-body text-[15px] text-ink font-semibold pb-3 border-b-2 border-ink -mb-px">Library</span><span class="font-body text-[15px] text-ink-faint pb-3">Discover</span></div>
  ${emptyCard('bookmark','No saved recipes yet','Save a recipe from a Reel or TikTok, or browse Discover to start your collection.',
    `<div class="flex flex-col gap-2.5 mt-6 max-w-[280px] mx-auto"><button class="w-full bg-clay text-white font-body font-semibold text-sm rounded-full py-3 flex items-center justify-center gap-2">${ico('download','text-[16px]')} Import a recipe</button><button class="w-full bg-white border border-line text-ink font-body font-semibold text-sm rounded-full py-3 flex items-center justify-center gap-2">${ico('compass','text-[16px]')} Explore Discover</button></div>`)}
</main>
${tabBar('Recipes')}`;

/* ---------- PLAN EMPTY ---------- */
const planEmpty = `
${appBar()}
<main class="px-5 pt-5 pb-6 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Plan</h1>
  <p class="font-body text-sm text-ink-soft mt-0.5">Let's build a week that fits your goals.</p>
  <div class="flex justify-between -mx-1 mt-5 mb-6 opacity-50">${[['M','22'],['T','23'],['W','24'],['T','25'],['F','26'],['S','27'],['S','28']].map(([d,n])=>`<div class="flex flex-col items-center gap-1 px-3.5 py-2"><span class="font-label text-[10px] uppercase text-ink-faint">${d}</span><span class="font-headline text-lg text-ink-faint">${n}</span></div>`).join('')}</div>
  ${emptyCard('calendar-days','No plan for this week yet','Generate a balanced week around your targets — then swap anything you don’t fancy.',
    `<button class="mt-6 bg-clay text-white font-body font-semibold text-sm rounded-full py-3 px-7 inline-flex items-center justify-center gap-2 mx-auto">${ico('sparkles','text-[16px]')} Generate my week</button>`)}
</main>
${tabBar('Plan')}`;

/* ---------- PROGRESS EMPTY ---------- */
const progressEmpty = `
${appBar()}
<main class="px-5 pt-5 pb-6 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Progress</h1>
  <p class="font-body text-sm text-ink-soft mt-0.5">Your trends will appear as you go.</p>
  <div class="mt-6">${emptyCard('chart-no-axes-column','Not enough data yet','Log a few days and add a weigh-in — your adherence, weight trend and calorie history will build here.',
    `<button class="mt-6 bg-clay text-white font-body font-semibold text-sm rounded-full py-3 px-7 inline-flex items-center justify-center gap-2 mx-auto">${ico('plus','text-[16px]')} Log today</button>`)}</div>
  <div class="grid grid-cols-2 gap-3 mt-4 opacity-40">${['Avg intake','Weight','Deficit','Streak'].map(l=>`<div class="bg-surface-card border border-line rounded-2xl p-4"><p class="font-label text-[10px] uppercase text-ink-faint">${l}</p><p class="font-headline text-2xl text-ink-faint mt-1">—</p></div>`).join('')}</div>
</main>
${tabBar('Progress')}`;

/* ---------- LOG: SEARCH RESULTS ---------- */
function searchRes(name, brand, kcal){
  return `<div class="flex items-center gap-3 py-3 border-b border-line last:border-0"><div class="flex-1"><p class="font-body text-[15px] text-ink leading-tight">${name}</p><p class="font-body text-xs text-ink-faint">${brand} · ${kcal} kcal / 100g</p></div><button class="w-8 h-8 rounded-full bg-surface-card border border-line flex items-center justify-center text-clay">${ico('plus','text-[16px]')}</button></div>`;
}
const logSearch = `
${backHeader('Add food', ico('scan-barcode'))}
<main class="px-5 pt-4 pb-10 max-w-2xl mx-auto">
  <div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-3"><span class="text-ink-faint">${ico('search','text-[18px]')}</span><span class="flex-1 font-body text-[15px] text-ink">chicken breast</span><span class="text-ink-faint">${ico('x','text-[16px]')}</span></div>
  <div class="flex items-center gap-2 mt-4">${['All','Verified','My foods'].map((c,i)=>`<span class="font-label text-[13px] font-medium px-3 py-1.5 rounded-full ${i===0?'bg-plum text-white':'bg-surface-card border border-line text-ink-soft'}">${c}</span>`).join('')}</div>
  <p class="font-body text-[13px] text-ink-faint mt-5 mb-1">Results</p>
  ${searchRes('Chicken breast, grilled','Verified','165')}
  ${searchRes('Chicken breast, raw','Verified','120')}
  ${searchRes('Chicken thigh, roasted','Verified','209')}
  ${searchRes('Chicken breast','Tesco','106')}
  ${searchRes('Rotisserie chicken','Generic','190')}
</main>`;

/* ---------- LOG: PHOTO (AI review) ---------- */
function detected(name, portion, ok){
  return `<div class="flex items-center gap-3 py-3 border-b border-line last:border-0">${ok?`<span class="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-white flex-none">${ico('check','text-[14px]')}</span>`:`<span class="w-6 h-6 rounded-full bg-amber/20 flex items-center justify-center text-amber flex-none">${ico('circle-alert','text-[14px]')}</span>`}<div class="flex-1"><p class="font-body text-[15px] text-ink leading-tight">${name}</p><p class="font-body text-xs ${ok?'text-ink-faint':'text-amber'}">${portion}</p></div>${ico('chevron-right','text-ink-faint text-[16px]')}</div>`;
}
const logPhoto = `
${backHeader('Photo log')}
<main class="pb-28 max-w-2xl mx-auto">
  <div class="w-full aspect-[16/10] bg-surface-card overflow-hidden"><img src="img/a6610a1bee6c.png" class="w-full h-full object-cover"/></div>
  <div class="px-5 pt-5">
    <div class="flex items-center gap-2 mb-4"><span class="w-8 h-8 rounded-full bg-frost-mist flex items-center justify-center text-plum">${ico('sparkles','text-[16px]')}</span><p class="font-headline text-lg text-ink">We spotted a grain bowl</p></div>
    <p class="font-body text-[13px] text-ink-soft mb-2">Tap any item to adjust the portion.</p>
    ${detected('Cooked quinoa','~150 g · 180 kcal',true)}
    ${detected('Roast chickpeas','~80 g · 130 kcal',true)}
    ${detected('Avocado','~½ · 120 kcal',true)}
    ${detected('Tahini dressing','portion unclear — tap',false)}
    <div class="mt-4 bg-surface-card border border-line rounded-2xl p-4 flex items-center justify-between"><span class="font-body text-sm text-ink-soft">Estimated total</span><span class="font-headline text-xl text-ink">~560 kcal</span></div>
  </div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface border-t border-line px-5 pt-3 pb-7 flex gap-3"><button class="flex-1 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3.5">Retake</button><button class="flex-[2] bg-clay text-white font-body font-semibold text-sm rounded-full py-3.5">Add 4 items</button></div>`;

/* ---------- LOG: VOICE ---------- */
const bars = Array.from({length:32},(_,i)=>{const h=[10,18,30,46,28,16,38,52,34,20,44,60,40,24,48,30,18,36,54,32,22,42,58,38,26,46,28,16,30,20,12,8][i];return `<div class="w-1.5 rounded-full bg-clay" style="height:${h}px"></div>`}).join('');
const logVoice = `
${backHeader('Voice log')}
<main class="px-6 pt-10 pb-10 max-w-2xl mx-auto flex flex-col items-center text-center min-h-[70vh]">
  <p class="font-label text-[11px] uppercase tracking-[0.1em] text-ink-faint">Listening…</p>
  <div class="flex items-center justify-center gap-1 h-16 my-8">${bars}</div>
  <p class="font-headline text-2xl text-ink leading-snug max-w-[300px]">"Two scrambled eggs, a slice of sourdough and half an avocado"</p>
  <div class="flex flex-wrap justify-center gap-2 mt-8">${['2 eggs','Sourdough · 1 slice','Avocado · ½'].map(t=>`<span class="inline-flex items-center gap-1.5 bg-surface-card border border-line rounded-full px-3.5 py-2 font-body text-[13px] text-ink">${ico('circle-check','text-sage text-[14px]')} ${t}</span>`).join('')}</div>
  <p class="font-body text-[13px] text-ink-faint mt-3">~410 kcal · tap a chip to adjust</p>
  <div class="flex-1"></div>
  <div class="flex items-center gap-4 mt-8">
    <button class="w-12 h-12 rounded-full bg-surface-card border border-line flex items-center justify-center text-ink-soft">${ico('x','text-[20px]')}</button>
    <button class="w-16 h-16 rounded-full bg-clay flex items-center justify-center text-white shadow-lg">${ico('mic','text-2xl')}</button>
    <button class="w-12 h-12 rounded-full bg-sage flex items-center justify-center text-white">${ico('check','text-[20px]')}</button>
  </div>
</main>`;

/* ---------- RECIPE LOGGED / COOK COMPLETE ---------- */
const recipeLogged = `
<main class="px-6 pt-16 pb-10 max-w-2xl mx-auto flex flex-col items-center text-center min-h-screen">
  <span class="w-16 h-16 rounded-full bg-sage flex items-center justify-center text-white mb-5">${ico('check','text-3xl')}</span>
  <h1 class="font-headline text-3xl text-plum">Logged to today</h1>
  <p class="font-body text-sm text-ink-soft mt-1">Nicely done — it fit your day perfectly.</p>
  <section class="w-full bg-surface-card border border-line rounded-2xl overflow-hidden mt-7">
    <div class="w-full aspect-[16/9] overflow-hidden"><img src="img/babbc6edccce.png" class="w-full h-full object-cover"/></div>
    <div class="p-5 text-left">
      <p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Dinner · 1 serving</p>
      <p class="font-headline text-xl text-ink leading-tight">Three Cheese Fusilli</p>
      <div class="flex mt-4">${[['520','kcal','text-ink'],['28g','protein','text-macro-protein'],['54g','carbs','text-macro-carbs'],['22g','fat','text-macro-fat']].map(([v,l,c])=>`<div class="flex-1 text-center"><p class="font-headline text-xl ${c}">${v}</p><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">${l}</p></div>`).join('')}</div>
    </div>
  </section>
  <div class="w-full bg-frost-mist/60 rounded-2xl p-4 mt-3 flex items-center gap-3 text-left"><span class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-sage flex-none">${ico('circle-check','text-[16px]')}</span><p class="font-body text-[13px] text-ink-soft">You've still got <span class="text-ink font-medium">120 kcal</span> to play with today.</p></div>
  <div class="flex-1"></div>
  <div class="w-full flex gap-3 mt-7"><button class="flex-1 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3.5">Rate recipe</button><button class="flex-[2] bg-clay text-white font-body font-semibold text-sm rounded-full py-3.5">View today</button></div>
</main>`;

console.log(writeScreen('recipes-empty.html','Sloe · Recipes (empty)', recipesEmpty));
console.log(writeScreen('plan-empty.html','Sloe · Plan (empty)', planEmpty));
console.log(writeScreen('progress-empty.html','Sloe · Progress (empty)', progressEmpty));
console.log(writeScreen('log-search.html','Sloe · Search food', logSearch));
console.log(writeScreen('log-photo.html','Sloe · Photo log', logPhoto));
console.log(writeScreen('log-voice.html','Sloe · Voice log', logVoice));
console.log(writeScreen('recipe-logged.html','Sloe · Logged', recipeLogged));
