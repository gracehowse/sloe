# 2026-04-30 — Lose It "Closer" speed-logger polish (3 honourable-mention fixes)

**Status:** Resolved
**Authority:** Audit-loop round 3 (extended competitor audit identified Lose It as a "Closer" persona — speed-logger features deferred but three S-effort fixes were flagged as honourable mentions).

## Context

Lose It's defining strength is one-tap logging — SnapIt (photo), barcode-first scanning, and pattern-based weekly insights. We had the underlying primitives (PhotoLog, BarcodeScannerModal, DigestStoryCard) but they were either buried, dead-ending, or under-narrated.

Three S-effort fixes lifted the speed-logger surface area without building any new AI:

## Fix 1 — PhotoLog as Today shortcut

**Before:** Photo log lived behind LogSheet → right-edge camera icon. Discoverable only after you opened the log sheet, scanned the icon row, and decoded the lock badge.

**After:** A small "Snap a meal" shortcut card sits above the macro tiles on Today, today-only. Tap → PhotoLog (Pro) or AiPaywall (free / base). Mirrors mobile + web.

- Lucide `Camera` icon, primary tint, lock badge for free / base.
- testID `today-snap-shortcut` for Maestro continuity.
- Analytics: new event `today_snap_shortcut_tapped` with `{ tier }` payload. Downstream `ai_photo_log_paywalled` / `ai_photo_log_started` continue to fire so the funnel stays comparable with the LogSheet entry point.

Files:

- `apps/mobile/components/today/TodaySnapShortcut.tsx` (new)
- `src/app/components/suppr/today-snap-shortcut.tsx` (new — web mirror)
- `apps/mobile/app/(tabs)/index.tsx` — wired above macro tiles, today-only.
- `src/app/components/NutritionTracker.tsx` — wired above macro tiles, today-only.
- `src/lib/analytics/events.ts` — new `today_snap_shortcut_tapped` event.

## Fix 2 — Barcode → Photo fallback

**Before:** Barcode scan returns "not found" → user sees "Product not found in database." with a manual-entry escape. Dead-end for anyone who'd rather snap the label than type 14 numbers.

**After:** Friendly empty state — "We don't have this product yet." — with primary `Snap the label instead` CTA that hands off to PhotoLog (host wires Pro gating). Manual entry stays as a secondary affordance.

- Mobile: `BarcodeScannerModal.tsx` `onPhotoFallback?: () => void` prop.
- Web: `today-barcode-dialog.tsx` `onPhotoFallback?: () => void` prop. The web dialog used to fire a transient toast; it now flips into a soft empty-state view with the same CTAs.
- `Try another barcode` returns the user to the input form on web; mobile auto-resets via `onReset` before invoking the host.
- testID `barcode-not-found-photo-fallback` for cross-platform tests.

Files:

- `apps/mobile/components/BarcodeScannerModal.tsx` — new prop + empty state + photo CTA + manual demoted to secondary.
- `apps/mobile/app/(tabs)/index.tsx` — wired through to PhotoLog or AI paywall.
- `src/app/components/suppr/today-barcode-dialog.tsx` — `notFound` branch + photo CTA + retry.
- `src/app/components/NutritionTracker.tsx` — wired through.

## Fix 3 — Day-of-week pattern in Digest

**Before:** Digest narrative covered avg kcal, protein adherence, closest-to-target day. Lose It surfaces patterns ("you eat 200 more on Saturdays") and we had no equivalent.

**After:** Pure helper `computeDayOfWeekPattern(byDay, now?)` aggregates kcal by weekday across the rolling 4-week (28-day) window, picks the highest-and-lowest mean weekday, and surfaces a single calm sentence ("You eat about 250 more kcal on Saturdays than Tuesdays.") via `DigestStoryCard`.

Gates (helper-enforced — caller cannot bypass):

- < 14 logged days in the window → null (insufficient data).
- High/low delta < 200 kcal → null (not meaningful).
- Only one weekday-with-samples → null (can't pick a low).
- Weekdays with zero samples are excluded from low/high comparison so a never-logged Tuesday doesn't fake a low bucket.

Tone: observational, factual, no emoji, no motivational copy. Plural weekday form ("Saturdays" / "Tuesdays") because we're describing a pattern, not a single day.

Files:

- `src/lib/nutrition/dayOfWeekPattern.ts` (new) — pure helper + threshold constants.
- `src/lib/nutrition/digestStory.ts` — added `dayOfWeekPattern` input field + `dayOfWeekPatternLine` output.
- `apps/mobile/components/progress/DigestStoryCard.tsx` — renders the new line.
- `src/app/components/suppr/digest-story-card.tsx` — renders the new line.
- `apps/mobile/app/(tabs)/progress.tsx` — wires `computeDayOfWeekPattern(byDay)` into the card.
- `src/app/components/ProgressDashboard.tsx` — same wiring for web.

## Tests

- `tests/unit/dayOfWeekPattern.test.ts` (9 tests) — pin window, gates, edge cases.
- `tests/unit/digestStory.test.ts` — extended (5 new tests) for the dow line.
- `tests/unit/digestStoryCardDowPattern.test.tsx` (3 tests, web) — render contract.
- `tests/unit/todaySnapShortcut.test.tsx` (6 tests, web) — component contract.
- `tests/unit/todayBarcodeDialogPhotoFallback.test.tsx` (4 tests, web) — fallback flow.
- `apps/mobile/tests/unit/todaySnapShortcut.test.tsx` (6 tests) — mobile component contract.
- `apps/mobile/tests/unit/barcodeNotFoundPhotoFallback.test.tsx` (4 tests, mobile) — fallback flow.

## Web vs mobile parity

All three fixes shipped in lockstep. Single intentional difference:

- Web's barcode "not found" branch uses a Dialog content swap because the dialog's input view is its own block; mobile uses an inline branch within the result area. Functional behaviour and CTAs are identical.

## Risks / follow-ups

- The new `today_snap_shortcut_tapped` event is uncatalogued in the PostHog dashboards. Suggested follow-up: `analytics-engineer` adds it to the AI funnel slice alongside `ai_photo_log_started`.
- The day-of-week pattern computes against `byDay` directly; if the journal data layer ever switches to a different shape (e.g. tagged buckets), the helper needs the same `MealMacros` adapter as `progressWeekReport`.
