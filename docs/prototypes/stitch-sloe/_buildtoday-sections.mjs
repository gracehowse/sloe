import { writeScreen, ico, appBar, tabBar } from './_gen.mjs';

/* ============================================================
   Today/Plan deep sections the hero frames skipped (2026-06-03).
   Each anchored to a named best-in-class benchmark.
   TD1 Activity & energy  → MacroFactor (equation) + Bevel (net bar)
   TD2 Hydration & stim   → Bevel (gauge/quick-add)
   TD3 Weekly insight     → Fitbit (narrative) + Planned preview
   TD4 Detailed meal log  → MyFitnessPal (per-meal) + Lifesum (warmth)
   TD5 Plan — week view   → Lifesum/Centr (per-day + swap) + targets
   ============================================================ */

const overline = (t,cls='text-ink-faint') => `<span class="font-label text-[10px] uppercase tracking-[0.12em] ${cls} font-semibold">${t}</span>`;
const card = (inner) => `<section class="mb-5"><div class="bg-surface-card rounded-xl border border-line overflow-hidden">${inner}</div></section>`;
const cardHead = (title, right='') => `<div class="px-5 pt-5 pb-3 flex items-center justify-between"><h3 class="font-headline text-xl text-plum">${title}</h3>${right}</div>`;
const wrap = (mainInner, active='Today') => `<div id="cap" class="mx-auto bg-surface" style="width:500px;min-height:100vh;position:relative">
${appBar()}
<main class="pt-3 px-4 pb-12">${mainInner}</main>
${tabBar(active)}
</div>`;
const pageTitle = (t,sub) => `<section class="mt-2 mb-5"><h2 class="font-headline text-2xl text-plum">${t}</h2>${sub?`<p class="font-body text-sm text-ink-soft">${sub}</p>`:''}</section>`;

/* ---------- TD1 · Activity & energy ---------- */
function stepsCard(){
  return card(`${cardHead('Steps &amp; activity', `<span class="font-body text-xs text-ink-faint">Today</span>`)}
    <div class="px-5 pb-5 space-y-4">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="flex items-center gap-2.5 font-body text-[15px] text-ink">${ico('footprints','text-lg text-ink-soft')} Steps</span>
          <span class="font-headline text-lg text-ink tabular-nums">217 <span class="font-body text-sm text-ink-faint">/ 10,000</span></span>
        </div>
        <div class="h-1.5 w-full bg-line rounded-full overflow-hidden"><div class="h-full rounded-full bg-clay" style="width:2.2%"></div></div>
      </div>
      <div class="flex items-center justify-between border-t border-line pt-4">
        <span class="flex items-center gap-2.5 font-body text-[15px] text-ink"><span style="color:#D6A24A">${ico('flame','text-lg')}</span> Active energy</span>
        <span class="font-headline text-lg text-ink tabular-nums">26 <span class="font-body text-sm text-ink-faint">kcal</span></span>
      </div>
    </div>`);
}
function energyCard(){
  const eq = [['Burned','553','flame','#D6A24A'],['Eaten','0','utensils','#6A6072'],['Maintenance','1,216','target','#6A6072']];
  return card(`${cardHead('Energy balance', `<span class="text-ink-faint">${ico('info','text-base')}</span>`)}
    <div class="px-5 pb-5 -mt-1">
      <div class="flex items-baseline gap-2 mb-1"><span class="font-headline text-[40px] leading-none text-sage tabular-nums">553</span><span class="font-body text-sm text-ink-soft">kcal net deficit</span></div>
      <p class="font-body text-xs text-ink-faint mb-5">You've burned 553 more than you've eaten today.</p>
      <div class="relative h-2 rounded-full mb-2" style="background:linear-gradient(90deg,#5E7C5A 0%,#EDEAF1 50%,#C9892C 100%)">
        <div class="absolute top-1/2 w-4 h-4 rounded-full bg-white shadow" style="left:24%;transform:translate(-50%,-50%);border:2px solid #5E7C5A"></div>
      </div>
      <div class="flex justify-between font-label text-[10px] uppercase tracking-wide text-ink-faint mb-5"><span>Deficit</span><span>Maintenance</span><span>Surplus</span></div>
      <div class="grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
        ${eq.map(([l,v,i,c])=>`<div class="px-2 text-center"><span class="flex items-center justify-center gap-1.5 mb-1.5" style="color:${c}">${ico(i,'text-[15px]')}<span class="font-label text-[10px] uppercase tracking-wide text-ink-faint">${l}</span></span><span class="font-headline text-lg text-ink tabular-nums">${v}</span></div>`).join('')}
      </div>
      <p class="text-center font-body text-xs text-ink-soft mt-4">Calorie goal today · <span class="text-ink font-medium">901 kcal</span></p>
    </div>`);
}
function rollingCard(){
  const rows=[['Avg daily deficit','455 kcal'],['Weekly deficit','4,729 kcal'],['Projected weekly loss','0.61 kg']];
  return `<section class="mb-5"><div class="bg-surface-card rounded-xl border border-line p-5">
    <div class="flex items-center gap-2 mb-4">${ico('trending-down','text-base text-sage')} ${overline('7-day rolling')}</div>
    <div class="space-y-3">${rows.map(([l,v])=>`<div class="flex items-center justify-between"><span class="font-body text-sm text-ink-soft">${l}</span><span class="font-headline text-base text-sage tabular-nums">${v}</span></div>`).join('')}</div>
  </div></section>`;
}

