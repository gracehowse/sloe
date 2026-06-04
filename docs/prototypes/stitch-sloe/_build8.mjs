import { writeScreen, ico, appBar, tabBar, multiRing } from './_gen.mjs';

// onboarding step header: back + progress bar (step/total)
function obHeader(step, total){
  const bars = Array.from({length:total},(_,i)=>`<div class="flex-1 h-1 rounded-full ${i<step?'bg-plum':'bg-line'}"></div>`).join('');
  return `<header class="px-5 pt-4 pb-2"><button class="text-plum p-1 -ml-1">${ico('chevron-left','text-2xl')}</button><div class="flex gap-1.5 mt-3">${bars}</div></header>`;
}

/* ---------- O1 WELCOME ---------- */
const welcome = `
<div class="fixed inset-0 flex flex-col" style="min-height:100vh">
  <div class="relative flex-1">
    <img src="img/a6610a1bee6c.png" class="absolute inset-0 w-full h-full object-cover"/>
    <div class="absolute inset-0 bg-gradient-to-t from-plum via-plum/50 to-plum/10"></div>
    <div class="absolute bottom-0 left-0 w-full px-6 pb-4 text-white">
      <p class="font-headline text-2xl mb-2">Sloe</p>
      <h1 class="font-headline text-4xl leading-tight">Cook what you love.<br/><span class="italic">Still</span> reach your goals.</h1>
      <p class="font-body text-base text-white/80 mt-3 leading-relaxed">The tracker for people who love food and still have goals — fit the meals you love into your day.</p>
    </div>
  </div>
  <div class="px-6 pb-8 pt-5 bg-surface space-y-3">
    <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Get started</button>
    <button class="w-full font-body text-sm font-medium text-ink-soft py-2">I already have an account</button>
  </div>
</div>`;

/* ---------- O2 GOAL ---------- */
function goalCard(img, title, on){
  return `<label class="block"><div class="flex items-center gap-4 rounded-2xl border ${on?'border-plum bg-surface-card':'border-line'} p-3.5">
    <div class="w-16 h-16 rounded-xl overflow-hidden bg-surface-card flex-none"><img src="img/${img}" class="w-full h-full object-cover"/></div>
    <span class="flex-1 font-headline text-lg text-ink leading-tight">${title}</span>
    <span class="w-6 h-6 rounded-full ${on?'bg-plum border-plum':'border border-line'} flex items-center justify-center">${on?ico('check','text-white text-[14px]'):''}</span>
  </div></label>`;
}
const goal = `
${obHeader(1,5)}
<main class="px-5 pt-4 pb-10 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum text-center">What brings you to Sloe?</h1>
  <p class="font-body text-sm text-ink-soft text-center mt-1">We'll tailor everything to you.</p>
  <div class="space-y-3 mt-7">
    ${goalCard('1eded18039f9.png','Lose weight while still eating what I love',true)}
    ${goalCard('e427c86a0d4f.png','Build muscle',false)}
    ${goalCard('a6610a1bee6c.png','Eat healthier at home',false)}
    ${goalCard('7a448cef1613.png','Just track what I cook',false)}
  </div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface border-t border-line px-5 pt-3 pb-7"><button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Continue</button></div>`;

/* ---------- O3 ABOUT YOU ---------- */
function field(label, value){ return `<div class="flex items-center justify-between border-b border-line py-4"><span class="font-body text-[15px] text-ink-soft">${label}</span><span class="font-headline text-xl text-ink">${value} ${ico('chevron-right','text-ink-faint text-[16px]')}</span></div>`; }
const about = `
${obHeader(2,5)}
<main class="px-5 pt-4 pb-10 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">A little about you</h1>
  <p class="font-body text-sm text-ink-soft mt-1">This makes your targets accurate — it stays private.</p>
  <div class="flex gap-2 mt-7">${['Female','Male','Other'].map((s,i)=>`<span class="flex-1 text-center font-label text-sm font-semibold py-3 rounded-full ${i===0?'bg-plum text-white':'bg-surface-card border border-line text-ink-soft'}">${s}</span>`).join('')}</div>
  <div class="mt-4">${field('Age','29')}${field('Height','168 cm')}${field('Current weight','76.0 kg')}${field('Goal weight','72.0 kg')}</div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface border-t border-line px-5 pt-3 pb-7"><button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Continue</button></div>`;

/* ---------- O4 PACE ---------- */
const pace = `
${obHeader(3,5)}
<main class="px-5 pt-4 pb-10 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">How fast feels right?</h1>
  <p class="font-body text-sm text-ink-soft mt-1">Slower is steadier — and easier to keep eating what you love.</p>
  <section class="bg-surface-card border border-line rounded-2xl p-6 mt-7 text-center">
    <p class="font-headline text-5xl text-ink">0.4 <span class="text-xl text-ink-soft font-body">kg / week</span></p>
    <p class="font-body text-[13px] text-sage mt-1">Recommended · sustainable</p>
    <div class="relative h-2 rounded-full bg-line mt-6"><div class="absolute left-0 h-2 rounded-full bg-clay" style="width:45%"></div><div class="absolute -top-1.5 w-5 h-5 rounded-full bg-surface border-2 border-clay shadow-sm" style="left:calc(45% - 10px)"></div></div>
    <div class="flex justify-between mt-2 font-label text-[11px] text-ink-faint"><span>Relaxed</span><span>Steady</span><span>Focused</span></div>
  </section>
  <div class="bg-frost-mist/60 rounded-2xl p-4 mt-4 flex items-center gap-3"><span class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-plum flex-none">${ico('flag','text-[16px]')}</span><p class="font-body text-[13px] text-ink-soft">On track to reach <span class="text-ink font-medium">72.0 kg by 5 Jan</span>.</p></div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface border-t border-line px-5 pt-3 pb-7"><button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Continue</button></div>`;

