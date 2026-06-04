import { writeScreen, ico, backHeader } from './_gen.mjs';

/* ---------------- PAYWALL ---------------- */
function feat(icon, title, body){
  return `<div class="bg-surface-card border border-line rounded-2xl p-5">
    <span class="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center text-clay mb-4">${ico(icon,'text-[18px]')}</span>
    <h3 class="font-headline text-lg text-ink leading-tight">${title}</h3>
    <p class="font-body text-[13px] text-ink-soft mt-1 leading-relaxed">${body}</p></div>`;
}
function cmpRow(label, pro, free){
  return `<div class="grid grid-cols-[1fr_64px_64px] items-center border-b border-line/60 last:border-0">
    <div class="py-3.5 font-body text-sm text-ink">${label}</div>
    <div class="py-3.5 flex justify-center">${free?ico('check','text-sage text-[18px]'):'<span class="w-3.5 h-px bg-line"></span>'}</div>
    <div class="py-3.5 flex justify-center bg-frost-mist/50">${ico('check','text-sage text-[18px]')}</div></div>`;
}
const paywall = `
<div class="relative">
  <button class="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/85 backdrop-blur flex items-center justify-center text-ink">${ico('x','text-[18px]')}</button>
  <div class="relative w-full h-[44vh] min-h-[360px]">
    <img src="img/a6610a1bee6c.png" class="absolute inset-0 w-full h-full object-cover"/>
    <div class="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent"></div>
    <div class="absolute bottom-0 left-0 w-full px-6 pb-6">
      <p class="font-label text-xs tracking-[0.12em] uppercase text-damson font-semibold mb-2">Sloe Pro</p>
      <h1 class="font-headline text-4xl text-ink leading-tight">Cook what you love.<br/><span class="italic">Still</span> reach your goals.</h1>
    </div>
  </div>
</div>
<main class="px-5 pb-32 -mt-2 max-w-2xl mx-auto space-y-6">
  <div class="grid grid-cols-2 gap-3">
    ${feat('link','Unlimited imports','Save any recipe from a link or Reel.')}
    ${feat('sliders-horizontal','Macro fitting','Auto-fit any recipe to your day.')}
    ${feat('brain','AI coach','Personalised, guilt-free nudges.')}
    ${feat('cloud','Cloud sync','Your journal, safe on every device.')}
  </div>
  <div class="bg-surface-card border border-line rounded-2xl px-4">
    <div class="grid grid-cols-[1fr_64px_64px] border-b border-line"><div></div><div class="py-3 text-center font-label text-[11px] uppercase tracking-wide text-ink-faint">Free</div><div class="py-3 text-center font-label text-[11px] uppercase tracking-wide text-plum bg-frost-mist/50">Pro</div></div>
    ${cmpRow('Log meals & macros','',true)}
    ${cmpRow('Browse community recipes','',true)}
    ${cmpRow('Unlimited imports','',false)}
    ${cmpRow('AI macro fitting','',false)}
  </div>
  <div class="space-y-3">
    <div class="relative border-2 border-clay rounded-2xl p-4 flex items-center justify-between">
      <span class="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-clay text-white font-label text-[10px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full">Best value</span>
      <div class="flex items-center gap-3"><span class="w-4 h-4 rounded-full bg-clay flex items-center justify-center">${ico('check','text-white text-[10px]')}</span><div><p class="font-headline text-[16px] text-ink">Annual</p><p class="font-body text-xs text-sage">Save 28%</p></div></div>
      <div class="text-right"><p class="font-headline text-xl text-ink">£19.99<span class="text-sm text-ink-soft">/yr</span></p><p class="font-body text-xs text-ink-faint">just £1.66/mo</p></div>
    </div>
    <div class="border border-line rounded-2xl p-4 flex items-center justify-between">
      <div class="flex items-center gap-3"><span class="w-4 h-4 rounded-full border border-line"></span><p class="font-headline text-[16px] text-ink">Monthly</p></div>
      <p class="font-headline text-xl text-ink">£2.99<span class="text-sm text-ink-soft">/mo</span></p>
    </div>
  </div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface/95 backdrop-blur border-t border-line px-5 pt-3 pb-7">
  <div class="flex justify-center gap-5 mb-2 font-body text-[12px] text-ink-soft"><span class="flex items-center gap-1.5">${ico('lock','text-[14px]')} Secure checkout</span><span class="flex items-center gap-1.5">${ico('calendar-x','text-[14px]')} Cancel anytime</span></div>
  <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4 flex items-center justify-center gap-2">Start free 7-day trial ${ico('arrow-right','text-[18px]')}</button>
  <p class="text-center font-body text-[10px] text-ink-faint mt-2">Subscription auto-renews unless cancelled 24h before period end. <span class="underline">Restore</span> · <span class="underline">Terms</span></p>
</div>`;

