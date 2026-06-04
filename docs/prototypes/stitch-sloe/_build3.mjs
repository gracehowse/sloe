import { writeScreen, ico, backHeader } from './_gen.mjs';

const checkEmpty = `<span class="w-6 h-6 rounded-full border-[1.5px] border-line flex-none"></span>`;
const checkDone = `<span class="w-6 h-6 rounded-full bg-sage flex items-center justify-center flex-none text-white">${ico('check','text-[14px]')}</span>`;

/* ---------------- SHOPPING ---------------- */
// img = ing-* / allergen-* thumbnail; sub = "Used in N recipes"
function shopItem(img, name, sub, qty, done){
  return `<div class="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
    ${done?checkDone:checkEmpty}
    <span class="w-10 h-10 rounded-lg overflow-hidden bg-surface flex-none flex items-center justify-center"><img src="img/${img}.png" class="w-full h-full object-contain mix-blend-multiply ${done?'opacity-50':''}"/></span>
    <div class="flex-1 min-w-0"><p class="font-body text-[15px] ${done?'text-ink-faint line-through':'text-ink'} leading-tight">${name}</p>${sub?`<p class="font-body text-xs text-ink-faint">${sub}</p>`:''}</div>
    <span class="font-body text-sm ${done?'text-ink-faint':'text-ink-soft'}">${qty}</span>
  </div>`;
}
function shopSection(title, items){
  return `<section class="bg-surface-card border border-line rounded-2xl px-4 py-1">
    <div class="flex items-center justify-between py-2.5"><h2 class="font-headline text-lg text-ink">${title}</h2>${ico('chevron-down','text-ink-faint text-[18px]')}</div>
    ${items}
  </section>`;
}
const shopping = `
${backHeader('Shopping list', ico('share-2'))}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-5">
  <div class="flex items-center gap-2">
    <div class="flex -space-x-2">${['a6610a1bee6c','babbc6edccce','e427c86a0d4f'].map(i=>`<span class="w-8 h-8 rounded-full border-2 border-surface overflow-hidden"><img src="img/${i}.png" class="w-full h-full object-cover"/></span>`).join('')}</div>
    <span class="font-body text-[13px] text-ink-soft">from 4 planned meals · 12 items</span>
  </div>
  ${shopSection('Produce', shopItem('ing-avocado','Avocado','Used in 1 recipe','2')+shopItem('ing-cherry-tomatoes','Cherry tomatoes','Used in 2 recipes','250 g')+shopItem('ing-spinach','Baby spinach','Used in 1 recipe','1 bag',true))}
  ${shopSection('Dairy &amp; eggs', shopItem('ing-greek-yoghurt','Greek yoghurt','Used in 1 recipe','500 g')+shopItem('allergen-eggs','Brown eggs','Used in 2 recipes','6')+shopItem('ing-parmesan','Parmesan','Used in 1 recipe','80 g'))}
  ${shopSection('Pantry', shopItem('ing-chickpeas','Chickpeas','Used in 1 recipe','1 tin')+shopItem('ing-fusilli','Fusilli pasta','Used in 1 recipe','500 g',true)+shopItem('ing-tahini','Tahini','Used in 2 recipes','1 jar'))}
  <button class="w-full flex items-center justify-center gap-2 font-body text-sm font-semibold text-clay py-2">${ico('plus','text-[18px]')} Add custom item</button>
</main>`;

