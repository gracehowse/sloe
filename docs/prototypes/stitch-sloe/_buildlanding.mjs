import { writeScreen, ico } from './_gen.mjs';

/* =========================================================================
   Sloe landing — PREMIUM EDITORIAL (Julienne register): white bg, ink/grey
   type, Newsreader serif with italic accents, clay as the single accent.
   ========================================================================= */

/* ---------- nav ---------- */
const nav = `
<header class="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-line/70">
  <div class="max-w-6xl mx-auto flex items-center justify-between px-5 md:px-8 h-[72px]">
    <span class="font-headline text-2xl font-semibold text-ink">Sloe</span>
    <nav class="hidden md:flex items-center gap-9 font-body text-[15px] text-ink-soft">
      <a class="hover:text-ink relative">Recipes</a><a class="hover:text-ink">How it works</a><a class="hover:text-ink">Pricing</a>
    </nav>
    <div class="flex items-center gap-4">
      <a class="hidden sm:inline font-body text-[15px] text-ink-soft hover:text-ink">Log in</a>
      <a data-nav="onboarding-welcome-web.html" class="inline-flex items-center bg-clay text-white font-body font-semibold text-[14px] rounded-full px-4 py-2.5">Get started</a>
      <button class="hidden sm:flex w-9 h-9 rounded-full border border-line items-center justify-center text-ink-soft">${ico('sun','text-[16px]')}</button>
    </div>
  </div>
</header>`;

/* ---------- device mockups ---------- */
// Realistic vector device surrounds — metal-gradient edges, screen gloss, layered shadows.
// (html-to-design converts the linear-gradients → Figma gradient fills and box-shadows → drop-shadow effects.)
const GLOSS = 'background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,0) 34%)';
const EDGE_DARK = 'linear-gradient(140deg,#46414e 0%,#211d28 34%,#0b0910 100%)'; // brushed titanium catching light top-left
function phone(img, w = 270, h = 558){
  const pad = Math.max(8, Math.round(w*0.036));
  return `<div class="relative shrink-0" style="width:${w}px">
    <div class="rounded-[2.8rem]" style="padding:${pad}px;background:${EDGE_DARK};box-shadow:0 1px 2px rgba(255,255,255,.18) inset,0 2px 8px rgba(0,0,0,.22),0 34px 70px -22px rgba(34,27,38,.55)">
      <div class="relative rounded-[2.25rem] overflow-hidden" style="height:${h}px;background:#0a0810">
        <img src="img/${img}" class="w-full object-cover object-top" style="height:100%"/>
        <div class="absolute inset-0 pointer-events-none" style="${GLOSS}"></div>
        <div class="absolute top-[9px] left-1/2 -translate-x-1/2 rounded-full" style="width:${Math.round(w*0.26)}px;height:${Math.round(w*0.052)}px;background:#050409"></div>
      </div>
    </div>
    <div class="absolute rounded-l" style="left:-1px;top:24%;width:3px;height:5%;background:linear-gradient(90deg,#5a5563,#241f2c)"></div>
    <div class="absolute rounded-l" style="left:-1px;top:32%;width:3px;height:8%;background:linear-gradient(90deg,#5a5563,#241f2c)"></div>
    <div class="absolute rounded-r" style="right:-1px;top:27%;width:3px;height:11%;background:linear-gradient(270deg,#5a5563,#241f2c)"></div>
  </div>`;
}
function laptop(img, w = 540){
  const h = Math.round(w*0.625);
  return `<div class="shrink-0" style="width:${Math.round(w*1.18)}px">
    <div class="relative mx-auto rounded-[0.9rem]" style="width:${w}px;padding:11px;background:${EDGE_DARK};box-shadow:0 1px 2px rgba(255,255,255,.16) inset,0 30px 60px -24px rgba(34,27,38,.5)">
      <div class="absolute top-[5px] left-1/2 -translate-x-1/2 rounded-full" style="width:5px;height:5px;background:#2c2733"></div>
      <div class="relative rounded-[0.38rem] overflow-hidden" style="height:${h}px;background:#0a0810"><img src="img/${img}" class="w-full object-cover object-top" style="height:${h}px"/><div class="absolute inset-0 pointer-events-none" style="${GLOSS}"></div></div>
    </div>
    <div class="relative mx-auto" style="width:${Math.round(w*1.18)}px">
      <div style="height:2px;background:linear-gradient(to bottom,#F2EFF4,#CFC9D6)"></div>
      <div class="rounded-b-[0.5rem]" style="height:11px;background:linear-gradient(to bottom,#DCD7E0 0%,#B8B1C0 55%,#988FA4 100%);box-shadow:0 16px 26px -16px rgba(34,27,38,.45)"></div>
      <div class="mx-auto rounded-b-[0.4rem]" style="width:15%;height:6px;background:linear-gradient(to bottom,#9A93A6,#7c7488)"></div>
    </div>
  </div>`;
}
function tablet(img, w = 230){
  const h = Math.round(w*1.34);
  const pad = Math.max(9, Math.round(w*0.045));
  return `<div class="relative rounded-[1.8rem] shrink-0" style="width:${w}px;padding:${pad}px;background:${EDGE_DARK};box-shadow:0 1px 2px rgba(255,255,255,.16) inset,0 30px 60px -24px rgba(34,27,38,.5)">
    <div class="absolute top-[7px] left-1/2 -translate-x-1/2 rounded-full" style="width:5px;height:5px;background:#2c2733"></div>
    <div class="relative rounded-[1.25rem] overflow-hidden" style="height:${h}px;background:#0a0810"><img src="img/${img}" class="w-full object-cover object-top" style="height:${h}px"/><div class="absolute inset-0 pointer-events-none" style="${GLOSS}"></div></div>
  </div>`;
}