/* ---------------- SETTINGS ---------------- */
function setRow(icon, label, value, last){
  return `<div class="flex items-center gap-3 px-4 py-3.5 ${last?'':'border-b border-line'}">
    <span class="w-9 h-9 rounded-full bg-white border border-line flex items-center justify-center text-plum flex-none">${ico(icon,'text-[17px]')}</span>
    <span class="flex-1 font-body text-[15px] text-ink">${label}</span>
    ${value?`<span class="font-body text-[13px] text-ink-faint">${value}</span>`:''}
    ${ico('chevron-right','text-ink-faint text-[18px]')}</div>`;
}
function setGroup(title, rows){ return `<section><p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-2 px-1">${title}</p><div class="bg-surface-card border border-line rounded-2xl">${rows}</div></section>`; }
const settings = `
${backHeader('Settings')}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-6">
  <div class="flex items-center gap-4">
    <span class="w-16 h-16 rounded-full bg-damson flex items-center justify-center text-white font-headline text-2xl flex-none">G</span>
    <div><p class="font-headline text-2xl text-ink leading-tight">Grace</p><p class="font-body text-sm text-ink-soft">Free plan</p></div>
  </div>
  <button class="w-full bg-clay-soft rounded-2xl px-5 py-4 flex items-center justify-between">
    <span class="flex items-center gap-2.5 font-headline text-[16px] text-clay">${ico('sparkles','text-[18px]')} Sloe Pro</span>
    <span class="font-body text-sm text-clay">Manage</span></button>
  ${setGroup('Goals & targets', setRow('flag','Daily goals')+setRow('target','Nutritional targets','',true))}
  ${setGroup('Display', setRow('ruler','Units','kg, kcal')+setRow('palette','Appearance','Light',true))}
  ${setGroup('Connections', setRow('heart','Apple Health','Connected')+setRow('activity','Google Fit','',true))}
  ${setGroup('Reminders', setRow('clock','Daily reminder','08:00')+setRow('bell','Notifications','',true))}
  ${setGroup('Account', setRow('download','Export data')+setRow('shield-check','Privacy policy','',true))}
  <button class="w-full text-center font-body text-sm font-semibold text-destructive py-2">Delete account</button>
</main>`;

/* ---------------- ASK ---------------- */
function askCard(icon, iconCls, title, sub, badge){
  return `<button class="w-full text-left bg-surface-card border border-line rounded-2xl p-5">
    <div class="flex items-start justify-between"><span class="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center ${iconCls}">${ico(icon,'text-[18px]')}</span>${badge||''}</div>
    <h3 class="font-headline text-xl text-ink mt-4 leading-tight">${title}</h3>
    <p class="font-body text-xs text-ink-faint mt-1">${sub}</p></button>`;
}
const ask = `
<header class="w-full bg-surface border-b border-line flex items-center justify-between px-6 h-16">
  <span class="w-8 h-8 rounded-full bg-surface-card border border-line flex items-center justify-center text-ink-soft font-label text-xs font-semibold">G</span>
  <h1 class="font-headline text-2xl font-semibold text-plum">Sloe</h1>
  <button class="text-ink-soft">${ico('search','text-[20px]')}</button>
</header>
<main class="px-5 pt-8 pb-32 max-w-2xl mx-auto">
  <h1 class="font-headline text-5xl text-ink">Ask</h1>
  <p class="font-body text-lg text-ink-soft mt-3 max-w-[300px] leading-relaxed">Ask me anything — swap an ingredient, fit a meal to your macros, or decide what to cook tonight.</p>
  <div class="space-y-4 mt-8">
    ${askCard('utensils','text-macro-protein','Make this lower calorie','Lighten up any recipe')}
    ${askCard('package','text-clay','What can I cook with chicken & rice?','Pantry clearout')}
    ${askCard('pie-chart','text-ink','Fit a slice of cake into today','Balance the rest of your day','<span class="inline-flex items-center gap-1 bg-frost-mist text-sage font-label text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full">'+ico('circle-check','text-[12px]')+' Macros</span>')}
  </div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface/95 backdrop-blur px-5 pt-3 pb-7">
  <div class="flex items-center gap-2 bg-surface-card border border-line rounded-full pl-4 pr-2 py-2">
    ${ico('mic','text-ink-faint text-[20px]')}<span class="flex-1 font-body text-sm text-ink-faint">Type your question…</span>
    <span class="w-9 h-9 rounded-full bg-clay flex items-center justify-center text-white">${ico('arrow-up','text-[18px]')}</span></div>
</div>`;

