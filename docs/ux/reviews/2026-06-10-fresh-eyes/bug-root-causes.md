<!-- Source: fresh-eyes workflow 2026-06-10; Linear ENG-1008 / ENG-1009 -->

# Root-cause report — 3 mobile runtime bugs (Sloe, `claude/sloe-redesign-2026-06-04`)

## BUG 1 — date navigation lands +35 days (5 weeks) out

**ROOT CAUSE**
`apps/mobile/components/charts/DayStrip.tsx:103-115` (`handleMomentumEnd`), triggered by the pager-align effect at `DayStrip.tsx:88-92`. The calendar write itself (`index.tsx:6248-6251` → `JournalDatePickerModal.tsx:104-106`) is correct; DayStrip corrupts it afterward.

**MECHANISM**
The calendar/`onSelectDate` path writes the right date: tap "3" → `setSelectedDate(clampJournalDate(June 3))` → `selectedDate` = June 3 (intended week index **156** of the 162-week strip; `weekStarts.length` = 162, last index = 161).

That state change re-runs DayStrip's align effect (`DayStrip.tsx:88`), which calls `scrollToWeekIndex(156)` → `flatRef.current.scrollToOffset({ offset: 156 * pagerW, animated:false })` (line 82). The `<FlatList>` (lines 233-254) has **no `initialScrollIndex`** and a small render window (`initialNumToRender={5}`, `maxToRenderPerBatch={6}`, `windowSize={7}`). On a cold/just-laid-out list whose content has only been measured to a near-start extent, RN **clamps** a `scrollToOffset` target that exceeds the current measured `contentWidth` to the maximum scrollable extent — i.e. the **last page, index 161**. That programmatic settle fires `onMomentumScrollEnd` → `handleMomentumEnd`, which reads back `Math.round(contentOffset.x / pagerW)` = **161**, looks up `weekStarts[161]` (week of 2026-07-06), re-applies the column, and calls `onSelectDate(July 8)`. `setViewMode("day")` then shows that day. Net: June 3 → **July 8 = +35d = +5 weeks**, empty day. The column (Wed) is preserved; only the *week index* is wrong — which is exactly the +5-week, same-weekday signature.

**Why the anchor-dependent asymmetry (d works, a/b/c fail):** from a **July-8-anchored** session the strip is already scrolled near the end (index ~161), so its content out to index 161 is already measured; scrolling *back* to June (156) is a normal in-bounds backward scroll that settles exactly → correct. From a **June-9-anchored** session (index 157) the list has never measured far enough forward for the clamp to matter the same way, but the target-offset/measured-contentWidth mismatch on the re-scroll clamps forward to the max index 161 → +35. The bug is a function of how much of the strip has been laid out at scroll time, which is precisely what the anchor controls.

