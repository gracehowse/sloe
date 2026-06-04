import { writeScreen, ico, backHeader } from './_gen.mjs';

function weekBars(heights, colorCls) {
  const days = ['M','T','W','T','F','S','S'];
  return `<div class="flex items-end gap-1">${heights.map((h,i)=>`<div class="flex-1 flex flex-col items-center gap-2"><div class="w-full flex items-end justify-center" style="height:120px"><div class="w-7 rounded-md ${i===heights.length-1?colorCls:colorCls+'/35'}" style="height:${Math.round(h*120)}px"></div></div><span class="font-label text-[10px] text-ink-faint">${days[i]}</span></div>`).join('')}</div>`;
}

/* ---------------- BURN DETAIL ---------------- */
function burnRow(icon, iconCls, title, sub, val){
  return `<div class="flex items-center gap-3 py-3.5 border-b border-line last:border-0">
    <span class="w-10 h-10 rounded-full ${iconCls.bg} flex items-center justify-center ${iconCls.fg}">${ico(icon,'text-[18px]')}</span>
    <div class="flex-1"><p class="font-headline text-[15px] text-ink leading-tight">${title}</p><p class="font-body text-xs text-ink-faint">${sub}</p></div>
    <span class="font-body text-sm font-semibold text-ink">${val}</span>
  </div>`;
}
const burn = `
${backHeader('Energy out', ico('ellipsis'))}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-8">
  <section class="bg-surface-card border border-line rounded-2xl p-6 text-center">
    <span class="inline-flex w-12 h-12 rounded-full bg-amber/15 items-center justify-center text-amber mb-3">${ico('flame','text-2xl')}</span>
    <div class="flex items-baseline justify-center gap-2"><span class="font-headline text-5xl text-ink">2,250</span><span class="font-body text-lg text-ink-soft">kcal</span></div>
    <p class="font-body text-sm text-ink-faint mt-1">burned today · feeds a 410 kcal deficit</p>
  </section>
  <section>
    <h2 class="font-headline text-xl text-ink mb-1">Where it came from</h2>
    <div>
      ${burnRow('heart-pulse',{bg:'bg-clay/12',fg:'text-clay'},'Resting (BMR)','Your body at rest','1,520')}
      ${burnRow('footprints',{bg:'bg-sage/15',fg:'text-sage'},'Steps &amp; movement','9,240 steps','410')}
      ${burnRow('dumbbell',{bg:'bg-honey/18',fg:'text-honey'},'Strength workout','45 min · upper body','320')}
    </div>
  </section>
  <section>
    <div class="flex items-baseline justify-between mb-4"><h2 class="font-headline text-xl text-ink">This week</h2><span class="font-body text-[13px] text-ink-faint">avg 2,180 kcal</span></div>
    ${weekBars([0.78,0.82,0.74,0.9,0.8,0.95,0.88],'bg-amber')}
  </section>
  <p class="font-headline italic text-base text-ink text-center px-6">"Move a little, eat what you love — the deficit takes care of itself."</p>
</main>`;

