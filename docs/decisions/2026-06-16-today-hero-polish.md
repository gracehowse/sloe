# Today hero polish — density, stat-label weight, stat size, chip contrast

**Date:** 2026-06-16
**Status:** Resolved — implemented (mobile `274a30f9` + web mirror) on `claude/today-hero-polish`
**Area:** Design system / Today tab hero (mobile + web)
**Builds on:** `docs/decisions/2026-06-16-deepen-ground-for-flat-cards.md` (the ground deepening). Grounded in a `design-director` critique + a Mobbin study of the category (MacroFactor, Cal AI, Yazio, Lifesum, Bevel).

## Problem

Founder review of Today: *"is there too much background? is the spacing wrong? are the fonts right? should the smaller fonts be bigger? or less bold?"* The Mobbin study confirmed Sloe was an **outlier on emptiness** — every comparable fits header + hero + macro summary + first content above the fold; Sloe showed only header + day-strip + one big ring card. The hero also had a shouty-and-faint GOAL/EATEN/BONUS label (700-weight tracked caps in sub-AA tertiary grey), a footnote-sized stat row, and a faint "Under budget" chip.

The ring itself is **locked** (founder: "leave the ring"), so the levers are the space *around* it and the type.

## Decision (the changes)

Token-level, mobile + web in lockstep:

1. **Hero card voids** — card padding `lg`(20)→`md`(16); the stats-row top void `md`+`xs` (20pt) → `sm` (8pt). Removes ~24pt of empty white from the cold-open card; the macro tiles now show their **values** above the fold, not just labels. Web: `pt-3 mt-1`→`pt-2`.
2. **Stat labels** — new `Type.statLabel` token (600 weight / 0.5 tracking / uppercase) replacing `Type.label` (700 / 0.88); colour moved **tertiary→secondary** (`#9B93A3` 2.6:1 → `#6A6072`/`#655C6E` ~5:1, AA). Calm section label, not shouty sub-AA caps. Web: `text-[10px] tertiary` → `text-[11px] secondary`.
3. **Stat values** — `Type.statValue` 18→22 / lineHeight 22→26, so Goal/Eaten/Bonus reads as a real stat row, not a footnote under the 48px ring numeral. Web: `text-[18px]`→`text-[22px]` (22 = on the type ramp `--text-xl`; 20 was off-scale, caught by the ENG-119 type-scale lint).
4. **"Under budget" chip** — text/icon → solid sage (`#466046`, 6.95:1) on a slightly stronger tint, was the lighter sage (~4:1). Icon 13→14. Web: `text-success`→`text-success-solid`.

## Why these and not more

The `design-director` flagged three **bigger** moves as prototype-first / founder-call, deliberately **not** taken here: a compact macro strip inside the hero (collides with the "no duplicate hero content" rule and fights the multi-ring differentiator), collapsing the Lunch action stack (IA change), and dropping the date from the greeting (copy-meaning change). Those stay open.

## Validation

iOS sim, light: rendered + forensically confirmed (GOAL label ink measured gray **95** = the darker secondary, vs 150 pre-change; card tightened; tiles' values now above the fold). Mobile + web typecheck clean; mobile token/elevation tests + 41 web hero tests green. Dark mode unaffected (no dark tokens touched).

## Deferred (tracked, not dropped — follow-up PR)

- **#5** the muted "Pick a few recipes" north-star row reads as disabled (icon→primary + quiet-fill container).
- **#6** macro-tile bottom dead-space (`minHeight` 64→56, tier-V1).
