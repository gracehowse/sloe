# Log-sheet session tray — immediate-commit multi-add (ENG-1643)

**Status:** Ratified — Grace, 2026-07-21 (option 2 of the ENG-757 research verdict,
chosen in-session after two-agent web research + repo evidence review).
**Supersedes:** ENG-757 (pre-commit build-meal cart — Canceled 2026-07-21) and the
`feat/eng-757-build-meal-cart` branch design (single combined `nutrition_entry`).
**Honors:** ENG-1462 (one-commit model, Grace-ratified 2026-07-07) — this spec
*extends* that model's presentation, it does not weaken its commit semantics.
**Authority chain:** ENG-1449 (the silent-discard bug) → ENG-1462 (kill the basket)
→ ENG-757 research verdict (2026-07-21, on the ENG-757/ENG-1643 comment threads)
→ this spec.
**Audience:** implementing engineer + QA. Everything here is normative unless
marked "(guidance)".

## 1. One-paragraph summary

Behind the `log_session_tray_v1` flag (default OFF), every add from the LogSheet
continues to **commit immediately** through the existing one-commit paths — but the
sheet **stays open** instead of ending the flow: the search clears and refocuses,
and a **session tray** pinned to the sheet's bottom edge accumulates a *receipt*
of the items committed this sheet-session, with a running count + kcal total,
persistent per-item Undo (deletes the committed row — the existing undo machinery),
"Save as usual meal" when 2+ items, and a primary **Done** that closes the sheet.
The tray is a receipt, never a stage: there is no pending state anywhere, so
closing the sheet in any state at any moment loses nothing. Flag OFF, behavior is
byte-identical to today (S13 card, Done closes the sheet).

## 2. Why (evidence, condensed — full verdict on the ENG-757 thread)

- Today a 4-item dinner costs **four full sheet-open→search→pick→confirm→close
  cycles**, because the S13 confirmation's only forward exit closes the whole
  sheet (`TodayScreen.tsx` `presentLogSheetConfirmation.onDone` →
  `setFabSheetOpen(false)`; web mirror `NutritionTracker.tsx` →
  `setLogSheetOpen(false)`). The 2026-06-11 teardown rated this gap
  launch-blocker-grade; the shipped reality is worse than it recorded.
- Category ground truth (verified 2026-07-21): the fastest-rated loggers commit
  immediately and snap back to search. Only MacroFactor (Plate, hidden by its
  default "speed mode") and Cronometer (opt-in, off by default) truly stage. The
  teardown's "Yazio/Lifesum baskets" were post-commit session receipts misread
  from static Mobbin screens.
- Sentiment: tedium and weak undo are punished; instant-commit-on-add complaints
  do not appear in the wild; the 5-year most-requested shape is meal bundles that
  stay **per-item editable** — retiring ENG-757's combined-entry design on user
  evidence, independent of ENG-1462.

## 3. Feature flag

- Name: **`log_session_tray_v1`** (snake_case, matching the most recent precedent
  `loghub_quick_actions_v1`).
- Registered in `KNOWN_DEFAULT_OFF_FLAGS` in BOTH `src/lib/analytics/track.ts`
  and `apps/mobile/lib/analytics.ts`. Default OFF. Ramp via PostHog.
- Gate location: **the hosts** (`TodayScreen.tsx` / `NutritionTracker.tsx`), same
  as `loghub_quick_actions_v1`. The LogSheet and FoodSearchPanel stay flag-free —
  they render what the host threads in.
- Flag OFF ⇒ no tray prop is threaded ⇒ the sheet renders and behaves exactly as
  today. This is the `else` path required by the 2026-05-13 flag rule.
- Removal condition: 100% for two weeks, no regression → cleanup PR removes the
  in-sheet S13 branch only (S13 stays for voice/photo/manual/other hosts).

## 4. Product behavior (normative)

### 4.1 Participating add paths (v1)

Flag ON, these paths append to the tray instead of presenting the S13 card:

1. **Search portion-preview commit** — the panel's single "Use this" CTA
   (unchanged label and testID in v1; see §7.2). Host `search.onSelect` branch.
