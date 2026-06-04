import { writeScreen, ico } from './_gen.mjs';

/* =========================================================================
   WEB ONBOARDING — premium split-screen. Left = warm image/brand panel (md+),
   right = centered form card. Mobile = single column (card only).
   Register: white, ink/grey, Newsreader serif + italic, clay CTA.
   ========================================================================= */

function leftPanel(line){
  return `<aside class="hidden lg:block lg:w-[42%] relative shrink-0">
    <img src="img/a6610a1bee6c.png" class="absolute inset-0 w-full h-full object-cover"/>
    <div class="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-ink/10"></div>
    <div class="absolute top-0 left-0 p-10"><span class="font-headline text-2xl font-semibold text-white">Sloe</span></div>
    <div class="absolute bottom-0 left-0 p-10 pr-16"><p class="font-headline text-3xl text-white leading-snug">${line}</p></div>
  </aside>`;
}

// progress dots row (step/total). step=0 → no progress (welcome/plan)
function progress(step, total){
  if(!total) return '';
  return `<div class="flex gap-1.5 mb-8">${Array.from({length:total},(_,i)=>`<div class="h-1 flex-1 rounded-full ${i<step?'bg-clay':'bg-line'}"></div>`).join('')}</div>`;
}

// shell: left panel + right card. inner = question+content. cta = button label (or '' for custom)
function shell(file, title, line, step, total, inner, cta, ctaHref){
  const back = step>0 ? `<button class="text-ink-soft p-1 -ml-1 mb-2 inline-flex">${ico('chevron-left','text-2xl')}</button>` : '';
  const body = `
<div class="lg:flex min-h-screen">
  ${leftPanel(line)}
  <main class="flex-1 flex flex-col bg-white min-h-screen">
    <div class="w-full max-w-md mx-auto px-6 md:px-8 pt-10 md:pt-16 flex-1 flex flex-col">
      ${back}
      ${progress(step,total)}
      ${inner}
    </div>
    ${cta ? `<div class="w-full max-w-md mx-auto px-6 md:px-8 pb-10 pt-4"><button ${ctaHref?`data-nav="${ctaHref}"`:''} class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">${cta}</button></div>` : ''}
  </main>
</div>`;
  console.log(writeScreen(file, title, body, { web:true }));
}

/* ---------- O1 WELCOME (no progress, hero) ---------- */
const welcomeInner = `
<div class="flex-1 flex flex-col justify-center text-center lg:text-left py-12">
  <p class="font-label text-[12px] uppercase tracking-[0.18em] text-ink-faint">For people who love food — and have goals</p>
  <h1 class="font-headline text-[2.6rem] md:text-5xl leading-[1.05] mt-5"><span class="text-ink-faint">Cook what you love.</span><br/><span class="text-ink"><span class="italic">Still</span> reach your goals.</span></h1>
  <p class="font-body text-lg text-ink-soft mt-5 leading-relaxed">Save any recipe, see how it fits your day, and reach your goals without giving up the food you love.</p>
  <div class="mt-9 space-y-3">
    <button data-nav="onboarding-goal-web.html" class="w-full bg-clay text-white font-body font-semibold text-base rounded-full py-4">Get started</button>
    <button data-nav="onboarding-goal-web.html" class="w-full font-body text-sm font-medium text-ink-soft py-2">I already have an account</button>
  </div>
</div>`;
shell('onboarding-welcome-web.html','Sloe · Welcome (web)','Cook what you love. Still reach your goals.',0,0,welcomeInner,'');

/* ---------- O2 GOAL ---------- */
function goalCard(img, title, on){
  return `<label class="block"><div class="flex items-center gap-4 rounded-2xl border ${on?'border-clay bg-surface-card':'border-line'} p-3.5">
    <div class="w-14 h-14 rounded-xl overflow-hidden bg-surface-card flex-none"><img src="img/${img}" class="w-full h-full object-cover"/></div>
    <span class="flex-1 font-headline text-lg text-ink leading-tight">${title}</span>
    <span class="w-6 h-6 rounded-full ${on?'bg-clay border-clay':'border border-line'} flex items-center justify-center">${on?ico('check','text-white text-[14px]'):''}</span>
  </div></label>`;
}
const goalInner = `
<h1 class="font-headline text-3xl md:text-4xl text-ink">What brings you to Sloe?</h1>
<p class="font-body text-sm text-ink-soft mt-2">We'll tailor everything to you.</p>
<div class="space-y-3 mt-7">
  ${goalCard('1eded18039f9.png','Lose weight while still eating what I love',true)}
  ${goalCard('e427c86a0d4f.png','Build muscle',false)}
  ${goalCard('a6610a1bee6c.png','Eat healthier at home',false)}
  ${goalCard('7a448cef1613.png','Just track what I cook',false)}
</div>`;
shell('onboarding-goal-web.html','Sloe · Goal (web)','The tracker for people who love food.',1,5,goalInner,'Continue','onboarding-about-web.html');

/* ---------- O3 ABOUT YOU ---------- */
function field(label, value){ return `<div class="flex items-center justify-between border-b border-line py-4"><span class="font-body text-[15px] text-ink-soft">${label}</span><span class="font-headline text-xl text-ink inline-flex items-center gap-1">${value} ${ico('chevron-right','text-ink-faint text-[16px]')}</span></div>`; }
const aboutInner = `
<h1 class="font-headline text-3xl md:text-4xl text-ink">A little about you</h1>
<p class="font-body text-sm text-ink-soft mt-2">This makes your targets accurate — it stays private.</p>
<div class="flex gap-2 mt-7">${['Female','Male','Other'].map((s,i)=>`<span class="flex-1 text-center font-label text-sm font-semibold py-3 rounded-full ${i===0?'bg-clay text-white':'bg-surface-card border border-line text-ink-soft'}">${s}</span>`).join('')}</div>
<div class="mt-2">${field('Age','29')}${field('Height','168 cm')}${field('Current weight','76.0 kg')}${field('Goal weight','72.0 kg')}</div>`;
shell('onboarding-about-web.html','Sloe · About you (web)','Built around you.',2,5,aboutInner,'Continue','onboarding-pace-web.html');

/* ---------- O4 PACE ---------- */
const paceInner = `
<h1 class="font-headline text-3xl md:text-4xl text-ink">How fast feels right?</h1>
<p class="font-body text-sm text-ink-soft mt-2">Slower is steadier — and easier to keep eating what you love.</p>
<section class="bg-surface-card border border-line rounded-2xl p-6 mt-7 text-center">
  <p class="font-headline text-5xl text-ink">0.4 <span class="text-xl text-ink-soft font-body">kg / week</span></p>
  <p class="font-body text-[13px] text-sage mt-1">Recommended · sustainable</p>
  <div class="relative h-2 rounded-full bg-line mt-6"><div class="absolute left-0 h-2 rounded-full bg-clay" style="width:45%"></div><div class="absolute -top-1.5 w-5 h-5 rounded-full bg-white border-2 border-clay shadow-sm" style="left:calc(45% - 10px)"></div></div>
  <div class="flex justify-between mt-2 font-label text-[11px] text-ink-faint"><span>Relaxed</span><span>Steady</span><span>Focused</span></div>
</section>
<div class="bg-frost-mist/50 rounded-2xl p-4 mt-4 flex items-center gap-3"><span class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-clay flex-none">${ico('flag','text-[16px]')}</span><p class="font-body text-[13px] text-ink-soft">On track to reach <span class="text-ink font-medium">72.0 kg by 5 Jan</span>.</p></div>`;
shell('onboarding-pace-web.html','Sloe · Pace (web)','Steady wins.',3,5,paceInner,'Continue','onboarding-diet-web.html');

/* ---------- O5 DIET ---------- */
function dietRow(title, desc, on){
  return `<label class="block"><div class="rounded-2xl border ${on?'border-clay bg-surface-card':'border-line'} px-4 py-3.5">
    <p class="font-headline text-lg text-ink leading-tight">${title}</p><p class="font-body text-[13px] text-ink-soft mt-0.5">${desc}</p>
  </div></label>`;
}
const dietInner = `
<h1 class="font-headline text-3xl md:text-4xl text-ink">Any dietary preferences we should consider?</h1>
<p class="font-body text-sm text-ink-soft mt-2">We'll keep these in mind for every suggestion.</p>
<div class="space-y-3 mt-7">
  ${dietRow('Vegetarian','No meat, poultry or fish — eggs and dairy are fine.',false)}
  ${dietRow('Vegan','No animal products at all.',false)}
  ${dietRow('Pescatarian','No meat or poultry, but fish and seafood are in.',false)}
  ${dietRow('Low-carb','Lean on protein and fats over carbs.',false)}
  ${dietRow('Dairy-free','No dairy.',false)}
  ${dietRow('None, I eat everything','No restrictions — you can update this later.',true)}
</div>`;
shell('onboarding-diet-web.html','Sloe · Diet (web)','No foods off-limits.',4,5,dietInner,'Continue','onboarding-allergies-web.html');

/* ---------- O6 ALLERGIES ---------- */
function allergyTile(img, label){
  return `<div class="rounded-2xl border border-line bg-surface-card p-4 flex flex-col items-center justify-center gap-2"><div class="w-20 h-20 flex items-center justify-center"><img src="img/allergen-${img}.png" class="w-full h-full object-contain mix-blend-multiply"/></div><span class="font-body text-[15px] text-ink">${label}</span></div>`;
}
const allergyInner = `
<h1 class="font-headline text-3xl md:text-4xl text-ink">Do you have any allergies we should know about?</h1>
<p class="font-body text-sm text-ink-soft mt-2">We'll keep these out of anything we suggest.</p>
<div class="grid grid-cols-2 gap-3 mt-7">
  ${allergyTile('shellfish','Shellfish')}${allergyTile('peanuts','Peanuts')}${allergyTile('gluten','Gluten')}${allergyTile('eggs','Eggs')}${allergyTile('soy','Soy')}${allergyTile('dairy','Dairy')}
</div>`;
shell('onboarding-allergies-web.html','Sloe · Allergies (web)','We design around you.',5,5,allergyInner,'No allergies','onboarding-plan-web.html');

/* ---------- O7 PLAN READY ---------- */
const planInner = `
<div class="flex-1 flex flex-col justify-center py-10 text-center lg:text-left">
  <span class="w-14 h-14 rounded-full bg-sage/15 flex items-center justify-center text-sage mb-5 mx-auto lg:mx-0">${ico('circle-check','text-2xl')}</span>
  <h1 class="font-headline text-3xl md:text-4xl text-ink">Your plan is ready, Grace</h1>
  <p class="font-body text-sm text-ink-soft mt-2">Built around your goal — with room for the food you love.</p>
  <section class="bg-surface-card border border-line rounded-2xl p-6 mt-7 text-left">
    <p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Daily target</p>
    <p class="font-headline text-5xl text-ink mt-1">2,040 <span class="text-xl text-ink-soft font-body">kcal</span></p>
    <div class="flex mt-5 pt-5 border-t border-line">
      <div class="flex-1"><p class="font-headline text-2xl text-macro-protein">140g</p><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Protein</p></div>
      <div class="flex-1"><p class="font-headline text-2xl text-macro-carbs">200g</p><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Carbs</p></div>
      <div class="flex-1"><p class="font-headline text-2xl text-macro-fat">68g</p><p class="font-label text-[10px] uppercase tracking-wide text-ink-faint">Fat</p></div>
    </div>
  </section>
  <p class="font-headline italic text-base text-ink mt-6">"No foods off-limits. We'll just help them fit."</p>
</div>`;
shell('onboarding-plan-web.html','Sloe · Plan ready (web)','Welcome to Sloe.',0,0,planInner,'Start using Sloe','today-web.html');
