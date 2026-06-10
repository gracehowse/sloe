# Digest primitive — design brief (D3)

Status: **implemented 2026-04-21**. `src/app/components/suppr/digest.tsx` (web) + `apps/mobile/components/Digest.tsx` (mobile). Legacy `weekly-recap-card.tsx` / `WeeklyRecapCard.tsx` deleted in the same commit. Headline resolver lives at `src/lib/nutrition/digest.ts`. Analytics event names (`weekly_recap_*`) carried over verbatim — open question #11 still routed to analytics-engineer for possible rename.

> **ENG-740 update (2026-05-26) — blended premium Week-Digest.** A merged
> variant is shipping behind the `progress_digest_blend` flag. It folds the
> dismissable `<Digest>` recap AND the always-on `<DigestStoryCard>` into ONE
> premium card (no duplication, internally consistent day-count). See
> **§12 — Blended variant (ENG-740)** below. The legacy two-card layout in
> §2–§10 stays live in the flag-off branch until the flag holds 100% for two
> weeks, then the legacy `<DigestStoryCard>` + the legacy `<Digest>` body are
> removed in a cleanup PR.

## 1. Design intent

Digest is the Sunday-evening "here's your week" surface on Progress. It replaces the current WeeklyRecapCard but is not a redesign of the same card — it is a calmer, narrative-first primitive that can carry a variable number of beats (streak, closest-to-target, usual-meal loop, maintenance recalibration, weight delta) without turning into a stat-board.

Voice: factual, supportive, low-affect. Never shame. Never "you missed".

Feel: a single quiet card with a typographic lead, a compact stat strip, and optional narrative lines below. Dismissible. Shareable. Not cluttered.

## 2. Structure

### Shared layout (web + mobile)

Regions, top to bottom:

1. Eyebrow row — small uppercase "WEEK DIGEST" + week label ("14–20 Apr") + close affordance (top-right).
2. Headline — one line, 18–20px bold. "Your week, at a glance." (fallback) or a context-derived line from the strongest signal that week (see §5 headline rules).
3. Subline — muted, one line. "X days logged · Y meals."
4. Stat strip — 4 tiles in a 2×2 grid (mobile) / 4-up row (web ≥720px). Tiles are Streak, Avg calories, Avg protein, Weight. Each tile: uppercase 10px label, 18px bold tabular value, 10px muted hint. Streak tile stays here per 2026-04-21 decision.
5. Narrative lines (0–3, each suppressed when data missing):
   - Closest-to-target line
   - First → Last weigh-in line (only when 2+ weigh-ins)
   - Maintenance recalibration one-liner (only when adaptive diverges from formula)
   - Usual-meal loop insight (celebration OR prompt-with-CTA)
6. Footer — Share week (primary-soft button, success-tinted) + "Got it" muted text button.

### Web
- Full width of Progress content column, max 720px.
- Tiles: 4-up grid ≥720px; 2×2 below.
- Padding: 20px.

### Mobile
- Full bleed inside Progress scroll, 16px horizontal margin.
- Tiles: always 2×2.
- Padding: 16px.

## 3. Hierarchy

Eye lands on: headline → stat strip → first narrative line → share.

The stat strip is the anchor. Narrative lines are narrative; none is required for the card to feel complete. When all narrative lines are suppressed, the card is still a valid, quiet summary — not a broken one.

## 4. Components

Reused:
- `rounded-card border border-border bg-card` shell (existing)
- `Stat` sub-component (inline to Digest, do not export — same visual as current `WeeklyRecapCard` Stat)
- Existing `Icons.share`, `Icons.close`, `Icons.save`
- Existing `handleOpenSaveCombo` deep-link for the prompt CTA

New:
- `<Digest />` primitive (web: `src/app/components/suppr/digest.tsx`, mobile: `apps/mobile/components/Digest.tsx`). Same prop surface across platforms; `shareText` prop is platform-agnostic, the host wires `navigator.share` / `Share.share`.
- `<DigestNarrativeLine />` inline helper — muted 12px line with an optional inline icon slot. Used for closest-to-target, weigh-in, maintenance.
- `<DigestPromptBlock />` — the tinted primary-5% block used only for the usual-meal prompt (matches existing WeeklyRecapCard prompt visual).