/* ---------------- MEAL NUTRITION ---------------- */
function nutri(label, val, indent){
  return `<div class="flex items-center justify-between py-2.5 ${indent?'pl-4':''} border-b border-line last:border-0">
    <span class="font-body text-sm ${indent?'text-ink-soft':'text-ink font-medium'}">${label}</span>
    <span class="font-body text-sm ${indent?'text-ink-soft':'text-ink font-semibold'}">${val}</span></div>`;
}
function macroChip(name, val, colorCls){
  return `<div class="flex-1 bg-surface-card border border-line rounded-xl py-3 text-center">
    <p class="font-headline text-2xl ${colorCls}">${val}</p><p class="font-label text-[11px] uppercase tracking-[0.06em] text-ink-faint mt-0.5">${name}</p></div>`;
}
const meal = `
${backHeader('Chicken Grain Bowl', ico('ellipsis'))}
<main class="pb-10 max-w-2xl mx-auto">
  <div class="w-full aspect-[16/10] bg-surface-card overflow-hidden"><img src="img/a6610a1bee6c.png" class="w-full h-full object-cover"/></div>
  <div class="px-5 pt-5 space-y-7">
    <div class="flex items-center justify-between">
      <div><p class="font-label text-[11px] uppercase tracking-[0.08em] text-ink-faint">Lunch · 1 serving</p><p class="font-headline text-2xl text-ink">580 <span class="text-lg text-ink-soft font-body">kcal</span></p></div>
      <span class="inline-flex items-center gap-1.5 bg-frost-mist text-sage font-label text-xs font-semibold px-2.5 py-1 rounded-full">${ico('circle-check','text-[14px]')} Fits your day</span>
    </div>
    <div class="flex gap-3">
      ${macroChip('Protein','38g','text-macro-protein')}
      ${macroChip('Carbs','52g','text-macro-carbs')}
      ${macroChip('Fat','18g','text-macro-fat')}
    </div>
    <section>
      <h2 class="font-headline text-lg text-ink mb-1">Nutrition</h2>
      <div>
        ${nutri('Protein','38 g')}
        ${nutri('Carbohydrate','52 g')}
        ${nutri('Fibre','9 g',true)}
        ${nutri('Sugars','6 g',true)}
        ${nutri('Fat','18 g')}
        ${nutri('Saturated','4 g',true)}
        ${nutri('Unsaturated','13 g',true)}
        ${nutri('Sodium','480 mg')}
        ${nutri('Potassium','720 mg')}
      </div>
    </section>
    <div class="flex gap-3 pt-1">
      <button class="flex-1 bg-surface-card border border-line text-ink font-body font-semibold text-sm rounded-full py-3 flex items-center justify-center gap-2">${ico('pencil','text-[16px]')} Edit</button>
      <button class="flex-1 text-destructive font-body font-semibold text-sm rounded-full py-3 flex items-center justify-center gap-2">${ico('trash-2','text-[16px]')} Remove</button>
    </div>
  </div>
</main>`;

/* ---------------- PROGRESS METRIC (Weight) ---------------- */
function rangeToggle(active){
  return `<div class="inline-flex bg-surface-card border border-line rounded-full p-1 w-full">${['7d','30d','90d','All'].map(r=>`<span class="flex-1 text-center font-label text-[13px] font-semibold py-1.5 rounded-full ${r===active?'bg-surface text-ink shadow-sm':'text-ink-faint'}">${r}</span>`).join('')}</div>`;
}
function stat(label,val,cls){return `<div class="flex-1"><p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">${label}</p><p class="font-headline text-xl ${cls||'text-ink'} mt-1">${val}</p></div>`;}
// simple line chart polyline
const pts="20,70 75,64 130,66 185,52 240,55 295,44 350,46 405,38 460,40";
const metric = `
${backHeader('Weight', ico('plus','text-2xl'))}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-7">
  ${rangeToggle('30d')}
  <section class="bg-surface-card border border-line rounded-2xl p-6">
    <div class="flex items-end justify-between">
      <div><div class="flex items-baseline gap-2"><span class="font-headline text-5xl text-ink">74.2</span><span class="font-body text-lg text-ink-soft">kg</span></div>
      <p class="inline-flex items-center gap-1 font-body text-[13px] text-sage mt-1">${ico('trending-down','text-[15px]')} 0.4 kg this week</p></div>
      <span class="font-body text-[13px] text-ink-faint">Goal 72.0</span>
    </div>
    <svg viewBox="0 0 480 100" class="w-full mt-4" style="height:120px">
      <line x1="0" y1="86" x2="480" y2="86" stroke="#E8E2EC" stroke-dasharray="3 4"/>
      <polyline points="${pts}" fill="none" stroke="#C8794E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.split(' ').map(p=>{const[x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r="2.5" fill="#C8794E"/>`}).join('')}
    </svg>
  </section>
  <section class="flex gap-2">
    ${stat('Start','76.0 kg')}${stat('Current','74.2 kg')}${stat('Goal','72.0 kg')}${stat('Rate','−0.4/wk','text-sage')}
  </section>
  <section>
    <h2 class="font-headline text-xl text-ink mb-1">Recent entries</h2>
    <div>
      ${['Today · 74.2 kg','Sun · 74.4 kg','Fri · 74.6 kg','Wed · 74.5 kg'].map(e=>{const[d,v]=e.split(' · ');return `<div class="flex items-center justify-between py-3 border-b border-line last:border-0"><span class="font-body text-sm text-ink-soft">${d}</span><span class="font-body text-sm font-semibold text-ink">${v}</span></div>`}).join('')}
    </div>
  </section>
</main>`;

console.log(writeScreen('burn-detail.html','Sloe · Energy out', burn));
console.log(writeScreen('meal-nutrition.html','Sloe · Meal nutrition', meal));
console.log(writeScreen('progress-metric.html','Sloe · Weight', metric));
