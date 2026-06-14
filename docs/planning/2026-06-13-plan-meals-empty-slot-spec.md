# Plan / meals empty-slot redesign — "Purposeful empties" (ENG-1092)

**Date:** 2026-06-13 · **Status:** **increment 1 (Today) + increment 2 (Plan day cards) SHIPPED** (default-on, web+mobile); **increment 3 (web config-chip collapse) BUILT, default-OFF** — awaiting Grace's red-line on the rendered popover before ramp · **Source:** design panel (3 ui-product-designer directions → design-director synthesis) + Lifesum study (`docs/ux/research/2026-06-13-lifesum-inspiration.md`).

## Shipped log
- **Increment 1 (Today empty slots → "Aim ~X kcal")** — PR #437. Redistributing `distributeMealBudget` source; full-opacity empties; Snacks suppressed (diversity-inclusion + brand-manager sign-off); flag `plan_today_aim_empty_v1` default-on.
- **Increment 2 (Plan day cards → "Aim ~X kcal")** — same `plan_today_aim_empty_v1` flag (the shared spine). Static `slotMacroTargets` source (dietitian ratio breakfast .25 / lunch .3 / dinner .35 / snack .1 → Breakfast ~310 / Lunch ~370 / **Dinner ~430** / Snacks suppressed on a ~1,231 day — note the higher dinner vs Today's .30). Web: aim on both the absent-slot card AND the placeholder row; the fresh 7-day grid now reads its purpose. Mobile: the "No meals planned" empty-day block replaced by informational canonical slot rows with aims (web parity); add-back chip strip suppressed on the fresh day (Generate is the action). SEE-verified web + iOS sim — numbers match across platforms. Two deferrals tracked in **ENG-1100** (shared `EmptyMealSlotRow` extraction; always-render canonical rows on *partial* mobile days). Helper made case-insensitive for the optional-slot check (web passes lowercase slot names).
- **Increment 3 (web config-chip collapse)** — flag `plan_adjust_collapsed_v1`, **web-only, default-OFF** (mobile already collapses its config into chips→sheets; this is web parity catch-up). The three always-open rows (Plan length / Slots / Start) collapse behind ONE ghost **"Adjust plan"** control that shows the current settings (`7 days · Today · All meals` — defaults stay loud) and opens a Radix popover with the three grouped pickers. Flag-off keeps the inline rows verbatim. SEE-verified web (flag-on collapsed + popover open; flag-off legacy rows). Default-off because it's structural (hides controls) — **Grace red-lines the rendered popover, then ramps via PostHog.** Platform deviation from the mobile two-chip pattern is intentional (web-native popover vs mobile bottom sheets; the *feature* — collapsed, discoverable config — is at parity).

## Problem

Grace: the Plan "This week" page is "a bit dull." Verified (web `/planner`): a **wall of grey config pill-chips** (PLAN LENGTH / SLOTS / START, permanently expanded above the content) + day cards whose every slot is a flat grey **"Empty slot"** with no colour, imagery, or purpose. Today's empty meal slots (just shipped per-slot rows, ENG-1095) similarly show only a name + "+".

## Concept — "Purposeful empties"

Every empty meal slot — the four Plan day-card slots AND the four Today slot cards — stops saying "Empty slot"/"Empty" and states its purpose: **tinted slot icon + Newsreader slot name + "Aim ~X kcal" + a quiet "+"**. The grey config-chip wall collapses behind one tertiary "Adjust plan" control so the now-purposeful day cards lead.

### Microcopy — "Aim ~X kcal" (not "Recommended", not a range)
- Single tilde value, not a band. Our budget helpers return a single redistributed value; a made-up ±range is **fabricated precision** (violates the trust posture — a range reads as *more* measured). The "~" carries the estimate honestly.
- "Aim" is **permissive / body-neutral**; "Recommended" reads prescriptive/clinical (diet-culture adjacent). Sloe voice is permission, not prescription.
- A single number scans faster than a hyphenated range across four stacked rows.
- **Pre-ship gate:** route the "Aim ~X kcal" microcopy to **brand-manager + diversity-inclusion** for explicit sign-off before ramp (a number on every empty slot is a real diet-culture perception risk).

### Recommended-kcal sources (intentionally different per surface — document, don't let sync-enforcer flag as drift)
- **Today:** `distributeMealBudget(effectiveCalorieTarget, fiberTarget, consumed)` — **already computed in `today-meals-section.tsx` and discarded today**; wire it through. It **redistributes consumed calories** across still-empty slots, so partial-day aims shrink/grow honestly (eat over at breakfast → lunch/dinner aims drop).
- **Plan:** `slotMacroTargets(daySlotNames, plannerTargets)[i].calories` — already used by swap; the static dietitian ratio (Breakfast 0.25 / Lunch 0.30 / Dinner 0.30 / Snacks 0.15). Round to nearest 5.
- **⚠ Bug trap (highest-likelihood):** `distributeMealBudget` returns `calories: 0` for ANY slot once `consumed > 0` (mealBudget.ts ~77). The aim line MUST be gated on **(slot fully empty via `hasMeals`) AND (computed kcal > 0)** — a populated slot renders its real macro chips, never the helper's 0; a day already at/over budget shows an empty card with just name + "+" (never "Aim ~0 kcal"). Pin with a partial-day fixture.

## Surface specs

- **Plan day card:** remove the whole-day "No meals planned…" block + the bottom "Add" missing-slot chip strip; a day always renders its (enabled) canonical slot rows. Day eyebrow keeps weekday + TODAY pill + day-total kcal in neutral (0-of-target is NOT amber/red). Full opacity (no 0.55 dim). Row chassis identical to a populated row.
- **Today meal card:** enhance — don't replace — ENG-1095. Keep the flat-white SupprCard shell, tinted icon chip, Newsreader name, trailing "+". Add the "Aim ~X kcal" line in the **exact slot the macro chips occupy on a populated card**, so empty & full cards share one rhythm.
- **Config collapse (web only — parity catch-up to mobile, which already collapses):** replace the four always-open chip groups with ONE tertiary "Adjust plan" control (Sliders glyph, ghost) under Generate, opening a popover with length/start/slots grouped. The "Plan your week" white card + **solid aubergine Generate** (the one filled CTA) are unchanged. Keep defaults loud so a returning MFP refugee still discovers adjustability.
- **Optional thumbnail graft (sub-condition inside flag 1):** when a **deterministic** per-slot suggestion resolves (seed by date+slot — never re-rolled on render), the icon chip becomes a recipe thumbnail tease. Cold-start / thin library falls back cleanly to the tinted icon (never fake a thumbnail). If churny, short-circuit the resolver — the aim line is the floor.

## Shared primitive
Extract ONE `EmptyMealSlotRow` per platform, consumed by both Today + Plan (byte-identical icon family / copy / tint / kcal treatment), pinned by a parity test (model on `mealSlotIconFamilyParity` / `todayCopyParity`) — or it re-introduces the near-duplicate drift failure mode.

## Flag plan (two flags, old path alive in the else)
1. **`plan_today_aim_empty_v1`** — the spine (+ thumbnail graft as a sub-condition), all four surfaces (Today + Plan, web + mobile). OFF = current "Empty slot" / bare-name empties.
2. **`plan_adjust_collapsed_v1`** — web config-collapse only. OFF = the four pill rows.
iOS leads, web in the same change (parity non-negotiable). Remove gates only after 100% holds 2 weeks.

## Risks (from the panel)
- Diet-culture perception → brand-manager + diversity-inclusion sign-off (above).
- calories:0 partial-day bug (above) — the single most likely implementation bug.
- Plan vs Today source divergence is intentional — document + parity-test comment.
- Snacks 0.15 → small aims (~150–220); QA "Aim ~180 kcal" reads permissive, not "you must snack."
- Round-to-5 → four aims won't sum to the day target; never present them as an exact breakdown.
- Removing the web chip wall is structural → must ship behind flag 2 with the pills alive in the else.

## Next
Grace red-lines the prototype (rendered in chat 2026-06-13). On approval: route microcopy to brand-manager/diversity-inclusion → build behind the two flags (iOS-led, web parity) → tests (incl. the partial-day calories:0 fixture + the EmptyMealSlotRow parity test) → decision doc → Notion/Linear mirror.