Retired (after Digest ships):
- `src/app/components/suppr/weekly-recap-card.tsx`
- `apps/mobile/components/WeeklyRecapCard.tsx`
- Any "recap" naming in copy — user-facing string is "digest".

## 5. Data shape

```
DigestProps {
  weekKey: string          // e.g. "2026-W16"
  weekLabel: string        // "14–20 Apr"
  daysLogged: number
  mealsLogged: number
  stats: {
    streakDays: number
    streakFreezesAvailable: number
    avgCalories: number
    avgProtein: number
    proteinAdherencePct: number | null
    weightDeltaKg: number | null   // null = suppress
    weightFirstKg: number | null
    weightLastKg: number | null
  }
  narrative: {
    closestToTarget: { label: string; protein: number; calories: number } | null
    maintenanceLine: string | null       // already-resolved via formatMaintenanceRecapLine
    usualMeal: UsualMealInsight | null   // celebration | prompt | null
  }
  onShare: () => void
  onDismiss: () => void
  onOpenSaveCombo?: (slot, seedItems) => void
  onStartUsualMealSave?: (slot) => void
}
```

Headline rule (host computes, Digest renders):
- If weight delta present and |delta| ≥ 0.3 kg → "Last week: down/up X.X kg." (past-tense per project voice rule — past days use past tense)
- Else if closestToTarget present → "Closest to target: <day>."
- Else if streak ≥ 7 → "Streak held — X days."
- Else → "Your week, at a glance."

Host must pass a single computed `headline` string; Digest does not branch on it.

## 6. Interactions

- **Dismiss (top-right X)** — fires `onDismiss`; analytics `weekly_digest_dismissed`. Card unmounts with 120ms fade.
- **Share week** — fires `onShare`. Host decides native share sheet vs clipboard. On tap: 80ms scale-down to 0.97, haptic light (mobile).
- **Usual-meal prompt CTA** — fires `onOpenSaveCombo(slot, seedItems)` when seed present, else `onStartUsualMealSave(slot)`. Button copy: `Save {Slot} as a meal`.
- **Tile tap** — no interaction (tiles are display-only). Do not make them pressable; avoids accidental nav.
- **Hover (web)** — card shadow does not intensify; only the share button hovers. Hover on muted text button lifts to foreground colour.

Microcopy:
- Close aria-label: "Dismiss week digest"
- Share aria-label: "Share week digest"
- Empty streak tile hint: "log any day to start"
- Empty weight tile hint: "log weight any day"
- Empty-week headline (0 days logged): "Quiet week."
- Empty-week subline is **history-aware** (ENG-1019/1020 — the
  "hasHistory disease" pattern). The host passes `hasHistory` (any logged
  day in the journal store); the subline is sourced from
  `buildWeeklyRecapEmptyCopy` in `src/lib/nutrition/weeklyRecapEmptyCopy.ts`
  so web (`Digest`) and mobile (`weekly-recap.tsx`) never diverge:
  - **True cold start** (`hasHistory: false`): "A streak begins when you log
    on two different days in the same week. There's nothing to recap yet —
    come back after your first meal."
  - **Returning user, empty recap week** (`hasHistory: true`): "This week's
    recap builds as you log. A streak counts every day with at least one
    meal — log today to keep yours going." Never the cold-start promise.
- The first_week TDEE check-in headline is also history-aware: the cascade
  emits "Your check-in starts after 7 days of data." whenever last week's
  TDEE snapshot is missing (also true on a returning user's first visit
  this week). When `hasHistory`, that headline is swapped for "Your
  check-in updates as you log this week." via
  `resolveCheckinFirstWeekHeadline`.

## 7. States

- **Loading** — skeleton: 1 eyebrow pill (44×14), 1 headline bar (60% w, 20h), 1 subline bar (40% w, 12h), 4 tiles (64h each, muted bg). No narrative lines. No footer. 400ms shimmer.
- **Empty (0 days logged)** — Show card. Headline "Quiet week." Subline is history-aware (see §6 Microcopy — `buildWeeklyRecapEmptyCopy({ hasHistory })`). Stats: streak tile shows current streak (could be 0), others muted-grey with em-dash values. No narrative lines. Footer: Share disabled (aria-disabled, 40% opacity). "Got it" enabled.
- **Partial week (1–3 days logged)** — Full card. Subline shows day count honestly. Stats show averages over logged days only; hint adds "(over N days)". Narrative lines render if data supports them.
- **Success (4+ days logged)** — Full card with all applicable narrative lines.
- **Error (data fetch failed)** — Do not render Digest. Render a minimal error tile: "Couldn't load your digest. Try again." with retry link. Never show partial numbers on error.
- **Stale (week not yet closed, e.g. viewing mid-week)** — Digest does not render mid-week. Host gates on `weekKey === lastCompletedWeekKey`.
- **Offline** — Digest renders from cached recap payload if present, with a single 11px muted note under the footer: "Showing last synced · {relative time}." Share disabled offline.

