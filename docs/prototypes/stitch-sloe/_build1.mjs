import { writeScreen, ico, backHeader } from './_gen.mjs';

// 7-day bar chart helper (values 0..1 of target; target line at targetFrac)
function weekBars(heights, colorCls, targetTop) {
  const days = ['M','T','W','T','F','S','S'];
  const bars = heights.map((h,i)=>`<div class="flex-1 flex flex-col items-center gap-2">
    <div class="w-full flex items-end justify-center" style="height:128px">
      <div class="w-7 rounded-md ${i===heights.length-1?colorCls:colorCls+'/35'}" style="height:${Math.round(h*128)}px"></div>
    </div>
    <span class="font-label text-[10px] text-ink-faint">${days[i]}</span>
  </div>`).join('');
  return `<div class="relative">
    <div class="absolute left-0 right-0 border-t border-dashed border-ink-faint/40" style="top:${targetTop}px"></div>
    <div class="flex items-end gap-1">${bars}</div>
  </div>`;
}

function source(img, name, slot, amount) {
  return `<div class="flex items-center gap-3 py-3 border-b border-line last:border-0">
    <div class="w-11 h-11 rounded-xl overflow-hidden bg-surface-card border border-line flex-none"><img src="img/${img}" class="w-full h-full object-cover"/></div>
    <div class="flex-1 min-w-0">
      <p class="font-label text-[10px] uppercase tracking-[0.06em] text-ink-faint">${slot}</p>
      <p class="font-headline text-[15px] text-ink leading-tight truncate">${name}</p>
    </div>
    <span class="font-body text-sm font-semibold text-macro-protein">${amount}</span>
  </div>`;
}

const body = `
${backHeader('Protein', ico('ellipsis'))}
<main class="px-5 pt-6 pb-10 max-w-2xl mx-auto space-y-8">

  <!-- HERO -->
  <section class="bg-surface-card border border-line rounded-2xl p-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-full bg-macro-protein/15 flex items-center justify-center text-macro-protein">${ico('beef','text-[16px]')}</span>
        <span class="font-label text-xs uppercase tracking-[0.08em] text-ink-soft">Protein · Today</span>
      </div>
      <span class="inline-flex items-center gap-1.5 bg-frost-mist text-sage font-label text-xs font-semibold px-2.5 py-1 rounded-full">${ico('circle-check','text-[14px]')} On track</span>
    </div>
    <div class="mt-4 flex items-baseline gap-2">
      <span class="font-headline text-5xl text-ink">96</span>
      <span class="font-body text-xl text-ink-soft">g</span>
      <span class="font-body text-sm text-ink-faint ml-1">of 140 g goal</span>
    </div>
    <div class="mt-4 h-2.5 rounded-full bg-frost-mist overflow-hidden">
      <div class="h-full rounded-full bg-macro-protein" style="width:69%"></div>
    </div>
    <p class="mt-2 font-body text-[13px] text-ink-soft">44 g to go — about a chicken breast or a scoop of Greek yoghurt.</p>
  </section>

  <!-- THIS WEEK -->
  <section>
    <div class="flex items-baseline justify-between mb-4">
      <h2 class="font-headline text-xl text-ink">This week</h2>
      <span class="font-body text-[13px] text-ink-faint">avg 118 g · goal 140 g</span>
    </div>
    ${weekBars([0.62,0.81,0.74,0.9,0.7,0.85,0.69], 'bg-macro-protein', 12)}
  </section>

  <!-- TOP SOURCES -->
  <section>
    <h2 class="font-headline text-xl text-ink mb-1">Top sources today</h2>
    <div>
      ${source('4978a9fb6702.png','Brown Eggs','Breakfast','24 g')}
      ${source('e427c86a0d4f.png','Greek Yoghurt &amp; Berries','Snack','18 g')}
      ${source('a6610a1bee6c.png','Chicken Grain Bowl','Lunch','38 g')}
      ${source('7a448cef1613.png','Overnight Oats','Breakfast','12 g')}
    </div>
  </section>

  <p class="font-headline italic text-base text-ink text-center px-6">"You hit protein 4 of the last 5 days — that consistency is what builds the result."</p>
</main>`;

console.log(writeScreen('macro-detail.html', 'Sloe · Protein detail', body));