/* ---------- HERO — centered editorial, grey→black two-tone, italic accent ---------- */
const hero = `
<section class="bg-white">
  <div class="max-w-4xl mx-auto px-5 text-center pt-20 md:pt-28 pb-12 md:pb-16">
    <p class="font-label text-[12px] uppercase tracking-[0.18em] text-ink-faint">For people who love food — and have goals</p>
    <h1 class="font-headline text-[2.9rem] leading-[1.06] md:text-[4.5rem] md:leading-[1.04] mt-6">
      <span class="text-ink-faint">Cook what you love.</span><br/>
      <span class="text-ink"><span class="italic">Still</span> reach your goals.</span>
    </h1>
    <p class="font-body text-lg md:text-xl text-ink-soft mt-7 max-w-xl mx-auto leading-relaxed">Save any recipe from Instagram, TikTok or the web. Sloe works out the nutrition and helps it fit your day — no foods off-limits.</p>
    <div class="flex flex-col sm:flex-row gap-3 mt-9 justify-center">
      <a data-nav="onboarding-welcome-web.html" class="inline-flex items-center justify-center gap-2 bg-clay text-white font-body font-semibold text-base rounded-full px-7 py-4">${ico('apple','text-[18px]')} Get the app</a>
      <a data-nav="discover.html" class="inline-flex items-center justify-center gap-2 bg-white border border-line text-ink font-body font-semibold text-base rounded-full px-7 py-4">Browse recipes ${ico('arrow-right','text-[16px]')}</a>
    </div>
    <p class="font-body text-[14px] text-ink-faint mt-5">Already cooking with Sloe? <a class="text-ink underline underline-offset-2">Log in</a></p>
  </div>
</section>`;

/* ---------- TRENDING (Julienne-style horizontal rail on white) ---------- */
// Julienne-style card: soft grey card, serif title TOP + bookmark, photo MIDDLE, creator BOTTOM.
function recipeCard(img, title, source){
  return `<div class="snap-start shrink-0 w-[260px] md:w-[290px] bg-surface-card rounded-2xl p-4 flex flex-col">
    <div class="flex items-start justify-between gap-3">
      <p class="font-headline text-[18px] text-ink leading-snug">${title}</p>
      <span class="text-ink-faint mt-0.5 flex-none">${ico('bookmark','text-[17px]')}</span>
    </div>
    <div class="rounded-xl overflow-hidden aspect-square my-4"><img src="img/${img}" class="w-full h-full object-cover"/></div>
    <p class="font-body text-[13px] text-ink-faint mt-auto">By <span class="text-ink-soft">${source}</span></p>
  </div>`;
}
const trending = `
<section class="bg-white max-w-6xl mx-auto px-5 md:px-8 pt-6 pb-20 md:pb-28">
  <div class="flex items-end justify-between mb-6">
    <h2 class="font-headline text-3xl md:text-4xl text-ink">Trending <span class="italic text-ink-faint">this week</span></h2>
    <div class="hidden md:flex gap-2"><button class="w-10 h-10 rounded-full border border-line flex items-center justify-center text-ink-soft">${ico('chevron-left','text-[18px]')}</button><button class="w-10 h-10 rounded-full border border-line flex items-center justify-center text-ink-soft">${ico('chevron-right','text-[18px]')}</button></div>
  </div>
  <div class="flex gap-5 overflow-x-auto snap-x pb-2 -mx-1 px-1">
    ${recipeCard('a6610a1bee6c.png','Warm Tahini Grain Bowl','@kalejunkie')}
    ${recipeCard('babbc6edccce.png','Three Cheese Fusilli','@cookwithchay')}
    ${recipeCard('1eded18039f9.png','Chicken Kale Salad','@madewithmel')}
    ${recipeCard('e427c86a0d4f.png','Blueberry Baked Oats','@ellies.fav.eats')}
    ${recipeCard('7a448cef1613.png','Crispy Gnocchi Traybake','@grilledcheesesocial')}
  </div>
</section>`;