(The deep-link case (a) is the same: `index.tsx:843-850` correctly sets June 3 from `params.date`, then DayStrip's effect clamps the scroll to the last page and `handleMomentumEnd` overwrites with July 8.)

**FIX SKETCH**
1. Stop `handleMomentumEnd` from firing on **programmatic** scrolls. Track a "programmatic scroll in flight" ref: set it in `scrollToWeekIndex` before `scrollToOffset`, and have `handleMomentumEnd` early-return (and clear the ref) when it's set. Only *user-driven* momentum should write `selectedDate` back.
2. Independently, make the clamp impossible: give the `<FlatList>` `initialScrollIndex={weekIndexContaining(selectedDate, weekStarts)}` (it already provides `getItemLayout`, so `initialScrollIndex` is safe and deterministic) so the target page is always within measured content, and the strip mounts on the correct week without a corrective scroll.
3. Defensive: in `handleMomentumEnd`, guard against the readback landing on `weekStarts.length - 1` when that disagrees with `weekIndexContaining(selectedDate)` by more than 1 — but (1)+(2) are the real fix; this is belt-and-braces.

The minimal correct fix is (1): the suppress-programmatic-momentum guard. (2) hardens mount and removes the corrective-scroll entirely.

**CONFIDENCE: 8/10.** The +5-week = last-index (161) overshoot with preserved weekday, plus the anchor-dependent asymmetry, all point unambiguously at the `handleMomentumEnd` readback of a clamped programmatic scroll. The one piece I couldn't exercise without the running sim is the exact RN clamp value at the moment of scroll; the index-161 arithmetic and the four-case repro matrix corroborate it strongly.

---

## BUG 2 — centre FAB `+` / `?openLog=1` deep link does not open LogSheet

**ROOT CAUSE**
`apps/mobile/components/tabs/SupprTabBar.tsx:87` (`router.push({ pathname: "/(tabs)", params: { openLog: "1" } })`) vs the consumer at `apps/mobile/app/(tabs)/index.tsx:858-869`. The param does not reliably reach the index screen's `useLocalSearchParams`, and when it does, the **`router.setParams({ openLog: undefined })` at line 867 races the effect**.

**MECHANISM**
Two compounding problems:

1. **Push target is the group, not the screen, with no cache-buster.** `push`/openurl targets `/(tabs)` (the group), which expo-router resolves to the group's default screen (`index`). Compare the *working* date path: `progress.tsx:1502` and `progress-metric.tsx:269` use `router.navigate({ pathname: "/(tabs)", params: { date, _t: String(Date.now()) } })` — note the **`_t` cache-buster** and `navigate`. The openLog push has **no `_t`**. The index screen consumes `date` via an effect keyed on `[params.date, params._t]` (line 850) precisely *because* re-delivering the same param value to an already-mounted screen won't re-fire an effect without a changing key. The openLog effect is keyed `[params.openLog, router]` (line 869) with no cache-buster — so even when the value arrives, a repeat (or a value that expo-router doesn't treat as "changed" on the focused group route) won't re-trigger.

2. **Self-clearing race.** When the effect *does* run, line 867 immediately calls `router.setParams({ openLog: undefined })`. On the focused screen, that re-render can land before/around the `setFabSheetOpen(true)` commit and, more importantly, wipes `params.openLog` so the effect's own dependency churns — but the canonical failure is that with `push` to the group route the index screen is frequently **not the freshly-mounted, focused instance** that reads the param, so `params.openLog` reads `undefined` and the effect body never runs at all. The `+ Add food` meals-section path works because it calls `setFabSheetOpen(true)` **directly** (no param round-trip).

The stale comments at `SupprTabBar.tsx:22-24`, `LogTabBarButton.tsx:52-54`, and `index.tsx:852-857` all claim consumption is via **`useFocusEffect`** — but the actual consumer (line 858) is a plain **`useEffect`**. A `useFocusEffect` would at least re-run on every focus regardless of param identity; the plain `useEffect` only runs when `params.openLog` actually changes between renders of the *mounted* instance. This is the core defect: the consumption mechanism was refactored from `useFocusEffect` to `useEffect` without adding a cache-buster, so it lost the "re-fire on re-navigation" property the comments still promise. Not a recent regression — `git log` shows the tab-bar files last changed in the Sloe redesign (#375) and the openLog block predates the 2026-05-20 window with no relevant edits.

**FIX SKETCH**
- Mirror the proven date pattern: push **with a `_t` cache-buster** — `router.navigate({ pathname: "/(tabs)", params: { openLog: "1", _t: String(Date.now()) } })` in `SupprTabBar.tsx:87` (and `weeklyRecap.tsx:894`, `index.tsx`-internal callers) — and key the consuming effect on `[params.openLog, params._t]`.
- Convert the consumer at `index.tsx:858` to **`useFocusEffect`** (matching the comments and the `editMealId`/focus pattern already used at lines 4041/4063), so re-navigating to Today-with-openLog from any tab re-fires on focus.
- Keep the `setParams({ openLog: undefined })` clear, but move it to run *after* the sheet-open commit (or clear only `_t`) so it can't wipe the trigger before the body runs.

**CONFIDENCE: 7/10.** The `_t`-present (date, works) vs `_t`-absent (openLog, broken) contrast within the same file is strong direct evidence, and the `useEffect`-vs-`useFocusEffect` comment/code divergence is concrete. I'm one notch short of 9 only because I couldn't watch the focused-instance param read live in the sim to confirm which of the two compounding causes dominates on the Plan→Today transition specifically; the fix addresses both.

---

## BUG 3 — warm same-route deep link is a complete no-op

**ROOT CAUSE**
Same as Bug 2: the consuming effect at `index.tsx:858-869` (openLog) and the date effect at `index.tsx:843-850` only re-fire on a **changing dependency**, and a second `openurl` to the **already-focused** Today route delivers an identical param value, so neither effect re-runs.

**MECHANISM**
When Today is already mounted and focused, `simctl openurl suppr:///?openLog=1` (or `?date=…` with a value equal to what's already there) updates `useLocalSearchParams` to the **same** value the effect last saw. A plain `useEffect` keyed on `[params.openLog]` / `[params.date, params._t]` does not re-run when the value is unchanged — so the sheet never opens and the date is never re-processed. expo-router does deliver the warm-link params to the focused screen's `useLocalSearchParams`, but with no value change there is nothing to react to. This is exactly why the date path *deliberately* carries `_t` (the `index.tsx:849` comment — "`_t` is a cache-buster so re-navigating to the same date still fires") — and exactly why openLog, which lacks `_t`, is dead on a warm same-route hit.

**FIX SKETCH**
The correct pattern (and what the date path already half-implements) is: **every deep-link trigger carries a monotonic `_t` cache-buster**, and the consuming effects key on it. For openLog: add `_t` to all push/openurl call sites and to the effect deps (as in Bug 2's fix). For belt-and-braces on true cold `openurl` to a focused route, add a `Linking.addEventListener("url", …)` subscription on Today that parses `openLog`/`date` and drives the same handlers imperatively — this guarantees warm same-route links fire even if a future param value collides. The `_t` approach is the minimal correct fix; the `Linking` subscription is the robust one if warm-link reliability is a priority surface.

**CONFIDENCE: 8/10.** The in-file comment at `index.tsx:849` explicitly documents the `_t`-cache-buster requirement for exactly this "re-navigating to the same value still fires" case, and openLog's omission of it is a direct, visible gap. High confidence it's the same root as Bug 2.

---

### Cross-cutting note
Bugs 2 and 3 share one root: **deep-link params consumed by value-keyed `useEffect`s without a `_t` cache-buster, plus stale comments promising a `useFocusEffect` that was silently swapped for `useEffect`.** Fixing the openLog path the way the date path is *supposed* to work (cache-buster + focus-effect) resolves both. Bug 1 is independent — a FlatList programmatic-scroll/momentum-readback race in `DayStrip.tsx`.

Key files: `apps/mobile/components/charts/DayStrip.tsx` (Bug 1, lines 88-92 + 103-115 + 233-254), `apps/mobile/components/tabs/SupprTabBar.tsx:87` and `apps/mobile/app/(tabs)/index.tsx:843-869` (Bugs 2 & 3).