/* ---------------- LOG A MEAL (modal) ---------------- */
function logMode(icon, label, pro){
  return `<div class="flex flex-col items-center gap-2"><span class="w-14 h-14 rounded-full bg-surface-card border border-line flex items-center justify-center text-plum relative">${ico(icon,'text-[22px]')}${pro?'<span class="absolute -top-1 -right-1 bg-plum text-white font-label text-[8px] font-bold px-1.5 py-0.5 rounded-full">PRO</span>':''}</span><span class="font-label text-[11px] text-ink-soft">${label}</span></div>`;
}
function foodRow(img, name, sub){
  return `<div class="flex items-center gap-3 py-3 border-b border-line last:border-0"><div class="w-11 h-11 rounded-xl overflow-hidden bg-surface-card border border-line flex-none"><img src="img/${img}" class="w-full h-full object-cover"/></div><div class="flex-1"><p class="font-body text-[15px] text-ink leading-tight">${name}</p><p class="font-body text-xs text-ink-faint">${sub}</p></div><button class="w-8 h-8 rounded-full bg-surface-card border border-line flex items-center justify-center text-clay">${ico('plus','text-[16px]')}</button></div>`;
}
const logmeal = `
<div class="fixed inset-0 bg-bg-base flex flex-col pt-14 px-6" style="background:#FBF8F3">
  <div class="flex justify-between items-start mb-6 opacity-50"><div><p class="font-label text-xs uppercase tracking-widest text-ink-soft">Today</p><p class="font-headline text-4xl text-plum">1,240 <span class="text-xl text-ink-soft font-body">kcal left</span></p></div><div class="w-14 h-14 rounded-full border-4 border-frost-mist"></div></div>
  <div class="space-y-3 opacity-50"><div class="h-20 bg-surface-card rounded-xl border border-line"></div><div class="h-24 bg-surface-card rounded-xl border border-line"></div></div>
</div>
<div class="fixed inset-x-0 bottom-0 bg-surface rounded-t-3xl z-50 pb-8" style="box-shadow:0 -6px 24px rgba(34,27,38,.08)">
  <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1.5 rounded-full bg-line"></div></div>
  <div class="px-6 pt-3 flex items-center justify-between"><h2 class="font-headline text-2xl text-ink">Log a meal</h2><button class="text-ink-soft">${ico('x','text-2xl')}</button></div>
  <div class="px-6 mt-4"><div class="flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-3">${ico('search','text-ink-faint text-[18px]')}<span class="flex-1 font-body text-sm text-ink-faint">Search foods or scan</span>${ico('scan-barcode','text-ink-faint text-[18px]')}</div></div>
  <div class="px-6 mt-5 flex justify-between">${logMode('scan','Scan')}${logMode('mic','Voice',true)}${logMode('camera','Photo')}${logMode('square-pen','Quick add')}</div>
  <div class="px-6 mt-6 flex gap-6 border-b border-line"><span class="font-body text-sm text-ink font-semibold pb-3 border-b-2 border-ink -mb-px">Recent</span><span class="font-body text-sm text-ink-faint pb-3">Favourites</span><span class="font-body text-sm text-ink-faint pb-3">My recipes</span></div>
  <div class="px-6">
    ${foodRow('e427c86a0d4f.png','Fresh Blueberries','100 g · 57 kcal')}
    ${foodRow('4978a9fb6702.png','Brown Eggs','2 large · 144 kcal')}
    ${foodRow('7a448cef1613.png','Jumbo Oats','40 g · 152 kcal')}
  </div>
  <div class="px-6 mt-3 pt-4 border-t border-line flex items-center justify-between">
    <div><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Daily progress</p><p class="font-headline text-xl text-ink">353 <span class="text-sm text-ink-faint font-body">/ 1,593 kcal</span></p></div>
    <div class="flex gap-4 text-center">${[['P','24g','#7C8466'],['C','42g','#C8794E'],['F','12g','#C9892C']].map(([l,v,c])=>`<div><p class="font-headline text-[15px]" style="color:${c}">${v}</p><p class="font-label text-[10px] text-ink-faint">${l}</p></div>`).join('')}</div>
  </div>
</div>`;

console.log(writeScreen('paywall.html','Sloe · Paywall', paywall));
console.log(writeScreen('settings.html','Sloe · Settings', settings));
console.log(writeScreen('ask.html','Sloe · Ask', ask));
console.log(writeScreen('logmeal.html','Sloe · Log a meal', logmeal));