2. **One-tap rows inside the sheet** — Past-logged / Favourites / Recent strip /
   Saved-meals / Library one-tap logs, i.e. every host callback that currently
   ends in `presentLogSheetConfirmation` while the sheet is open (mobile:
   `logHistoryItemFromSheet` and siblings; web: the `useLogSheetFoodCommits`
   paths plus the host one-tap handlers).

Explicit v1 **non-participants** (intentional, not gaps — do not "fix" in this PR):
voice/photo/scan modal flows (separate trust-review ceremonies), the manual
quick-add form, and barcode manual-entry recovery. They keep S13 exactly as
today under either flag state.

### 4.2 The add loop (flag ON)

On each participating add:

1. Commit synchronously via the existing path (`commitLogSheetFoodSelection` /
   `commitFoodSearchSelection` / history-item equivalents). **No new commit code.**
2. Append the commit's *result* (which includes the committed `mealId`) to the
   session-tray state. Appending anything that lacks a committed `mealId` is a
   contract violation (§9 pins this).
3. Do NOT present the S13 card. The tray increment IS the confirmation.
4. Reset the search query (the panel already does this on select) and keep the
   sheet open. Mobile: keep the keyboard up and refocus the search input. Web:
   refocus the search input.
5. Announce for a11y (§8).

### 4.3 Tray anatomy

**Collapsed bar** (default; renders whenever session count ≥ 1, pinned as the
sheet's bottom-most persistent bar, above the home-indicator inset):

> ✓  **3 added · ~812 kcal**        [expand chevron]   [ Done ]

- The sage success check (S13 grammar). Count + running kcal total. kcal renders
  through the same ENG-1417/ENG-1502 trust convention S13 uses: unqualified only
  when **every** tray item has `kcalIsVerified === true`, else the honest `~`.
- Tapping the bar (not Done) toggles **expanded**.

**Expanded panel** (slides up from the bar, max ~40% sheet height, scrollable):

- Eyebrow: "Added this session".
- One row per item, newest last: `{title}` · `{~}{kcal} kcal` · Undo (✕).
  When the tray spans more than one meal slot, rows append `· {Slot}`.
- Footer row: `Total` · `{~}{kcal} kcal · {P} P · {C} C · {F} F`.
- Actions: **Save as usual meal** (ghost; rendered only when count ≥ 2) ·
  **Done** (primary).

**Sheet title** (flag ON, count ≥ 1): "Log meal" → **"Log meal · {n} added"** —
the count stays visible in every sheet state, including while the portion
preview is open (the ENG-1449 "visible in every state" lesson, applied to the
receipt). When the portion preview's sticky footer is open, the collapsed bar
may be hidden underneath it — acceptable, because the header count persists and
nothing in the tray is pending.

### 4.4 Undo (per item, persistent)

- Tapping ✕ on a row: delete the committed journal row via the EXISTING removal
  path (`deleteMeal(mealId)` mobile / `removeLoggedMeal(mealId)` web), then drop
  the row from tray state. Disable the row's ✕ while in flight (no
  double-submit).
- Undo remains available for the whole sheet session — deliberately the
  anti-pattern-fix for the punished ~1-second undo toast.
- Undoing the last item: tray bar disappears, title reverts to "Log meal".

### 4.5 Done + close semantics

- **Done** (primary): closes the sheet. Nothing else — every item is already
  committed. Haptic "confirm" on mobile.
- Backdrop tap / swipe-down / X with tray items: closes freely, **no prompt** —
  there is nothing to lose. The close effect resets tray state (presentation
  only; §9 pins that the close effect contains no delete/un-commit call).
- No cross-session persistence: reopening the sheet starts an empty tray; the
  logged items live in Today as normal editable rows.

### 4.6 Save as usual meal (count ≥ 2)

- Opens the existing save-a-usual-meal flow (`onCreateSavedMeal` path — the
  ENG-1462-designated batching home), prefilled with the tray's items if the
  existing component accepts an initial selection **as a small change
  (≤ ~20 lines)**; otherwise open it unprefilled and REPORT the gap back to the
  session lead for a follow-up ticket (no silent deferral, no comment-only TODO).
- Default meal name (guidance, only if prefill supports a name): 1 slot →
  `"{n}-item {slot}"`; mixed slots → `"{n}-item meal"` — via the shared module's
  `resolveUsualMealName`.
- Saving does NOT close the sheet or clear the tray.

### 4.7 Slot handling

