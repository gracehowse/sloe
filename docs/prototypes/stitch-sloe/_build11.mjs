import { writeScreen, ico, backHeader, appBar, tabBar } from './_gen.mjs';

/* ============================ M1 · AUTH (Sign up / Log in) ============================ */
function authBtn(icon, label, cls){
  return `<button class="w-full flex items-center justify-center gap-2.5 ${cls} font-body font-semibold text-base rounded-full py-3.5">${icon} ${label}</button>`;
}
const apple = `<svg class="sloe-ico text-[20px]" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.62 3.248-1.66.03.13.05.28.05.41zM20.5 17.2c-.61 1.36-.9 1.96-1.69 3.16-1.1 1.67-2.65 3.75-4.57 3.76-1.7.02-2.14-1.11-4.45-1.1-2.31.01-2.79 1.12-4.49 1.1-1.92-.01-3.39-1.89-4.49-3.56C-1.61 16.1-1.93 9.9 1.06 6.61c1.06-1.17 2.59-1.91 4.07-1.91 1.62 0 2.64 1.11 3.98 1.11 1.3 0 2.09-1.11 4.07-1.11 1.32 0 2.72.72 3.71 1.96-3.26 1.79-2.73 6.45.54 7.74z"/></svg>`;
const gApi = `<svg class="sloe-ico text-[19px]" viewBox="0 0 24 24" fill="none" stroke="none"><path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5 5 0 0 1-2.19 3.3v2.74h3.54c2.07-1.9 3.25-4.72 3.25-7.88z"/><path fill="#34A853" d="M12 23c2.94 0 5.42-.97 7.22-2.64l-3.54-2.74c-.98.66-2.24 1.05-3.68 1.05-2.83 0-5.23-1.91-6.09-4.48H2.27v2.82A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.91 14.19a6.6 6.6 0 0 1 0-4.21V7.16H2.27a11 11 0 0 0 0 9.85l3.64-2.82z"/><path fill="#EA4335" d="M12 5.5c1.6 0 3.03.55 4.16 1.62l3.12-3.12C17.42 2.18 14.94 1 12 1A11 11 0 0 0 2.27 7.16l3.64 2.82C6.77 7.41 9.17 5.5 12 5.5z"/></svg>`;
const auth = `
<header class="px-5 pt-4 pb-2 flex justify-end"><button class="text-ink-soft p-1">${ico('x','text-2xl')}</button></header>
<main class="px-6 max-w-2xl mx-auto flex flex-col min-h-[80vh]">
  <div class="flex-1 flex flex-col justify-center text-center">
    <span class="font-headline text-3xl font-semibold text-plum mb-5">Sloe</span>
    <h1 class="font-headline text-3xl text-ink">Cook what you love.<br/><span class="italic">Still</span> reach your goals.</h1>
    <p class="font-body text-sm text-ink-soft mt-3 max-w-xs mx-auto">Create an account or log in — your recipes and plan sync everywhere.</p>
  </div>
  <div class="space-y-3 pb-4">
    ${authBtn(apple,'Continue with Apple','bg-ink text-white')}
    ${authBtn(gApi,'Continue with Google','bg-surface border border-line text-ink')}
    ${authBtn(ico('mail','text-[18px]'),'Continue with email','bg-surface border border-line text-ink')}
    <p class="font-body text-[12px] text-ink-faint text-center pt-2 leading-relaxed">By continuing you agree to our <span class="text-ink underline">Terms</span> and <span class="text-ink underline">Privacy Policy</span>.</p>
  </div>
</main>`;