## 8. Nutrition treatment

- Avg calories / avg protein: tabular-nums, no decimal. Suffix g (protein) / none (calories).
- Protein adherence hint: "{X}% of target" only when target exists; otherwise "no target set".
- Maintenance line is suppressed unless the adaptive branch differs from formula. Never "landed at X (formula said X)".
- Weight delta: suppressed entirely when <2 weigh-ins. Never "+0.0 kg".
- Source visibility: all numbers trace back to journal; no source chip on Digest (source belongs on Today/detail, not the recap).
- No confidence chip here — Digest is aggregated, per-item confidence is one level down.

## 9. Cross-platform deviations

- **Share mechanism** — web tries `navigator.share` then clipboard; mobile uses RN `Share.share`. UI identical.
- **Close button** — web: 32×32 with hover; mobile: 40×40 hit slop, no hover.
- **Haptic** — mobile only: light impact on share, selection on dismiss.
- **Tile grid** — web can flow to 4-up ≥720px; mobile always 2×2.

No intentional copy divergence. The empty subline + first_week check-in
headline are history-aware on both platforms via the shared
`weeklyRecapEmptyCopy` helper (see §6 Microcopy).

## 10. Acceptance criteria

1. Digest renders on Progress on web and mobile from a single shared prop shape.
2. When all narrative lines suppress, card still looks intentional (not empty).
3. Weight delta does not render "+0.0 kg" or "0 kg" — null suppresses.
4. Maintenance line does not render when adaptive == formula.
5. Streak tile is present on Digest (decision 2026-04-21).
6. `weekly-recap-card.tsx` (web) and `WeeklyRecapCard.tsx` (mobile) are deleted in the same PR that ships Digest; all imports updated.
7. All 7 states (loading, empty, partial, success, error, stale, offline) have a tested treatment.
8. Analytics: `weekly_digest_shown` on mount, `weekly_digest_shared`, `weekly_digest_dismissed`, and the existing `weekly_recap_save_prompt_tapped` carries over renamed `weekly_digest_save_prompt_tapped`.
9. Share text continues to use `formatRecapForShare` (or a renamed `formatDigestForShare` with identical output) so shared strings stay stable.
10. Zero new design tokens introduced; all colours via existing semantic tokens.

## 11. Open questions

- Analytics event rename: keep `weekly_recap_*` names for continuity, or rename to `weekly_digest_*`? Route to `analytics-engineer`.
- Share-string rename (`formatRecapForShare` → `formatDigestForShare`) — behaviour-preserving rename or leave as is? Route to `product-memory`.
- Mid-week peek: should users be able to pull up the prior-week Digest on demand beyond the Sunday window? Out of scope for v1.

## 12. Blended variant (ENG-740, 2026-05-26)

The blended Week-Digest merges the two cards that previously stacked on
Progress — the dismissable `<Digest>` recap and the always-on
`<DigestStoryCard>` — into one premium card. Approved design:
`docs/prototypes/2026-05-26-progress-digest-blend/index.html`; design
language: `docs/ux/premium-design-language.md` (the 8 principles).

**Files**
- Web card: `src/app/components/suppr/digest-blended.tsx` (rendered by
  `<Digest blended>` — the `Digest` function is now a thin dispatcher to
  `DigestLegacy` / `DigestBlended`).
- Mobile card: `apps/mobile/components/DigestBlended.tsx` (same dispatcher
  pattern in `apps/mobile/components/Digest.tsx`).