/* ---------- TD2 · Hydration & stimulants ---------- */
function hydrationCard(){
  const chips=['+100 ml','+250 ml','+500 ml','+750 ml'];
  return card(`${cardHead('Hydration')}
    <div class="px-5 pb-5">
      <div class="flex items-end justify-between mb-3">
        <span class="flex items-center gap-2.5 font-body text-[15px] text-ink"><span style="color:#4A7878">${ico('droplet','text-lg')}</span> Water</span>
        <span class="font-headline text-2xl text-ink tabular-nums">0 <span class="font-body text-sm text-ink-faint">ml / 1.8 L</span></span>
      </div>
      <div class="h-2 w-full bg-line rounded-full overflow-hidden mb-4"><div class="h-full rounded-full" style="width:0%;background:#4A7878"></div></div>
      <div class="grid grid-cols-4 gap-2">${chips.map(c=>`<button class="font-body text-[13px] text-ink bg-frost-mist rounded-full py-2 border border-line/60">${c}</button>`).join('')}</div>
    </div>`);
}
function stimulantsCard(){
  const rows=[['coffee','Caffeine','#6A4B7A','0','400 mg',0],['wine','Alcohol','#C9892C','0','14 units',0]];
  return card(`${cardHead('Stimulants', `<span class="font-body text-xs text-ink-faint">This week</span>`)}
    <div class="px-5 pb-5 space-y-4">
      ${rows.map(([i,n,c,v,lim,pct],idx)=>`<div class="${idx>0?'border-t border-line pt-4':''}">
        <div class="flex items-center justify-between mb-2">
          <span class="flex items-center gap-2.5 font-body text-[15px] text-ink"><span style="color:${c}">${ico(i,'text-lg')}</span> ${n}</span>
          <span class="font-headline text-base text-ink tabular-nums">${v} <span class="font-body text-sm text-ink-faint">/ ${lim}</span></span>
        </div>
        <div class="h-1.5 w-full bg-line rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${c}"></div></div>
      </div>`).join('')}
    </div>`);
}

/* ---------- TD3 · Weekly insight + Planned ---------- */
function weeklyInsightCard(){
  const week=[1,1,1,0,1,0,0];
  const stats=[['4 / 7','Days logged'],['1,840','Avg intake'],['4 days','On target']];
  return `<section class="mb-6"><div class="bg-frost-mist/50 rounded-xl border border-line p-5">
    <div class="flex items-center gap-2 mb-2"><span class="text-clay">${ico('sparkles','text-[15px]')}</span> ${overline('Weekly insight','text-clay')}</div>
    <h4 class="font-headline text-xl text-plum mb-3.5">You're trending right where you want to be</h4>
    <div class="grid grid-cols-3 divide-x divide-line mb-4">${stats.map(([v,l])=>`<div class="text-center px-1"><span class="block font-headline text-lg text-ink tabular-nums">${v}</span><span class="font-label text-[9px] uppercase tracking-wide text-ink-faint">${l}</span></div>`).join('')}</div>
    <div class="flex gap-1.5 mb-3.5">${week.map(f=>`<div class="flex-1 h-2 rounded-full ${f?'bg-clay':'bg-line'}"></div>`).join('')}</div>
    <p class="font-body text-[13px] text-ink-soft flex items-center gap-1.5"><span class="text-sage shrink-0">${ico('circle-check','text-[14px]')}</span> Protein above goal 4 days running — keep it going.</p>
  </div></section>`;
}
function plannedSection(){
  const meals=[['Chicken Frittata','191 kcal','27','2','9'],['Homemade Cream Cheese / Labneh','34 kcal','7','2','0']];
  return `<section class="mb-8"><h3 class="font-headline text-2xl text-plum mb-4">Planned</h3>
    <div class="bg-surface-card rounded-xl border border-line divide-y divide-line">
    ${meals.map(([t,k,p,c,f])=>`<div class="flex items-center gap-4 p-4">
      <div class="flex-1 min-w-0"><h4 class="font-headline text-lg text-ink truncate">${t}</h4>
      <p class="font-body text-xs text-ink-soft mt-0.5 tabular-nums">${k} · <span style="color:#7C8466">${p}g P</span> · <span style="color:#C8794E">${c}g C</span> · <span style="color:#C9892C">${f}g F</span></p></div>
      <button class="font-label text-xs uppercase tracking-wide font-semibold text-clay shrink-0">Log today</button>
    </div>`).join('')}
    </div></section>`;
}

