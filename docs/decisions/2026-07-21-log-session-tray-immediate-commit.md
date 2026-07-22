# Log-sheet session tray — immediate-commit multi-add (ENG-1643)

**Date:** 2026-07-21
**Status:** Ratified — Grace (option 2 of the ENG-757 research verdict, chosen
in-session after two-agent web research + repo-evidence review).
**Owner:** Claude (implementation) · Grace (ratification).
**Normative spec:** `docs/specs/2026-07-21-log-session-tray.md`.
**Journey:** `docs/journeys/log-sheet.md` → "2026-07-21 — session tray".
**Tickets:** ENG-1643 (this) · supersedes ENG-757 · honors ENG-1462 · authority
chain ENG-1449 → ENG-1462 → ENG-757 research verdict → this.

## Problem

Today a multi-item meal (e.g. a 4-item dinner) costs **four full
sheet-open → search → pick → confirm → close cycles**: the S13 confirmation's
only forward exit closes the whole sheet
(`TodayScreen.tsx` `presentLogSheetConfirmation.onDone → setFabSheetOpen(false)`;
web `NutritionTracker.tsx → setLogSheetOpen(false)`). The 2026-06-11 teardown
rated this gap launch-blocker-grade; the shipped reality is worse than it
recorded. The blocker: how to make multi-add fast **without** re-introducing the
ENG-1449 silent-discard bug that ENG-1462 killed the staging basket to fix.

## Options weighed

1. **Rebuild the pre-commit staging basket (ENG-757's original design).**
   A cart the user fills, then commits as ONE combined `nutrition_entry`.
   *Rejected.* This is exactly the shape ENG-1462 retired on 2026-07-07 after
   ENG-1449 proved a pre-commit stage silently discards items on close (EATEN
   stayed 0, no toast). A CI regression pin (`logSheetOneCommitModel.test.ts`)
   now makes that failure class structurally unrepresentable — rebuilding it
   would mean deleting the guardrail. It also loses per-item editability, which
   the 5-year most-requested shape (meal bundles that stay per-item editable)
   wants. Cost: re-opens a closed, evidence-backed decision.

2. **Immediate-commit session tray (this decision).** Every add commits
   immediately through the existing one-commit path, but the sheet stays open
   and a *receipt* of committed items accumulates, with persistent per-item
   Undo, a running count + kcal, "Save as usual meal" at ≥ 2, and a Done that
   closes. There is no pending state anywhere, so closing in any state loses
   nothing. *Chosen.* Extends ENG-1462's presentation without weakening its
   commit semantics; matches the fastest-rated category loggers (see below);
   flag-gated so flag-OFF is byte-identical to today. Cost: the sheet gains a
   persistent bottom bar + an expanded panel (new surface, mitigated by the
   flag + the extraction that keeps pinned files at/under budget).

3. **Do nothing / keep S13-closes-sheet.** *Rejected.* Leaves a
   launch-blocker-grade friction the teardown already flagged; category ground
   truth shows the tedium (not instant-commit) is what users punish.

## Research summary (full verdict on the ENG-757 thread, 2026-07-21)

- **Category mechanics:** the fastest-rated loggers commit immediately and snap
  back to search. Only MacroFactor (Plate, hidden behind its default "speed
  mode") and Cronometer (opt-in, off by default) truly *stage*. The teardown's
  "Yazio/Lifesum baskets" were **post-commit session receipts** misread from
  static Mobbin screens — i.e. exactly this tray, not a pre-commit cart.
- **Sentiment:** tedium and weak undo are punished; instant-commit-on-add
  complaints do not appear in the wild. The most-requested shape is meal bundles
  that stay per-item editable — which retires ENG-757's combined-entry design on
  user evidence, independent of ENG-1462.
- **Shipped-code friction:** the S13 forward exit closing the whole sheet is the
  concrete mechanic making multi-add slow; the fix is to keep the sheet open,
  not to stage.

## Why this extends rather than reverses ENG-1462

ENG-1462 killed the **pre-commit staging basket** because a stage a close could
discard is a silent-data-loss trap. This tray is a **post-commit receipt**:
every item it holds already committed to the journal and carries its `mealId`
(the shared item type makes a stage-less item unrepresentable). Closing the
sheet resets only presentation — it never un-commits. So the ENG-1449 failure
class stays impossible: there is no un-committed, undo-able-only-by-not-closing
state anywhere. The `logSheetOneCommitModel.test.ts` §9 extension pins this
(the close effects contain no delete/un-commit; append only ever receives the
synchronous commit result; "basket"/"cart" stay banned in all six pinned files
+ the three new tray files).

## Gating + rollout

- Flag `log_session_tray_v1` (default OFF, in `KNOWN_DEFAULT_OFF_FLAGS` on both
  `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`). Ramp via
  PostHog. Flag OFF ⇒ no tray prop is threaded ⇒ S13-closes-sheet, byte-identical
  to pre-ENG-1643 (the required `else` path).
- Removal condition: 100% for two weeks, no regression → a cleanup PR removes
  only the in-sheet S13 branch (S13 stays for voice/photo/manual/other hosts).

## Consequences

- New shared surface (`logSessionTray.ts` + `useLogSessionTray.ts` + the two
  presentational tray components) — all new files, keeping the pinned
  screen-budget surfaces at/under budget. The mobile commit cluster was extracted
  to `useLogSheetCommits.ts`, the parity mirror of web's `useLogSheetFoodCommits`,
  closing a long-noted platform-structure divergence.
- Three new analytics events (`log_session_tray_undo/_done/_save_meal_opened`),
  same names both platforms; per-item `food_logged` unchanged (not batched).
- Per-item Undo is now persistent for the whole sheet-session — the deliberate
  fix for the punished ~1-second undo toast.