/* ---------- O5 DIETARY PREFERENCES ---------- */
function dietRow(title, desc, on){
  return `<label class="block"><div class="rounded-2xl border ${on?'border-plum bg-surface-card':'border-line'} px-4 py-3.5">
    <p class="font-headline text-lg text-ink leading-tight">${title}</p>
    <p class="font-body text-[13px] text-ink-soft mt-0.5">${desc}</p>
  </div></label>`;
}
const diet = `
${obHeader(4,5)}
<main class="px-5 pt-4 pb-28 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Any dietary preferences we should consider?</h1>
  <p class="font-body text-sm text-ink-soft mt-2">We'll keep these in mind for every suggestion — you can change them anytime.</p>
  <div class="space-y-3 mt-6">
    ${dietRow('Vegetarian','No meat, poultry or fish — eggs and dairy are fine.',false)}
    ${dietRow('Vegan','No animal products at all.',false)}
    ${dietRow('Pescatarian','No meat or poultry, but fish and seafood are in.',false)}
    ${dietRow('Low-carb','Lean on protein and fats over carbs.',false)}
    ${dietRow('Dairy-free','No dairy.',false)}
    ${dietRow('None, I eat everything','No restrictions — you can update this later.',true)}
  </div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface border-t border-line px-5 pt-3 pb-7"><button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Continue</button></div>`;

/* ---------- O6 ALLERGIES ---------- */
// Stylised-photoreal-on-white allergen images (generated via Stitch, §11.1 ingredient style).
function allergyTile(img, label, on){
  return `<div class="rounded-2xl border ${on?'border-plum':'border-line'} bg-surface-card p-4 flex flex-col items-center justify-center gap-2">
    <div class="w-20 h-20 flex items-center justify-center"><img src="img/allergen-${img}.png" class="w-full h-full object-contain mix-blend-multiply"/></div>
    <span class="font-body text-[15px] text-ink">${label}</span>
  </div>`;
}
const allergies = `
${obHeader(5,5)}
<main class="px-5 pt-4 pb-28 max-w-2xl mx-auto">
  <h1 class="font-headline text-3xl text-plum">Do you have any allergies we should know about?</h1>
  <p class="font-body text-sm text-ink-soft mt-2">We'll keep these out of anything we suggest or create for you.</p>
  <div class="grid grid-cols-2 gap-3 mt-6">
    ${allergyTile('shellfish','Shellfish',false)}
    ${allergyTile('peanuts','Peanuts',false)}
    ${allergyTile('gluten','Gluten',false)}
    ${allergyTile('eggs','Eggs',false)}
    ${allergyTile('soy','Soy',false)}
    ${allergyTile('dairy','Dairy',false)}
  </div>
</main>
<div class="fixed bottom-0 left-0 w-full bg-surface border-t border-line px-5 pt-3 pb-7"><button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">No allergies</button></div>`;

/* ---------- O7 PLAN READY ---------- */
const planReady = `
<main class="px-5 pt-10 pb-10 max-w-2xl mx-auto text-center min-h-screen flex flex-col">
  <span class="w-14 h-14 rounded-full bg-sage/15 flex items-center justify-center text-sage mx-auto mb-5">${ico('circle-check','text-2xl')}</span>
  <h1 class="font-headline text-3xl text-plum">Your plan is ready, Grace</h1>
  <p class="font-body text-sm text-ink-soft mt-1">Built around your goal — with room for the food you love.</p>
  <section class="bg-surface-card border border-line rounded-2xl p-6 mt-7">
    <p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Daily target</p>
    <p class="font-headline text-5xl text-ink mt-1">2,040 <span class="text-xl text-ink-soft font-body">kcal</span></p>
    <div class="flex mt-5 pt-5 border-t border-line">
      <div class="flex-1"><p class="font-headline text-2xl text-macro-protein">140g</p><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Protein</p></div>
      <div class="flex-1"><p class="font-headline text-2xl text-macro-carbs">200g</p><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Carbs</p></div>
      <div class="flex-1"><p class="font-headline text-2xl text-macro-fat">68g</p><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Fat</p></div>
    </div>
  </section>
  <p class="font-headline italic text-base text-ink mt-6 px-4">"No foods off-limits. We'll just help them fit."</p>
  <div class="flex-1"></div>
  <button class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4 mt-6">Start using Sloe</button>
</main>`;

// Today states (empty/over) now live in the shared template _buildtoday.mjs.

console.log(writeScreen('onboarding-welcome.html','Sloe · Welcome', welcome));
console.log(writeScreen('onboarding.html','Sloe · Onboarding goal', goal, {next:'onboarding-about.html'}));
console.log(writeScreen('onboarding-about.html','Sloe · About you', about, {next:'onboarding-pace.html'}));
console.log(writeScreen('onboarding-pace.html','Sloe · Pace', pace, {next:'onboarding-diet.html'}));
console.log(writeScreen('onboarding-diet.html','Sloe · Dietary preferences', diet, {next:'onboarding-allergies.html'}));
console.log(writeScreen('onboarding-allergies.html','Sloe · Allergies', allergies));
console.log(writeScreen('onboarding-plan.html','Sloe · Plan ready', planReady));