/* ---------------- TARGETS ---------------- */
function macroSlider(name, val, pct, colorHex, colorCls){
  return `<div class="py-3.5 border-b border-line last:border-0">
    <div class="flex items-center justify-between mb-2.5"><span class="font-body text-sm font-medium text-ink">${name}</span><span class="font-body text-sm text-ink-soft"><span class="font-semibold ${colorCls}">${val}</span> · ${pct}%</span></div>
    <div class="relative h-1.5 rounded-full bg-line"><div class="absolute left-0 top-0 h-1.5 rounded-full" style="width:${pct}%;background:${colorHex}"></div><div class="absolute -top-1.5 w-4.5 h-4.5 rounded-full bg-surface border-2 shadow-sm" style="left:calc(${pct}% - 9px);width:18px;height:18px;border-color:${colorHex}"></div></div>
  </div>`;
}
const targets = `
${backHeader('Targets')}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-7">
  <div class="flex gap-2">${['Lose','Maintain','Gain'].map((g,i)=>`<span class="flex-1 text-center font-label text-[13px] font-semibold py-2.5 rounded-full ${i===0?'bg-plum text-white':'bg-surface-card border border-line text-ink-soft'}">${g}</span>`).join('')}</div>
  <section class="bg-surface-card border border-line rounded-2xl p-6 text-center">
    <p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Daily calorie goal</p>
    <div class="flex items-baseline justify-center gap-2 mt-1"><span class="font-headline text-5xl text-ink">2,040</span><span class="font-body text-lg text-ink-soft">kcal</span></div>
    <p class="font-body text-[13px] text-ink-faint mt-1">−410 / day from your 2,450 TDEE · ~0.4 kg/wk</p>
  </section>
  <section>
    <div class="flex items-center justify-between mb-1"><h2 class="font-headline text-xl text-ink">Macros</h2><span class="inline-flex bg-surface-card border border-line rounded-full text-[12px] font-semibold"><span class="px-3 py-1 rounded-full bg-plum text-white">g</span><span class="px-3 py-1 text-ink-faint">%</span></span></div>
    ${macroSlider('Protein','140 g',28,'#7C8466','text-macro-protein')}
    ${macroSlider('Carbs','200 g',40,'#C8794E','text-macro-carbs')}
    ${macroSlider('Fat','68 g',32,'#C9892C','text-macro-fat')}
    <p class="font-body text-xs text-ink-faint mt-3 flex items-center gap-1.5">${ico('refresh-cw','text-[13px]')} Balanced to 100% of your calorie goal</p>
  </section>
  <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Save targets</button>
</main>`;

/* ---------------- HOUSEHOLD ---------------- */
function member(initial, bg, name, role, owner){
  return `<div class="flex items-center gap-3 py-3.5 border-b border-line last:border-0">
    <span class="w-10 h-10 rounded-full flex items-center justify-center text-white font-headline text-lg flex-none" style="background:${bg}">${initial}</span>
    <div class="flex-1"><p class="font-headline text-[15px] text-ink leading-tight">${name}</p><p class="font-body text-xs text-ink-faint">${role}</p></div>
    ${owner?'<span class="font-label text-[10px] uppercase tracking-[0.06em] text-clay bg-clay-soft px-2 py-1 rounded-full">Owner</span>':ico('chevron-right','text-ink-faint text-[18px]')}
  </div>`;
}
function toggle(label, on){
  return `<div class="flex items-center justify-between py-3.5 border-b border-line last:border-0"><span class="font-body text-[15px] text-ink">${label}</span><span class="w-11 h-6 rounded-full ${on?'bg-sage':'bg-line'} relative flex-none"><span class="absolute top-0.5 ${on?'right-0.5':'left-0.5'} w-5 h-5 rounded-full bg-white shadow-sm"></span></span></div>`;
}
const household = `
${backHeader('Household')}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-7">
  <p class="font-body text-sm text-ink-soft">Share recipes, meal plans and shopping lists with the people you cook for.</p>
  <section>
    <h2 class="font-headline text-xl text-ink mb-1">Members</h2>
    <div class="bg-surface-card border border-line rounded-2xl px-4">
      ${member('G','#6A4B7A','Grace','You','owner')}
      ${member('T','#5E7C5A','Tom','Can edit plan &amp; shopping')}
      ${member('M','#C8794E','Maya','View only')}
    </div>
    <button class="w-full mt-3 flex items-center justify-center gap-2 font-body text-sm font-semibold text-clay py-2">${ico('user-plus','text-[18px]')} Invite someone</button>
  </section>
  <section>
    <h2 class="font-headline text-xl text-ink mb-1">Shared with household</h2>
    <div class="bg-surface-card border border-line rounded-2xl px-4">
      ${toggle('Meal plan',true)}
      ${toggle('Shopping list',true)}
      ${toggle('Saved recipes',false)}
    </div>
  </section>
  <button class="w-full text-destructive font-body font-semibold text-sm py-2">Leave household</button>
</main>`;

console.log(writeScreen('shopping.html','Sloe · Shopping list', shopping));
console.log(writeScreen('targets.html','Sloe · Targets', targets));
console.log(writeScreen('household-settings.html','Sloe · Household', household));
