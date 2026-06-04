import { writeScreen, ico, backHeader, appBar, tabBar } from './_gen.mjs';

/* ---------------- CREATE RECIPE ---------------- */
const create = `
${backHeader('New recipe', '<span class="font-body text-sm font-semibold text-clay">Save</span>')}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-6">
  <div class="w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-line bg-surface-card flex flex-col items-center justify-center text-ink-faint gap-2">
    ${ico('camera','text-3xl text-ink-faint')}<span class="font-body text-sm">Add a photo of your dish</span>
  </div>
  <div>
    <label class="font-label text-[11px] uppercase tracking-[0.06em] text-ink-faint">Title</label>
    <input class="w-full mt-1 bg-transparent border-b border-line py-2 font-headline text-2xl text-ink placeholder:text-ink-faint focus:outline-none" placeholder="Name your recipe" value="Warm Tahini Grain Bowl"/>
  </div>
  <div class="flex items-center justify-between border-b border-line pb-3">
    <span class="font-body text-[15px] text-ink">Servings</span>
    <div class="flex items-center gap-4">
      <button class="w-8 h-8 rounded-full bg-surface-card border border-line flex items-center justify-center text-ink">${ico('minus','text-[16px]')}</button>
      <span class="font-headline text-xl text-ink">2</span>
      <button class="w-8 h-8 rounded-full bg-surface-card border border-line flex items-center justify-center text-ink">${ico('plus','text-[16px]')}</button>
    </div>
  </div>
  <section>
    <h2 class="font-headline text-lg text-ink mb-2">Ingredients</h2>
    <div class="space-y-2">
      ${['200 g · Cooked quinoa','1 · Avocado','1 tin · Chickpeas','2 tbsp · Tahini'].map(i=>`<div class="flex items-center gap-3 bg-surface-card border border-line rounded-xl px-4 py-3"><span class="font-body text-[15px] text-ink flex-1">${i}</span>${ico('grip-vertical','text-ink-faint text-[18px]')}</div>`).join('')}
    </div>
    <button class="mt-2 flex items-center gap-2 font-body text-sm font-semibold text-clay py-1">${ico('plus','text-[18px]')} Add ingredient</button>
  </section>
  <section>
    <h2 class="font-headline text-lg text-ink mb-2">Method</h2>
    <div class="space-y-2">
      ${['Cook the quinoa and let it cool slightly.','Roast the chickpeas with spices until crisp.'].map((s,i)=>`<div class="flex gap-3 bg-surface-card border border-line rounded-xl px-4 py-3"><span class="font-headline text-lg text-ink-faint">${i+1}</span><span class="font-body text-[15px] text-ink flex-1">${s}</span></div>`).join('')}
    </div>
    <button class="mt-2 flex items-center gap-2 font-body text-sm font-semibold text-clay py-1">${ico('plus','text-[18px]')} Add step</button>
  </section>
  <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Save recipe</button>
</main>`;

