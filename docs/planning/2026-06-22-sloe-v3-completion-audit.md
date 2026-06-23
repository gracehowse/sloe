# Sloe v3 reskin — completion audit (2026-06-22)

Multi-agent audit (11 agents: 10 per-surface assessors + 1 synthesis) of how much
of the v3 reskin is implemented, grounded in the current code vs the prototype
(`docs/ux/redesign/v3/Sloe-App.html`). Supersedes the 2026-06-21 baseline
(`2026-06-22-sloe-v3-gap-backlog.md`, which said ~55–60%).

## Overall: ~68% complete

Up from 55–60% as the recent work landed (P0 tokens, jewel ring in real heroes,
macro Tiles/Bars/Rings, **ENG-1223 full mobile dark-mode macro migration**, #14
creator rail, mobile Report sheet, recipe_reports queue, energy equation, web
Apple Health card, and the #4 mobile WeeklyRecap card just shipped).

Two debts hold the number back:
1. **Not "one path" yet** — the signature ring, the whole v3 cook experience,
   and the energy equation are BUILT but render only behind default-OFF / un-
   collapsed flags, so today's user often still sees the pre-v3 path.
2. **Whole pre-v3 surfaces** — Plan IA, editorial Profile, in-app Billing, the
   unified import classifier, daily Digest.

## Per-surface

| Surface | % | Status |
|---|---|---|
| Tokens / theming / dark / primitives | 85 | Mature, cross-platform-verified; jewel ring built+wired but behind default-OFF `sloe_v3_ring` (legacy concentric ring is the cold default) |
| Today | 82 | Most mature; jewel dial + ENG-1223 recolour + 3-way macro switcher landed; gaps structural (carded vs flat-float hero) + ~17 un-collapsed flags |
| Onboarding | 82 | Conformant to the *ratified* spec; reveal ring still hand-rolled (not the jewel dial), web ruler serif numeral |
| Progress | 80 | v3 frame is the single collapsed path; energy EQUATION missing on mobile / flag-OFF on web; 3 default-OFF web refinement flags |
| Recipes (detail/cook/cookbook) | 76 | Detail ~90% at parity; cook mode ~95% BUILT but ~0% VISIBLE (5 polish flags default-OFF); cookbook grid weakest (flat vs editorial shelves) |
| Logging hub + secondary | 68 | Daily-loop flows mature at parity; the import cluster (detect-anything #3 + MFP mapping #7) is pre-v3 + fragmented — carries both launch-blockers |
| Discover | 62 | Core reskin done at parity; editorial STRUCTURE (featured hero, collections tiles, true Following feed, named shelves) mostly unbuilt; 2 default-ON import flags |
| Profile / Settings / Paywall / Billing | 52 | Paywall most complete; Settings mid (web single-pane not two-pane); Profile low (~30%, editorial unbuilt); in-app Billing absent both platforms |
| Growth + commerce (Coach/Digest/Recap/Billing) | 42 | Primitives done but v3 destinations mostly missing — no Coach screen, no in-app Billing, no daily Digest; **mobile recap card now wired (#4 done)** |
| Plan | 30 | Token skin + functional parity reached, but the prototype's structural IA (day-selector, verdict row, calorie band, week-across filter, two-column web) ~0% built; no `sloe_v3_plan` flag |

## Remaining effort

S: 18 · M: 13 · L: 9 · XL: 4 — **42–60 working days to 100% v3 across both
platforms** (~9–12 weeks single-stream; **~3–4 weeks if the XL/L structural
builds are parallelised across agents**). Excludes the TodayScreen/Nutrition-
Tracker host-extraction refactor (plan-exit hygiene, not v3-pixel work).

## Launch blockers (5)

1. ✅ **Mobile shareable WeeklyRecap (#4)** — DONE 2026-06-22 (`eb7b9ad0`).
2. **Unified detect-anything importer #3** (XL, both) — THE viral wedge; build the
   shared classifier (recipe/reel/collection/plan/CSV + "Detected: {label}" chip)
   + one Import sheet. iOS-first. Largest remaining blocker.
3. **MFP/CSV column-mapping + preview #7** (L, both) — the MFP-refugee trust moment.
4. **Ramp + collapse the 5 cook-mode flags** (M, both) — entire v3 cook baseline is
   built but dark-by-default. ~~Pure ramp/verify/collapse, no new code.~~
   **CORRECTION (2026-06-22, on-device SEE):** NOT pure ramp — turning the flags on
   makes ALL cook-mode step content invisible (`cook_swipe_steps_v1` /
   `CookStepSwipeSurface` hides its children in `recipe/[id].tsx`'s inline cook
   overlay). Flags reverted to default-OFF; fix tracked in **ENG-1230** (must land +
   per-flag on-device validation before re-flipping). This is why the plan's original
   "keep cook off" was right.
5. **Collapse the `sloe_v3_ring` gate** (M, both) — make the jewel dial the single
   path (delete the legacy ring else-branches in the 3 heroes).

## Next 3 builds

1. **Flag-collapse sweep** *(needs Grace decision — ramp % not readable from code)*:
   flip + collapse `sloe_v3_ring`, the 5 cook flags, `sloe_v3_energy_equation` + 3
   web Progress flags, `web_meal_nutrition_detail` (parity break), reveal paired-pct.
   Near-free correctness that lights up already-built work — highest leverage.
2. ✅ **Wire the mobile WeeklyRecap** — DONE.
3. **Build the unified import classifier + single Import sheet** (iOS-first) — the wedge.

## Flag-collapse debt

~20+ transient/redesign flags un-collapsed, three classes:
- **Built-but-dark (default-OFF):** `sloe_v3_ring`, the 5 cook flags,
  `sloe_v3_energy_equation`, `web_apple_health_card`, `web_progress_weight_empty`,
  reveal paired-pct.
- **Asymmetric parity break:** `web_meal_nutrition_detail` (mobile live, web OFF).
- **Default-ON but un-collapsed (dead legacy else still attached):**
  `redesign_winmoment`, `card_cohesion_white_v1`, the 3 paywall flags,
  `fit_verdict_banner_v1`, `recipe_runtime_image_generation_v1`, the 2 discover
  import flags, `today_tracker_tier_v1`, `today_coach_in_hero_v1`.

No `sloe_v3_*` umbrella exists for Plan/Discover/Recipes/Settings/import — those
v3 paths aren't built, so there's nothing to collapse there yet.