- Shared data: `DigestBlendedExtras` + `classifyDigestHeroTone` +
  `digestHeroTrackFraction` in `src/lib/nutrition/digest.ts`. The closest
  day's per-day target is surfaced on `WeeklyRecap.bestDay.targetCalories`
  (`src/lib/nutrition/weeklyRecap.ts`); the high/low day means are surfaced
  on `DayOfWeekPattern.highDayAvg` / `.lowDayAvg`
  (`src/lib/nutrition/dayOfWeekPattern.ts`).

**Structure (top → bottom; ONE soft-filled region only, everything else
hairline + whitespace — no nested boxes):**
1. Eyebrow `WEEK DIGEST · {weekLabel}` (muted caps) + ✕ dismiss top-right.
2. HERO (the one soft-fill): eyebrow `CLOSEST TO TARGET`, the day name
   large/bold, the day's calories as a hero number on a target-relative
   track (`dayCalories / targetCalories`), `680 kcal` left + `901 target`
   right, your-day/target micro-labels. Dot + number colour by the
   calorie-ring 3-state rule (under→success, over→destructive, ±4%→neutral).
   Supporting line: "{protein}g protein · your most on-target day this week".
3. Hairline → borderless 4-metric strip: Streak (d) · Avg cal (per day) ·
   Protein (g + "% of target" in success when on-target, else muted, never
   red) · Weight (delta + "first→last"). Number-over-label, tabular-nums,
   no per-cell borders/fills. Respects `weightSurfaceMode`.
4. Hairline → PATTERN row: eyebrow `PATTERN`, one neutral past-tense
   sentence ("Sundays ran higher than Fridays this week"), a two-bar
   comparison (calm primary tint at 24%, NOT red/green), `+N kcal` delta
   right. No CTA. **Suppressed when < 4 days logged or no pattern.**
5. Hairline → maintenance row: quiet muted single line + optional inline
   "Adjust pace →" link (web → `/settings#targets`; mobile → `/targets`).
   Suppressed when the host passes `maintenanceLine: null`.
6. Footer: "Share week" is the ONLY filled button (success-soft) + "Got it"
   muted text; ✕ persists top-right.

**Always-on with a per-week ✕ dismiss** — NOT the Sat→Tue window. Host
visibility: `flag ON && recap.daysLogged > 0 && not-dismissed-this-week`.
Dismiss reuses the existing `weekly_recap_last_seen_week_key` seen-state.

**Day-count reconciliation (the 6-vs-2 bug).** The two old cards disagreed
because they described different weeks, not because they counted differently:
`<Digest>` fed `recap.daysLogged` (PREVIOUS week, anchored `now − 7`) and
`<DigestStoryCard>` fed `weekStats.daysWithFood` (CURRENT week). Both use the
identical definition `days.filter(d => d.calories > 0).length`. A "week
digest" narrates the **completed** week (past-tense voice rule), so the
blended card sources **everything from `recap.*`** (previous week) — one
internally consistent count across the whole card.

**States.** loading / error reuse the legacy minimal tiles. empty renders a
calm hero ("Quiet week.") with the PATTERN + maintenance rows suppressed.
partial (< 4 days) suppresses the PATTERN row and annotates "per day (over N
days)". success / offline render the full card. No element ever shows a
fabricated number — each suppresses when its backing value is absent.

**Analytics.** No new events — `weekly_recap_shown` / `_shared` / `_dismissed`
carry over (fired from inside the blended card on mount / share / dismiss).

**Tokens.** All colour via existing semantic tokens (web CSS vars;
`Accent.*` / `Colors.*` on mobile). The pattern-bar tint is `primary/25` web
and `Accent.primary + "3D"` mobile (≈24% alpha). Zero new tokens.

**Tests.** `tests/unit/digestBlended.test.tsx` (web) +
`apps/mobile/tests/unit/digestBlended.test.tsx` (mobile) pin the structure,
hero tone, suppression gates, empty state, and the dispatcher's flag gating.
Hero-track math + tone classifier unit-tested in `tests/unit/digest.test.ts`;
the surfaced data fields in `tests/unit/dayOfWeekPattern.test.ts` +
`tests/unit/closestToTargetDay.test.ts`.

**Cross-platform deviations** (vs §9): identical structure/copy/colour; only
the Share mechanism (RN `Share.share` vs `navigator.share`/clipboard) and the
metric-strip wrap on narrow widths differ — any 2×2 wrap stays BORDERLESS.