/* ---------- THE WEDGE — soft rounded panel (no harsh bands) ---------- */
const wedge = `
<section class="bg-white max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14">
  <div class="bg-surface-card rounded-[2.5rem] px-7 md:px-14 py-14 md:py-20 lg:flex lg:items-center lg:gap-20">
    <div class="lg:flex-1">
      <p class="font-label text-[12px] uppercase tracking-[0.18em] text-ink-faint">The Sloe difference</p>
      <h2 class="font-headline text-3xl md:text-[3.25rem] md:leading-[1.08] text-ink mt-4">Recipe apps ignore your goals.<br/>Diet apps kill the <span class="italic">joy</span>.</h2>
      <p class="font-body text-lg text-ink-soft mt-6 max-w-lg leading-relaxed">Sloe is both. Every recipe shows how it fits your calories and macros — so you can have the pasta <span class="italic">and</span> hit your targets. We just help it fit.</p>
      <div class="mt-8 space-y-4">
        ${[['target','Personal calorie & macro targets from your goal'],['circle-check','A “Fits your day” check on every recipe'],['trending-down','Progress that follows the food you actually cook']].map(([i,t])=>`<div class="flex items-center gap-3.5"><span class="w-9 h-9 rounded-full bg-white border border-line flex items-center justify-center text-clay flex-none">${ico(i,'text-[17px]')}</span><span class="font-body text-[15px] text-ink">${t}</span></div>`).join('')}
      </div>
    </div>
    <div class="lg:flex-none mt-14 lg:mt-0 flex justify-center">${phone('mock-recipe.png', 286, 590)}</div>
  </div>
</section>`;

/* ---------- HOW IT WORKS ---------- */
function step(n, title, body){
  return `<div class="text-center md:text-left">
    <p class="font-headline text-5xl text-ink-faint/40">${n}</p>
    <h3 class="font-headline text-2xl text-ink mt-3">${title}</h3>
    <p class="font-body text-[15px] text-ink-soft mt-2.5 leading-relaxed">${body}</p>
  </div>`;
}
const how = `
<section class="bg-white max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
  <div class="text-center max-w-2xl mx-auto mb-14">
    <h2 class="font-headline text-3xl md:text-4xl text-ink">How Sloe <span class="italic text-ink-faint">works</span></h2>
    <p class="font-body text-lg text-ink-soft mt-3">From a recipe you spotted to a meal that fits your day — in seconds.</p>
  </div>
  <div class="grid md:grid-cols-3 gap-12 md:gap-10">
    ${step('01','Save it from anywhere','Share a Reel, paste a link, snap a cookbook page or type it out. Any source works.')}
    ${step('02','We do the nutrition','Sloe parses ingredients and works out calories and macros — no manual logging.')}
    ${step('03','Cook it & track it','Cook in step-by-step mode. Logging your meal is one tap, and your day updates instantly.')}
  </div>
</section>`;

/* ---------- MULTI-DEVICE — laptop + tablet + phone, soft panel ---------- */
const devices = `
<section class="bg-white max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14">
  <div class="bg-surface-card rounded-[2.5rem] px-7 md:px-14 py-14 md:py-20 text-center overflow-hidden">
    <h2 class="font-headline text-3xl md:text-4xl text-ink">Cook from <span class="italic text-ink-faint">anywhere</span></h2>
    <p class="font-body text-lg text-ink-soft mt-3 max-w-xl mx-auto">Your recipes, targets and plan stay in sync across desktop, tablet and your phone.</p>
    <!-- desktop/tablet: laptop + tablet + phone overlapping -->
    <div class="hidden md:flex items-end justify-center mt-16">
      <div class="relative z-10 -mr-10 mb-3">${tablet('mock-web-tablet.png', 210)}</div>
      ${laptop('mock-web-desktop.png', 520)}
      <div class="relative z-20 -ml-14 mb-1">${phone('mock-today.png', 168, 348)}</div>
    </div>
    <!-- mobile: laptop alone -->
    <div class="md:hidden flex justify-center mt-12">${laptop('mock-web-desktop.png', 300)}</div>
  </div>
</section>`;

