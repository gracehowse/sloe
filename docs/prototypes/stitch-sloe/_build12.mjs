import { writeScreen, ico, backHeader, tabBar } from './_gen.mjs';

// subtle confetti (calm, on-brand — small marks in warm tokens, not loud)
function confetti(){
  const C=['#C8794E','#7C8466','#D6A24A','#6A4B7A','#C0533F'];
  const m=[];
  for(let i=0;i<22;i++){ const x=6+ (i*4.2)%88 + (i%3)*3; const y=4+ (i*7)%46; const r=(i*53)%360; const c=C[i%C.length];
    m.push(`<span style="position:absolute;left:${x}%;top:${y}%;width:${i%3?6:8}px;height:${i%2?3:8}px;background:${c};border-radius:${i%2?'9px':'1px'};transform:rotate(${r}deg);opacity:.85"></span>`);}
  return `<div class="absolute inset-x-0 top-0 h-56 pointer-events-none">${m.join('')}</div>`;
}

/* ---------------- P1 · ACCOUNT & PLAN (settings sub-page) ---------------- */
function row(label, value, danger){
  return `<div class="flex items-center justify-between py-3.5 border-b border-line last:border-0"><span class="font-body text-[15px] ${danger?'text-destructive':'text-ink'}">${label}</span><span class="font-body text-sm text-ink-faint inline-flex items-center gap-1.5">${value||''} ${ico('chevron-right','text-[16px]')}</span></div>`;
}
const account = `
${backHeader('Account')}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-7">
  <div class="flex items-center gap-4">
    <span class="w-16 h-16 rounded-full bg-damson flex items-center justify-center text-white font-headline text-2xl flex-none">G</span>
    <div class="flex-1"><p class="font-headline text-xl text-ink leading-tight">Grace Turner</p><p class="font-body text-[13px] text-ink-faint">grace@sloe.app</p></div>
    <button class="font-body text-sm font-semibold text-clay border border-line rounded-full px-4 py-2">Edit</button>
  </div>
  <section class="bg-frost-mist/50 rounded-2xl p-5">
    <div class="flex items-center justify-between">
      <div><p class="font-label text-[11px] uppercase tracking-[0.08em] text-clay font-semibold">Sloe Pro</p><p class="font-body text-[13px] text-ink-soft mt-0.5">£7.99 / month · renews 5 Jan</p></div>
      <span class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-clay">${ico('sparkles','text-[18px]')}</span>
    </div>
    <button class="w-full mt-4 bg-white border border-line text-ink font-body font-semibold text-sm rounded-full py-2.5">Manage plan</button>
  </section>
  <section><h2 class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-2 px-1">Billing</h2><div class="bg-surface-card border border-line rounded-2xl px-4">${row('Payment method','App Store')}${row('Billing history')}${row('Restore purchases')}</div></section>
  <section><h2 class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-2 px-1">Preferences</h2><div class="bg-surface-card border border-line rounded-2xl px-4">${row('Units','Metric')}${row('Connected apps','Apple Health')}${row('Region','United Kingdom')}</div></section>
  <section><div class="bg-surface-card border border-line rounded-2xl px-4">${row('Log out')}${row('Delete account & data','',true)}</div></section>
</main>`;

/* ---------------- P2 · STREAK WIN MOMENT ---------------- */
const streak = `
<div class="relative min-h-screen flex flex-col bg-surface">
  ${confetti()}
  <header class="px-5 pt-4 flex justify-end relative z-10"><button class="text-ink-soft p-1">${ico('x','text-2xl')}</button></header>
  <main class="flex-1 flex flex-col items-center justify-center text-center px-8 -mt-6 relative z-10">
    <div class="relative w-32 h-32 flex items-center justify-center mb-7">
      <div class="absolute inset-0 rounded-full bg-clay/12"></div>
      <div class="absolute inset-3 rounded-full bg-clay/15"></div>
      <span class="text-clay">${ico('flame','text-[52px]')}</span>
      <span class="absolute -bottom-1 bg-clay text-white font-headline text-lg rounded-full w-12 h-12 flex items-center justify-center border-4 border-surface">7</span>
    </div>
    <h1 class="font-headline text-4xl text-plum leading-tight">A 7-day streak,<br/>Grace.</h1>
    <p class="font-body text-base text-ink-soft mt-3 max-w-xs">You've logged seven days running — your most consistent week yet. Keep it gentle, keep it going.</p>
    <div class="flex gap-1.5 mt-6">${[1,1,1,1,1,1,1].map(()=>`<span class="w-2.5 h-2.5 rounded-full bg-clay"></span>`).join('')}</div>
  </main>
  <div class="px-6 pb-10 space-y-3 relative z-10">
    <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4 flex items-center justify-center gap-2">${ico('share-2','text-[18px]')} Share my streak</button>
    <button data-nav="today.html" class="w-full font-body text-sm font-medium text-ink-soft py-2">Keep going</button>
  </div>
</div>`;

/* ---------------- P3 · RECIPE IMPORT SUCCESS ---------------- */
const importDone = `
<div class="relative min-h-screen flex flex-col bg-surface">
  ${confetti()}
  <header class="px-5 pt-4 flex justify-between items-center relative z-10"><button class="text-ink-soft p-1">${ico('x','text-2xl')}</button><span class="font-label text-[11px] uppercase tracking-wide text-ink-faint">Imported from Instagram</span><span class="w-8"></span></header>
  <main class="flex-1 flex flex-col items-center text-center px-6 pt-2 relative z-10">
    <span class="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center text-sage mb-3">${ico('circle-check','text-2xl')}</span>
    <h1 class="font-headline text-3xl text-plum">Saved to your cookbook</h1>
    <p class="font-body text-sm text-ink-soft mt-1.5 max-w-xs">We pulled the ingredients and worked out the nutrition — credited to the creator.</p>
    <div class="recipe-card cursor-pointer w-full bg-surface-card border border-line rounded-2xl overflow-hidden mt-6 text-left">
      <div class="relative h-44"><img src="img/a6610a1bee6c.png" class="w-full h-full object-cover"/><div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <span class="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-sage/90 text-white font-label text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full">${ico('circle-check','text-[12px]')} Fits your day</span></div>
      <div class="p-4">
        <p class="font-headline text-xl text-ink leading-tight">Warm Tahini Grain Bowl</p>
        <p class="font-body text-[12px] text-ink-faint mt-0.5">By @gatherednutrition · 25 min</p>
        <div class="flex mt-3 pt-3 border-t border-line text-center">${[['580','kcal','text-ink'],['24g','protein','text-macro-protein'],['62g','carbs','text-macro-carbs'],['18g','fat','text-macro-fat']].map(([v,l,c])=>`<div class="flex-1"><p class="font-headline text-lg ${c}">${v}</p><p class="font-label text-[9px] uppercase tracking-wide text-ink-faint">${l}</p></div>`).join('')}</div>
      </div>
    </div>
  </main>
  <div class="px-6 pb-10 pt-4 flex flex-col gap-3 relative z-10">
    <button data-nav="recipe.html" class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">View recipe</button>
    <button data-nav="planner.html" class="w-full bg-surface-card border border-line text-ink font-body font-semibold text-base rounded-full py-3.5">Add to this week's plan</button>
  </div>
</div>`;

console.log(writeScreen('account.html','Sloe · Account', account));
console.log(writeScreen('streak.html','Sloe · Streak', streak));
console.log(writeScreen('import-success.html','Sloe · Imported', importDone));
