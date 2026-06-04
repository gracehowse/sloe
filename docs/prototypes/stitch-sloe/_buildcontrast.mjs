import { writeScreen, appBar } from './_gen.mjs';

/* Decision aid (2026-06-03): accent-as-TEXT contrast on white.
   Base Figma hues are great as FILLS but several fall below 4.5:1 (AA body)
   as text. Show base vs a darker AA-safe variant so Grace can choose:
   (A) add darker variants into the Figma palette, or (B) use base hues for
   accent text like the designs (bold labels only, ~3:1). Computed ratios. */

function lum(hex){const n=parseInt(hex.slice(1),16);const r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;const f=c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}
const ratio=hex=>((1.05)/(lum(hex)+0.05));
const verdict=r=> r>=4.5?['AA body ✓','#5E7C5A'] : r>=3?['bold/large only','#C9892C'] : ['fails','#C0533F'];

const accents=[
  ['Clay','primary · links · CTA text','#C8794E','#A0552E'],
  ['Amber','warning · fat · estimated','#C9892C','#956619'],
  ['Sage','success · on-track','#5E7C5A','#466046'],
  ['Destructive','over-budget · error','#C0533F','#9E3F2E'],
];

function sample(label, hex){
  const r=ratio(hex); const [vt,vc]=verdict(r);
  return `<div class="flex-1">
    <span class="font-label text-[9px] uppercase tracking-wide text-ink-faint">${label}</span>
    <p class="font-headline text-xl mt-1" style="color:${hex}">Log today</p>
    <p class="font-body text-[13px] mt-0.5" style="color:${hex}">Fits your day · 12g protein</p>
    <div class="mt-2 font-body text-[11px] text-ink-soft tabular-nums">${hex} · ${r.toFixed(2)}:1</div>
    <span class="inline-block mt-1 font-label text-[9px] uppercase tracking-wide font-semibold" style="color:${vc}">${vt}</span>
  </div>`;
}
function card([name,role,base,dark]){
  return `<section class="mb-4"><div class="bg-surface-card rounded-xl border border-line p-5">
    <div class="flex items-center gap-2.5 mb-4"><span class="w-5 h-5 rounded-full" style="background:${base}"></span><div><span class="font-headline text-base text-ink">${name}</span> <span class="font-body text-xs text-ink-faint">· ${role}</span></div></div>
    <div class="flex gap-4">${sample('Base (Figma)',base)}<div class="w-px bg-line"></div>${sample('AA-safe (darker)',dark)}</div>
  </div></section>`;
}

const body = `<div id="cap" class="mx-auto bg-surface" style="width:500px;min-height:100vh;position:relative">
${appBar()}
<main class="pt-3 px-4 pb-12">
  <section class="mt-2 mb-4"><h2 class="font-headline text-2xl text-plum">Accent text on white</h2><p class="font-body text-sm text-ink-soft mt-1">Base Figma hues are perfect as <b>fills</b> (rings, dots, buttons). As <b>text</b> on white, several fall below the 4.5:1 AA bar. Base vs a darker AA-safe variant:</p></section>
  ${accents.map(card).join('')}
  <section><div class="bg-frost-mist/50 rounded-xl border border-line p-5">
    <p class="font-body text-sm text-ink leading-relaxed"><b>A —</b> add the darker variants into the Figma palette as proper variables → use them for accent text/icons, base hues stay for fills.<br><br><b>B —</b> keep only the base Figma hues → use accent colour for text on <b>bold labels only</b> (~3:1), never body copy (body stays ink).</p>
  </div></section>
</main></div>`;
console.log(writeScreen('contrast-aa.html','Sloe · Accent text contrast', body));