/* ---------------- VERIFY RECIPE (imported) ---------------- */
function parsed(name, amt, ok){
  return `<div class="flex items-center gap-3 py-3 border-b border-line last:border-0">
    ${ok?`<span class="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-white flex-none">${ico('check','text-[14px]')}</span>`:`<span class="w-6 h-6 rounded-full bg-amber/20 flex items-center justify-center text-amber flex-none">${ico('circle-alert','text-[14px]')}</span>`}
    <span class="flex-1 font-body text-[15px] text-ink">${name}</span>
    <span class="font-body text-sm ${ok?'text-ink-soft':'text-amber font-medium'}">${amt}</span>
  </div>`;
}
const verify = `
${backHeader('Check this recipe')}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-6">
  <div class="flex items-center gap-2 bg-frost-mist rounded-full px-3 py-2 w-fit">${ico('instagram','text-[16px] text-plum')}<span class="font-body text-[13px] text-ink-soft">Imported from <span class="text-ink font-medium">@gatherednutrition</span></span></div>
  <div class="flex gap-4 items-center">
    <div class="w-20 h-20 rounded-xl overflow-hidden flex-none"><img src="img/a6610a1bee6c.png" class="w-full h-full object-cover"/></div>
    <div><h1 class="font-headline text-xl text-ink leading-tight">Warm Tahini Grain Bowl</h1><p class="font-body text-[13px] text-ink-faint mt-0.5">4 servings · 25 min</p></div>
  </div>
  <section class="bg-surface-card border border-line rounded-2xl p-5">
    <div class="flex items-center justify-between mb-3"><span class="font-headline text-lg text-ink">We worked out the nutrition</span><span class="inline-flex items-center gap-1 text-sage font-label text-[11px] font-semibold">${ico('circle-check','text-[14px]')} High confidence</span></div>
    <div class="flex"><div class="flex-1 text-center"><p class="font-headline text-2xl text-ink">580</p><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">kcal</p></div>
      <div class="flex-1 text-center"><p class="font-headline text-2xl text-macro-protein">38g</p><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">protein</p></div>
      <div class="flex-1 text-center"><p class="font-headline text-2xl text-macro-carbs">52g</p><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">carbs</p></div>
      <div class="flex-1 text-center"><p class="font-headline text-2xl text-macro-fat">18g</p><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">fat</p></div></div>
  </section>
  <section>
    <h2 class="font-headline text-lg text-ink mb-1">Ingredients we found</h2>
    <div>
      ${parsed('Cooked quinoa','200 g',true)}
      ${parsed('Avocado','1',true)}
      ${parsed('Chickpeas','1 tin',true)}
      ${parsed('Tahini — "a drizzle"','tap to set',false)}
      ${parsed('Lemon &amp; herbs','to taste',true)}
    </div>
    <p class="font-body text-xs text-ink-faint mt-3">One amount was vague — tap to confirm so the nutrition stays accurate.</p>
  </section>
  <div class="flex gap-3">
    <button class="flex-1 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3.5">Edit</button>
    <button class="flex-[2] bg-clay text-white font-body font-semibold text-sm rounded-full py-3.5">Looks right — save</button>
  </div>
</main>`;

/* ---------------- DISCOVER (Recipes tab · Discover) ---------------- */
function feedCard(img, title, creator, likes){
  return `<div class="recipe-card cursor-pointer rounded-2xl overflow-hidden bg-surface-card border border-line">
    <div class="aspect-[4/3] overflow-hidden relative"><img src="img/${img}" class="w-full h-full object-cover"/>
      <span class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-ink">${ico('bookmark','text-[16px]')}</span></div>
    <div class="p-3">
      <p class="font-headline text-[15px] text-ink leading-tight">${title}</p>
      <div class="flex items-center gap-1.5 mt-2"><span class="w-5 h-5 rounded-full bg-damson flex items-center justify-center text-white font-label text-[9px]">${creator[0]}</span><span class="font-body text-[12px] text-ink-soft flex-1 truncate">${creator}</span><span class="font-body text-[12px] text-ink-faint flex items-center gap-0.5">${ico('heart','text-[13px]')} ${likes}</span></div>
    </div>
  </div>`;
}
const discover = `
${appBar()}
<main class="px-5 pt-5 pb-6 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Recipes</h1>
  <div class="flex gap-6 border-b border-line mt-4 mb-5">
    <span class="font-body text-[15px] text-ink-faint pb-3">Library</span>
    <span class="font-body text-[15px] text-ink font-semibold pb-3 border-b-2 border-ink -mb-px">Discover</span>
  </div>
  <div class="flex items-center gap-2 mb-4 overflow-x-auto -mx-5 px-5 pb-1">
    ${['All','Trending','Quick 30','Under 500 cal','High protein','From Reels','Breakfast','Dinner','Dessert','Soup','Pasta','Chicken'].map((c,i)=>`<span class="font-label text-[13px] font-medium px-3.5 py-2 rounded-full whitespace-nowrap ${i===0?'bg-clay text-white':'bg-surface-card border border-line text-ink-soft'}">${c}</span>`).join('')}
  </div>
  <!-- Collections (count badges) -->
  <h3 class="font-headline text-xl text-ink mb-3">Popular collections</h3>
  <div class="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1 mb-6">
    ${[['1eded18039f9.png','High-protein dinners','24'],['a6610a1bee6c.png','Under 500 calories','31'],['babbc6edccce.png','30-minute meals','18'],['e427c86a0d4f.png','Cosy breakfasts','15']].map(([img,t,n])=>`<div class="snap-start shrink-0 w-[180px] rounded-2xl overflow-hidden relative"><img src="img/${img}" class="w-full h-28 object-cover"/><div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div><span class="absolute top-2 right-2 w-9 h-9 rounded-full bg-clay text-white flex items-center justify-center font-headline text-[15px]">${n}</span><p class="absolute bottom-0 p-3 font-headline text-[15px] text-white leading-tight">${t}</p></div>`).join('')}
  </div>
  <!-- Recipes in action (short-form video) -->
  <div class="flex items-end justify-between mb-3"><h3 class="font-headline text-xl text-ink">Recipes in action</h3><a class="font-body text-sm text-clay font-medium">See all</a></div>
  <div class="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1 mb-6">
    ${[['a6610a1bee6c.png','Warm Tahini Bowl','0:32'],['babbc6edccce.png','Three Cheese Fusilli','0:45'],['1eded18039f9.png','Chicken Kale Salad','0:28'],['7a448cef1613.png','Crispy Gnocchi','0:51']].map(([img,t,dur])=>`<div class="snap-start shrink-0 w-[128px]"><div class="relative rounded-2xl overflow-hidden aspect-[9/16]"><img src="img/${img}" class="w-full h-full object-cover"/><div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div><span class="absolute top-2 left-2 w-7 h-7 rounded-full bg-white/85 flex items-center justify-center text-ink">${ico('play','text-[13px]')}</span><span class="absolute bottom-2 right-2 font-label text-[10px] font-semibold text-white bg-black/45 rounded px-1.5 py-0.5">${dur}</span></div><p class="font-body text-[13px] text-ink mt-2 leading-tight">${t}</p></div>`).join('')}
  </div>
  <h3 class="font-headline text-xl text-ink mb-3">What others are saving</h3>
  <div class="grid grid-cols-2 gap-3">
    ${feedCard('a6610a1bee6c.png','Warm Tahini Grain Bowl','gatherednutrition','2.4k')}
    ${feedCard('babbc6edccce.png','Three Cheese Fusilli','pastaposse','1.1k')}
    ${feedCard('e427c86a0d4f.png','Blueberry Baked Oats','morningoats','3.8k')}
    ${feedCard('1eded18039f9.png','Chicken Kale Salad','leanlunches','842')}
  </div>
</main>
${tabBar('Recipes')}`;