/* ---------- TD4 · Detailed meal log ---------- */
function macroMini(p,c,f,fi){
  return `<span class="flex items-center gap-2.5 font-body text-[11px] tabular-nums mt-0.5">
    <span style="color:#7C8466">${p}g</span><span style="color:#C8794E">${c}g</span><span style="color:#C9892C">${f}g</span><span style="color:#4A7878">${fi}g</span></span>`;
}
function mealBlock(icon, slot, kcal, m, usual, usualTone, items){
  const toneMap={clay:['bg-clay/10','text-clay'],amber:['bg-amber/10','text-amber'],damson:['bg-damson/10','text-damson'],sage:['bg-sage/12','text-sage']};
  const [ub,ut]=toneMap[usualTone]||toneMap.clay;
  return `<div class="bg-surface-card rounded-xl border border-line overflow-hidden mb-3">
    <div class="flex items-center gap-3 px-4 py-3.5 border-b border-line">
      <span class="w-9 h-9 rounded-lg bg-frost-mist flex items-center justify-center text-plum shrink-0">${ico(icon,'text-lg')}</span>
      <div class="flex-1 min-w-0"><h4 class="font-headline text-lg text-ink leading-tight">${slot}</h4><span class="flex items-center gap-2.5 font-body text-[11px] tabular-nums"><span class="text-ink-soft">${kcal} kcal</span>${macroMini(...m)}</span></div>
      <span class="text-ink-faint">${ico('chevron-up','text-lg')}</span>
    </div>
    <div class="px-4 py-3 space-y-3">
      ${usual?`<div class="flex"><span class="inline-flex items-center gap-2 ${ub} ${ut} font-body text-[12px] font-medium px-3 py-1.5 rounded-full">${ico('refresh-cw','text-[13px]')} Log usual: ${usual}</span></div>`:''}
      ${items.map(([n,k])=>`<div class="flex items-center gap-3"><span class="w-1.5 h-1.5 rounded-full bg-sage shrink-0"></span><span class="flex-1 font-body text-[14px] text-ink truncate">${n}</span><span class="font-body text-[13px] text-ink-soft tabular-nums shrink-0">${k} <span class="text-ink-faint">kcal</span></span><span class="text-ink-faint">${ico('chevron-right','text-base')}</span></div>`).join('')}
      <button class="flex items-center gap-2 pt-0.5 text-clay font-body text-[13px] font-medium">${ico('plus','text-[15px]')} Add food</button>
    </div>
  </div>`;
}
function fiberBar(){
  return `<section class="mb-5"><div class="bg-surface-card rounded-xl border border-line p-4">
    <div class="flex items-center justify-between mb-2"><span class="font-label text-[11px] uppercase tracking-wide text-ink-faint">Fibre</span><span class="font-body text-sm text-ink tabular-nums">6 <span class="text-ink-faint">/ 15 g · 9 g left</span></span></div>
    <div class="h-1.5 w-full bg-line rounded-full overflow-hidden"><div class="h-full rounded-full bg-sage" style="width:40%"></div></div>
  </div></section>`;
}
function mealLog(){
  return fiberBar() + `<section class="mb-8">
    ${mealBlock('coffee','Breakfast','217',['12','20','9','0.6'],'Chilli Feta Eggs with Hashbro…','amber',[["McAlister's Deli · Ham and Cheese Toastie",'217']])}
    ${mealBlock('sun','Lunch','107',['1','12','6','1.4'],'',null,[['Smartfood · Smart 50 White Cheddar Popcorn','107']])}
    ${mealBlock('utensils','Dinner','670',['39','80','21','4'],'Pad Thai','damson',[['Pan Con Tomate','153'],['Jamon','98'],['Sourdough','272'],['Labneh','147']])}
    ${mealBlock('cookie','Snacks','298',['0','9','0','0'],'Snacks…','sage',[['Red wine','298']])}
  </section>`;
}