/* ============================ M2 · NOTIFICATIONS / REMINDERS ============================ */
function reminderRow(label, time, on, sub){
  return `<div class="flex items-center justify-between py-3.5 border-b border-line last:border-0">
    <div><p class="font-body text-[15px] text-ink leading-tight">${label}</p><p class="font-body text-xs text-ink-faint mt-0.5">${time}${sub?` · ${sub}`:''}</p></div>
    <span class="w-11 h-6 rounded-full ${on?'bg-clay':'bg-line'} relative flex-none"><span class="absolute top-0.5 ${on?'right-0.5':'left-0.5'} w-5 h-5 rounded-full bg-white shadow-sm"></span></span>
  </div>`;
}
function reminderGroup(title, rows){ return `<section><h2 class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-2 px-1">${title}</h2><div class="bg-surface-card border border-line rounded-2xl px-4">${rows}</div></section>`; }
const notifications = `
${backHeader('Reminders')}
<main class="px-5 pt-5 pb-10 max-w-2xl mx-auto space-y-6">
  <p class="font-body text-sm text-ink-soft">Gentle nudges to log and stay on track — never spammy.</p>
  ${reminderGroup('Meals', reminderRow('Breakfast','7:50 AM',true)+reminderRow('Lunch','1:00 PM',false)+reminderRow('Dinner','7:30 PM',true))}
  ${reminderGroup('Your day', reminderRow('End-of-day check-in','9:00 PM',true,'one reminder for the whole day')+reminderRow('Save your streak','9:45 PM',true,'only if you haven’t logged'))}
  ${reminderGroup('Weekly', reminderRow('Weigh-in','Mondays · 7:30 AM',true)+reminderRow('Your week recap','Sundays · 6:00 PM',true))}
</main>`;

/* ============================ M3 · RECIPE SEARCH RESULTS ============================ */
function searchCard(img, title, rating, time, ingredients){
  return `<div class="recipe-card cursor-pointer rounded-2xl overflow-hidden bg-surface border border-line">
    <div class="aspect-[4/3] overflow-hidden relative"><img src="img/${img}" class="w-full h-full object-cover"/><span class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-clay">${ico('bookmark','text-[15px]')}</span></div>
    <div class="p-3">
      <div class="flex items-center gap-1 mb-1"><svg class="sloe-ico text-[13px] text-clay" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11.5 2.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3 8.7l5.9-.9z"/></svg><span class="font-body text-[12px] text-ink font-medium">${rating}</span><span class="font-body text-[12px] text-ink-faint">· ${time}</span></div>
      <p class="font-headline text-[15px] text-ink leading-tight">${title}</p>
      <p class="font-body text-[12px] text-ink-faint mt-1">${ingredients}</p>
    </div>
  </div>`;
}
const search = `
<header class="px-5 pt-4 pb-3 flex items-center gap-3 sticky top-0 bg-surface z-10">
  <button class="text-ink p-1 -ml-1">${ico('chevron-left','text-2xl')}</button>
  <div class="flex-1 flex items-center gap-2.5 bg-surface-card border border-line rounded-full px-4 py-2.5">${ico('search','text-[18px] text-ink-faint')}<span class="font-body text-sm text-ink">high protein dinner</span></div>
</header>
<main class="px-5 pb-6 max-w-2xl mx-auto">
  <div class="flex items-center gap-2 mb-4 overflow-x-auto -mx-5 px-5 pb-1">
    <span class="inline-flex items-center gap-1.5 font-label text-[13px] font-medium px-3.5 py-2 rounded-full bg-ink text-white">${ico('sliders-horizontal','text-[14px]')} Filters · 2</span>
    ${['Under 500 cal','Quick 30','Chicken','Vegetarian'].map(c=>`<span class="font-label text-[13px] font-medium px-3.5 py-2 rounded-full bg-surface-card border border-line text-ink-soft whitespace-nowrap">${c}</span>`).join('')}
  </div>
  <p class="font-body text-[13px] text-ink-faint mb-3">42 recipes · sorted by fit</p>
  <div class="grid grid-cols-2 gap-3">
    ${searchCard('1eded18039f9.png','Chicken Kale Salad','4.8','20 min','Chicken · kale · parmesan')}
    ${searchCard('a6610a1bee6c.png','Warm Tahini Grain Bowl','4.7','25 min','Chickpeas · tahini · greens')}
    ${searchCard('babbc6edccce.png','Three Cheese Fusilli','4.9','30 min','Fusilli · parmesan · gruyère')}
    ${searchCard('7a448cef1613.png','Crispy Gnocchi Traybake','4.6','35 min','Gnocchi · tomatoes · basil')}
  </div>
</main>
${tabBar('Recipes')}`;

console.log(writeScreen('auth.html','Sloe · Log in or sign up', auth));
console.log(writeScreen('notifications.html','Sloe · Reminders', notifications));
console.log(writeScreen('search-results.html','Sloe · Search results', search));