- Each item commits to the slot active at ITS commit time (existing behavior —
  the host's `activeMealSlot`/`mealSlot` threads through unchanged).
- Changing the slot mid-session is allowed and does not touch already-committed
  tray items.

## 5. Copy (normative)

| Surface | Copy |
|---|---|
| Sheet title, count ≥ 1 | `Log meal · {n} added` |
| Collapsed bar | `{n} added · {~}{kcal} kcal` |
| Expanded eyebrow | `Added this session` |
| Row | `{title}` / `{~}{kcal} kcal` (+ ` · {Slot}` when multi-slot) |
| Total row | `Total` / `{~}{kcal} kcal · {P} P · {C} C · {F} F` |
| Primary CTA | `Done` |
| Ghost CTA (≥ 2 items) | `Save as usual meal` |
| Undo a11y label | `Undo {title}` |
| Add announcement (a11y) | `Added {title}. {n} items this session.` |

Vocabulary: "usual meal"/"saved meal" only — never "Routine", never "basket",
never "cart".

## 6. Visual + tokens (normative)

- **Same element, same treatment:** the tray slab matches the sheet's existing
  cream search/browse slabs — `Radius.xl` / `rounded-xl`, token fills, hairline
  where the siblings use one. Nested surface inside a sheet ⇒ flat (ENG-1497
  card grammar); the sheet keeps its sanctioned overlay elevation.
- Spacing on the 4/8/12/16/20/24/32/40 scale only; type from the `Type` ramp /
  gated web classes only (`Type.captionStrong`-tier for the bar, matching the
  LogHub row's choices). Sage success check + soft sage tint per S13. Counts and
  kcal use tabular numerals where the platform supports it.
- CTAs: `SupprButton` `primary` (Done) / `ghost` (Save as usual meal). One filled
  CTA per visible view holds: the portion preview's "Use this" is the primary
  while the preview is open (the tray bar sits beneath/hidden); Done is the
  primary otherwise.
  **Known gap (2026-07-21 implementation review):** "the tray bar sits
  beneath/hidden" is not actually enforced — `FoodSearchPanel.tsx` is
  explicitly untouched in v1 (§7.2), so it has no way to signal
  preview-active state up to the host/`LogSheet`, and the tray is mounted
  as an unconditional sibling. In the flex-column sheet layout (search
  results `flex-1 min-h-0`, everything else fixed-height), when the tray
  has ≥ 1 item AND the user re-opens search and reaches the portion
  preview, the preview's filled "Use this" and the tray's filled "Done"
  both render on screen simultaneously (the results area just shrinks to
  make room) — a real one-filled-CTA-per-view violation, not merely a
  hidden-but-present element. Non-functional (both buttons still do
  exactly what they say; no data loss), flag-gated OFF by default. Needs
  a product call before it can close: (a) ship as-is and accept the
  narrow polish gap, (b) add a minimal `search.onPreviewActiveChange`
  callback to `FoodSearchPanel` (both platforms) so the host can hide the
  tray bar while preview is open — the smallest change that fulfils this
  line's original intent, at the cost of the one `FoodSearchPanel` touch
  §7.2 ruled out for v1, or (c) some other resolution Grace prefers. Not
  actioned here — tracked as **ENG-1652** per the "no silent deferrals"
  rule rather than left doc-only; resolve before ramping the flag, not
  before merging.
- Mobile pressables: `PressableScale` — rows/expand `haptic="selection"`, Done
  `haptic="confirm"`, Undo `haptic="warn"`. Web: hover + `:focus-visible` ring +
  `active:scale` per the LogHub precedent. Async Undo: disabled + progress.

## 7. Architecture (normative)

### 7.1 New files (all new logic lives in new files — the ratchet demands it)

| File | Contents |
|---|---|
| `src/lib/nutrition/logSessionTray.ts` | Pure shared module, no React/Supabase/Date: `LogSessionTrayItem` (`mealId`, `title`, `kcal`, `protein`, `carbs`, `fat`, `slot`, `kcalIsVerified?`, `source?`), `sessionTrayTotals()` (count + summed kcal/P/C/F; per-item values are the already-rounded committed numbers; totals render kcal as int, macros to 1dp — reuse the rounding conventions from the old `buildMealCart` module on the ENG-757 branch), `trayIsFullyVerified()`, `resolveUsualMealName()` |
| `apps/mobile/lib/logSessionTray.ts` | One-line re-export shim (existing shared-module pattern) |
| `src/app/components/suppr/log-session-tray.tsx` | Web presentational tray (collapsed bar + expanded panel). Shared `LogSessionTrayProps` shape |
| `apps/mobile/components/today/LogSessionTray.tsx` | Mobile presentational tray, same props shape |
| `src/app/components/suppr/useLogSessionTray.ts` (or fold into `useLogSheetFoodCommits.ts` if cleaner) | Web tray state: `items`, `append`, `undo` (calls the removal fn, in-flight guard), `reset` |
| `apps/mobile/app/(tabs)/_today/useLogSheetCommits.ts` | **Mobile hook extraction** mirroring web's ENG-1502 `useLogSheetFoodCommits`: move `commitLogSheetFoodSelection`, `presentLogSheetConfirmation`, `logHistoryItemFromSheet` (+ the new tray state) out of `TodayScreen.tsx`. This is the budget offset AND closes a noted platform-structure divergence |

### 7.2 Pinned files — minimal wiring only, net growth ≤ 0 where pinned

- `TodayScreen.tsx` (pin 5691): replace the moved functions with the hook call;
  add the flag read + tray prop threading + the `onSelect` branch. The hook
  extraction must leave TodayScreen at or below its pin — verify with
  `npm run check:screen-budget`; re-pin lower (`:write`) only after genuine
  shrink.
- `LogSheet.tsx` (mobile, pin 1741) + `log-sheet.tsx` (web, pin 1396): add the
  optional `sessionTray?: LogSessionTrayProps` prop, mount `<LogSessionTray>`
  above the bottom inset, and the title-count tweak. Offset by extracting an
  existing self-contained block (implementer's choice — e.g. the manual-entry
  footer or an empty-state cluster) into its own component file in the same PR.
- `FoodSearchPanel.tsx` (both, pins 2652/2713): **untouched in v1.** The "Use
  this" label, testID, and single-CTA shape stay exactly as pinned by
  `logSheetOneCommitModel.test.ts`. All behavior change is host-side, after
  `onSelect`.
- `NutritionTracker.tsx`: flag read + tray state hook + `onSelect` branch + prop
  threading; commit-return extension (add `protein`/`carbs`/`fat` to the
  returned payload) lands in `useLogSheetFoodCommits.ts` (unpinned). Keep net
  additions to NutritionTracker minimal; offset if it exceeds its pin.
- Mobile commit-return extension (`protein`/`carbs`/`fat` on the
  `commitLogSheetFoodSelection` return) rides the hook extraction.

### 7.3 Host `onSelect` shape (must satisfy the existing regex pins — see §9)

```ts
onSelect: (result) => {
  // …existing validation guards…
  const committed = commitLogSheetFoodSelection(result);
  if (sessionTrayEnabled) { appendLogSessionTray(committed); return; }
  presentLogSheetConfirmation({ …committed, mealIds: [committed.id] });
}
```

The commit call and `presentLogSheetConfirmation(` must remain within the
existing regex windows (mobile: 1200 chars from `onSelect`, 200 between commit
and present; web: 400/200). Keep the branch terse. The close-effect bodies
(`!fabSheetOpen` / `!logSheetOpen`) gain exactly one call —
`resetLogSessionTray();` — and must stay within their 200-char capture windows.

## 8. Accessibility + handles

- Tray container: `log-session-tray` (testID/data-testid); collapsed bar
  `log-session-tray-bar`; expand toggle `log-session-tray-toggle`; rows
  `log-session-tray-row-{i}` with `log-session-tray-undo-{i}`; CTAs
  `log-session-tray-done`, `log-session-tray-save-meal`.
- Expanded panel is a `list`; rows carry
  `accessibilityLabel="{title}, {kcal} kilocalories, added"` (mobile) / list
  semantics + text (web). Undo buttons: `accessibilityRole="button"` +
  `accessibilityLabel="Undo {title}"` / `aria-label`.
- Add announcement: mobile `AccessibilityInfo.announceForAccessibility`, web an
  `aria-live="polite"` region inside the tray — "Added {title}. {n} items this
  session."

## 9. `logSheetOneCommitModel.test.ts` — extended, never weakened

Every existing pin stays green (the §7 constraints are designed for exactly
this). Add a new describe block, "ENG-1643 — the session tray is a receipt,
never a stage", pinning at minimum:

1. `/basket/i` stays banned in all six files (tray files use "tray"; this is a
   genuinely different contract, not a rename dodge — the items are committed).
2. The shared module's item type requires `mealId` (source pin on
   `logSessionTray.ts`) — a tray item without a committed row id is
   unrepresentable.
3. In both hosts, `appendLogSessionTray(` appears only with the RESULT of the
   synchronous commit call (regex: commit call precedes append within a tight
   window), and never before it.
4. The close effects contain `resetLogSessionTray` (or the chosen name) and
   still contain no `setStaged|setPending|setQueued`, no basket match, and no
   delete/remove call.
5. Flag-OFF path: `presentLogSheetConfirmation(` remains reachable in the same
   `onSelect` body (the existing pins already enforce this — assert they still
   pass unmodified).

Header comment of the new block must cite ENG-1643 + this spec path.

## 10. Analytics

- Per-item `food_logged` fires unchanged from the commit path (per-item
  provenance preserved — do not batch it).
- New events (follow `AnalyticsEvents` naming conventions on both platforms):
  `log_session_tray_undo` `{kcal}`; `log_session_tray_done` `{items, kcal}`;
  `log_session_tray_save_meal_opened` `{items}`. Fire-and-forget, try/catch
  like the existing call sites.

## 11. Tests (required for completion)

1. `tests/unit/logSessionTray.test.ts` — shared math: totals sum/rounding parity
   with the single-item path, clamping of NaN/negative, `trayIsFullyVerified`,
   `resolveUsualMealName` (1-item / single-slot / multi-slot / names).
2. `tests/unit/logSessionTrayWeb.test.tsx` + `apps/mobile/tests/unit/logSessionTray.test.tsx`
   — render harness modeled on `logHubQuickActions.test.tsx` (its mock set is
   the map for avoiding Supabase/haptics init): no prop ⇒ nothing renders +
   sheet behaves as today; items ⇒ bar count/total; expand ⇒ rows + footer +
   correct CTAs; Undo fires with the right `mealId` + in-flight disable;
   Done fires; Save-as-meal renders only at ≥ 2; multi-slot suffix; `~` trust
   marker logic.
3. `logSheetOneCommitModel.test.ts` — §9 extension.
4. `tests/unit/logSheetWebMobileParity.test.ts` — new block pinning the shared
   props shape, testID templates, component names, and both sheets mounting the
   tray component.
5. Run the full relevant suites + `npm run check:screen-budget`,
   `check:pressable-feedback`, `check:token-scale`, `check:spacing-scale`,
   `check:web-spacing-scale`, `check:type-scale`, `check:type-scale-mobile`
   before hand-back (memory: scoped vitest globs miss ratchets + source-pin
   tests — grep `tests/` for every touched filename).

## 12. Documentation (required for completion)

1. `docs/journeys/log-sheet.md` — new dated section "2026-07-21 — session tray
   (immediate-commit multi-add, flag-gated)" following the LogHub section's
   structure (behavior, gating, wiring, tests), + a line in the S13 section
   noting the in-session replacement under the flag.
2. `docs/decisions/2026-07-21-log-session-tray-immediate-commit.md` — records
   Grace's option-2 ratification, the three options weighed, the research
   summary (category mechanics, sentiment, shipped-code friction), and why this
   extends rather than reverses ENG-1462. Link ENG-757/ENG-1449/ENG-1462/ENG-1643.
3. This spec stays the normative reference; link it from both docs.

## 13. Acceptance criteria

- [ ] Flag OFF: zero behavioral or visual diff on both platforms (S13 intact).
- [ ] Flag ON: 4 items land in ≤ 4 search→add loops in ONE sheet session, each
      visible in Today immediately; closing mid-session at any point loses zero
      items; per-item Undo works throughout the session.
- [ ] All existing `logSheetOneCommitModel` pins green, new pins added.
- [ ] All ratchets at-or-below pins; new files under 400 lines each.
- [ ] Web/mobile parity: same props shape, same copy, same testID grammar.
- [ ] Journey doc + decision doc landed in the same PR.
- [ ] `npm run ci` green locally before push; `gh run watch` green after.