/* ---------- TD5 · Plan — week view ---------- */
function planHeader(){
  return `<header class="w-full bg-surface px-5 pt-3 pb-3 flex items-start justify-between">
    <div><h1 class="font-headline text-2xl font-semibold text-plum tracking-tight">Meal plan</h1><p class="font-body text-sm text-ink-soft mt-0.5">Week of June 3</p></div>
    <button class="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink-soft mt-1">${ico('sliders-horizontal','text-base')}</button>
  </header>`;
}
function planTabs(){
  return `<div class="flex border-b border-line px-5 -mt-1 mb-4">
    <span class="font-body text-[15px] font-semibold text-ink pb-3 border-b-2 border-ink">This week</span>
    <span class="font-body text-[15px] text-ink-faint pb-3 ml-7">Shopping list</span>
  </div>`;
}
function planTargetsCard(){
  return `<div class="mx-1 mb-5 bg-frost-mist/50 rounded-xl border border-line p-5">
    ${overline('3 Jun – 9 · Meal plan')}
    <h3 class="font-headline text-xl text-amber mt-1.5 mb-1">Hits your targets 3 of 7 days</h3>
    <p class="font-body text-sm text-ink-soft mb-4">Some days run over target. Tap a meal to swap or adjust the portion.</p>
    <div class="flex gap-3">
      <button class="flex-1 bg-clay text-white font-body text-sm font-semibold rounded-full py-2.5 flex items-center justify-center gap-2">${ico('refresh-cw','text-base')} Generate</button>
      <button class="flex-1 bg-surface border border-line text-ink font-body text-sm font-semibold rounded-full py-2.5 flex items-center justify-center gap-2">${ico('sliders-horizontal','text-base')} Adjust constraints</button>
    </div>
  </div>`;
}
function planDay(){
  const meals=[
    ['Breakfast','Cuban Ropa Vieja','460','babbc6edccce.png',''],
    ['Lunch','Shakshuka with Eggs','205','1eded18039f9.png','0.5× portion'],
    ['Dinner','Homemade Cream Cheese / Labneh','67','',''],
    ['Snacks','Peruvian Ceviche','290','a6610a1bee6c.png',''],
  ];
  return `<section class="px-1">
    <div class="flex items-center justify-between mb-1">
      <span class="font-headline text-lg text-ink">Wed <span class="font-label text-[10px] uppercase tracking-wide text-ink-faint align-middle ml-1">Today</span></span>
      <span class="font-body text-sm text-amber tabular-nums">1,022 / 901 kcal</span>
    </div>
    <div class="flex items-center gap-3 font-body text-[12px] tabular-nums mb-3 pb-3 border-b border-line">
      <span style="color:#7C8466">P 94g ✓</span><span style="color:#C8794E">C 62g ✓</span><span style="color:#C9892C">F 42g +17</span><span style="color:#4A7878">Fi 11g -4</span>
    </div>
    <div class="space-y-3">
    ${meals.map(([slot,t,k,img,note])=>`<div class="flex items-center gap-3.5 bg-surface-card rounded-xl border border-line p-3">
      <div class="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-line/60 bg-frost-mist">${img?`<img src="./img/${img}" class="w-full h-full object-cover"/>`:''}</div>
      <div class="flex-1 min-w-0"><span class="font-label text-[10px] uppercase tracking-wide text-plum">${slot}</span><h4 class="font-headline text-[15px] text-ink truncate leading-tight">${t}</h4>${note?`<span class="inline-block font-body text-[10px] text-ink-faint bg-frost-mist px-1.5 py-0.5 rounded mt-1">${note}</span>`:''}<p class="font-body text-xs text-ink-soft tabular-nums mt-0.5">${k} kcal</p></div>
      <button class="w-9 h-9 rounded-lg bg-frost-mist flex items-center justify-center text-clay shrink-0" title="Swap">${ico('refresh-cw','text-[16px]')}</button>
    </div>`).join('')}
    </div>
  </section>`;
}

/* ---------------- WRITE ---------------- */
const td1 = `${pageTitle('Activity &amp; energy','Wednesday, 3 June')}${stepsCard()}${energyCard()}${rollingCard()}`;
const td2 = `${pageTitle('Hydration &amp; stimulants','Wednesday, 3 June')}${hydrationCard()}${stimulantsCard()}`;
const td3 = `${pageTitle('This week','Wednesday, 3 June')}${weeklyInsightCard()}${plannedSection()}`;
const td4 = `${pageTitle('Today’s meals','Wednesday, 3 June')}${mealLog()}`;

console.log(writeScreen('today-activity.html','Sloe · Today — Activity & energy', wrap(td1)));
console.log(writeScreen('today-hydration.html','Sloe · Today — Hydration & stimulants', wrap(td2)));
console.log(writeScreen('today-insight.html','Sloe · Today — Weekly insight & planned', wrap(td3)));
console.log(writeScreen('today-meallog.html','Sloe · Today — Meal log', wrap(td4)));
// TD5 Plan uses its own header (not the generic appBar) + Plan tab active.
const td5body = `<div id="cap" class="mx-auto bg-surface" style="width:500px;min-height:100vh;position:relative">
${planHeader()}${planTabs()}<main class="px-4 pb-12">${planTargetsCard()}${planDay()}</main>${tabBar('Plan')}
</div>`;
console.log(writeScreen('plan-week.html','Sloe · Plan — Week view', td5body));