/* ---------------- CREATOR PROFILE ---------------- */
const creator = `
${backHeader('Creator', ico('ellipsis'))}
<main class="pb-10 max-w-2xl mx-auto">
  <div class="px-5 pt-4 flex items-center gap-4">
    <span class="w-20 h-20 rounded-full bg-damson flex items-center justify-center text-white font-headline text-3xl flex-none">G</span>
    <div class="flex-1">
      <h1 class="font-headline text-2xl text-ink leading-tight">Gathered Nutrition</h1>
      <p class="font-body text-[13px] text-ink-faint">@gatherednutrition</p>
    </div>
  </div>
  <div class="px-5 mt-4 flex gap-8">
    <div><span class="font-headline text-xl text-ink">48</span> <span class="font-body text-[13px] text-ink-faint">recipes</span></div>
    <div><span class="font-headline text-xl text-ink">12.6k</span> <span class="font-body text-[13px] text-ink-faint">saves</span></div>
  </div>
  <p class="px-5 mt-3 font-body text-sm text-ink-soft leading-relaxed">High-protein bowls and warm, seasonal cooking. Every recipe macro-checked so it fits your day.</p>
  <div class="px-5 mt-4 flex gap-3">
    <button class="flex-[2] bg-clay text-white font-body font-semibold text-sm rounded-full py-3">Follow</button>
    <button class="flex-1 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3">Share</button>
  </div>
  <div class="px-5 mt-7">
    <h2 class="font-headline text-lg text-ink mb-3">Recipes</h2>
    <div class="grid grid-cols-2 gap-3">
      ${['a6610a1bee6c.png','e427c86a0d4f.png','babbc6edccce.png','1eded18039f9.png'].map(i=>`<div class="rounded-2xl overflow-hidden bg-surface-card border border-line"><div class="aspect-square overflow-hidden"><img src="img/${i}" class="w-full h-full object-cover"/></div></div>`).join('')}
    </div>
  </div>
</main>`;

console.log(writeScreen('create-recipe.html','Sloe · New recipe', create));
console.log(writeScreen('recipe-verify.html','Sloe · Check recipe', verify));
console.log(writeScreen('discover.html','Sloe · Discover', discover));
console.log(writeScreen('creator.html','Sloe · Creator', creator));