/* ---------- PRICING ---------- */
function priceCard(name, price, sub, feats, primary){
  return `<div class="flex-1 rounded-3xl border ${primary?'border-ink bg-white shadow-lg':'border-line bg-white'} p-8">
    <p class="font-headline text-xl text-ink">${name}</p>
    <p class="font-headline text-[2.75rem] text-ink mt-2 leading-none">${price}<span class="font-body text-base text-ink-faint">${sub}</span></p>
    <a class="block text-center mt-6 ${primary?'bg-clay text-white':'bg-white border border-line text-ink'} font-body font-semibold text-sm rounded-full py-3">${primary?'Start free trial':'Get started'}</a>
    <ul class="mt-7 space-y-3">${feats.split(',').map(f=>`<li class="flex items-start gap-2.5 font-body text-[14px] text-ink-soft">${ico('check','text-[16px] text-clay mt-0.5 flex-none')} ${f}</li>`).join('')}</ul>
  </div>`;
}
const pricing = `
<section class="bg-white max-w-5xl mx-auto px-5 md:px-8 py-20 md:py-28">
  <div class="text-center max-w-2xl mx-auto mb-12">
    <h2 class="font-headline text-3xl md:text-4xl text-ink">Start free. Upgrade <span class="italic text-ink-faint">when you’re ready</span>.</h2>
    <p class="font-body text-lg text-ink-soft mt-3">Everything you need to cook and track is free. Pro adds deeper insight and unlimited imports.</p>
  </div>
  <div class="flex flex-col md:flex-row gap-5 max-w-3xl mx-auto">
    ${priceCard('Free','£0','','Track calories & macros,Save up to 25 recipes,Cook mode & meal logging,Daily targets',false)}
    ${priceCard('Pro','£7.99','/mo · or £59.99/yr','Everything in Free,Unlimited recipe imports,Full macro & micro insights,Weekly recap & trends,Fasting & plan tools',true)}
  </div>
</section>`;

/* ---------- FINAL CTA ---------- */
const cta = `
<section class="bg-white">
  <div class="max-w-3xl mx-auto px-5 py-20 md:py-28 text-center">
    <h2 class="font-headline text-4xl md:text-6xl text-ink leading-[1.05]">Cook what you love.<br/><span class="italic">Still</span> reach your goals.</h2>
    <p class="font-body text-lg text-ink-soft mt-5">Join the people fitting the food they love into the life they want.</p>
    <a class="inline-flex items-center justify-center gap-2 bg-clay text-white font-body font-semibold text-base rounded-full px-8 py-4 mt-9">${ico('apple','text-[18px]')} Get the app — it’s free</a>
  </div>
</section>`;

/* ---------- FOOTER (charcoal grounding) ---------- */
const footer = `
<footer class="bg-ink text-white/60">
  <div class="max-w-6xl mx-auto px-5 md:px-8 py-14 md:flex md:justify-between gap-8">
    <div class="max-w-xs">
      <span class="font-headline text-2xl font-semibold text-white">Sloe</span>
      <p class="font-body text-sm mt-3 leading-relaxed">The recipe + nutrition app for people who love food and have goals.</p>
    </div>
    <div class="grid grid-cols-3 gap-8 mt-10 md:mt-0 font-body text-sm">
      ${[['Product',['Recipes','How it works','Pricing','Download']],['Company',['About','Blog','Careers']],['Legal',['Privacy','Terms','Contact']]].map(([h,items])=>`<div><p class="font-label text-[12px] uppercase tracking-[0.12em] text-white/40 mb-3">${h}</p>${items.map(i=>`<a class="block py-1 hover:text-white">${i}</a>`).join('')}</div>`).join('')}
    </div>
  </div>
  <div class="border-t border-white/10"><div class="max-w-6xl mx-auto px-5 md:px-8 py-5 font-body text-[13px] text-white/40">© 2026 Sloe · Made for people who love food.</div></div>
</footer>`;

const body = `${nav}${hero}${trending}${wedge}${how}${devices}${pricing}${cta}${footer}`;

console.log(writeScreen('landing.html','Sloe · Cook what you love. Still reach your goals.', body, { web:true, bodyClass:'bg-white text-ink font-body antialiased' }));
