# Habits & Behaviour Change — Best-in-Class Redesign Spec

**Surface:** Habits & behaviour-change layer — streaks, freezes, milestones, win-moments, weekly check-in, recap/digest, missed-yesterday, onboarding nudge queue, goal-pace re-tune. Touches Today tab, Progress tab, `/weekly-recap` (mobile), and the web `weekly-checkin-dialog`.
**Date:** 2026-06-02
**Status:** Design spec — not yet implemented
**Flag gate required:** `habits_redesign_v2` for any visual/structural change. Individual sub-components already have their own flags (`redesign_motion`); keep that granular gate alive. (`redesign_winmoment` was also one of these — it collapsed permanently-on and was removed from source, ENG-1651; there is nothing left to keep alive there.)
**Author:** docs-system
**Inputs:** functional inventory (Input A — product spec) + Mobbin benchmark (Input B)

---

## 1. Surface overview

### Purpose

The habits surface is Suppr's **anti-gamification behaviour-change layer**. Its job is not to hook or guilt users — it is to give them honest, calm signal that their behaviour is building toward something real. Per locked decision D-2026-04-27-07 ("streaks are the laziest retention loop"), the philosophy is:

- Streak demoted to a pip, not a hero.
- Celebration rationed: one win-moment per landmark per day, rising-edge only.
- Freezes are a protective mechanism, not a premium currency or a collectable.
- The intelligence sits in the MacroFactor-parity weekly check-in (silent adaptive-TDEE refresh) and in a coaching paragraph that names cause and trend — not in confetti or fire glyphs.
- Copy is calm-warm-coach. Past days = past tense. No "!", no "crushed it", no 🔥, no "don't break your streak."

### Role in the product

Users return to Suppr because it gives them an honest, personalised read on whether their food choices are moving them toward their goals. The habits surface is the **return loop**: small daily nudges (streak pip, missed-yesterday, nudge queue) → weekly reckoning (check-in + recap) → landmark moments (milestone, win-moment). It earns trust by never fabricating a delta, never inventing a streak, never hiding a failed freeze.

### Navigation anchors

| Entry point | Platform | Routes to |
|---|---|---|
| StreakPip in Today date row | Mobile | `/weekly-recap` (tappable) |
| StreakPip in Today date row | Web | Display-only |
| Weekly check-in banner | Mobile | `/weekly-recap` → check-in sheet |
| Weekly check-in dialog | Web | In-Today modal |
| Today (below meals) | Both | Missed-yesterday banner, nudge cards |
| Progress tab | Both | Digest card, Milestone30Day modal/dialog, Digest story lead card |
| Weekly recap push notification | Both | Deep-links to `/weekly-recap` (mobile) or Progress (web) |

### Platform carve-outs (intentional — do NOT fix in redesign)

- StreakPip tap: mobile-only navigation; web pip is display-only.
- `/weekly-recap` dedicated screen: mobile only; Progress Digest covers the web need.
- Weekly check-in entry: banner → screen (mobile) vs in-Today dialog (web).
- Goal-pace re-tune: dedicated sheet (mobile) vs Settings → Targets (web).
- Onboarding nudge queue: mobile-only (HealthKit-native; web has no Today nudge surface).

---

## 2. Current design — weaknesses audit

### 2.1 StreakPip

- **Glyph conflicts with brand voice.** The `Flame` lucide glyph, even with terracotta tint, reads as "🔥 energy" — the very gamification register the copy rules forbid. The choice of glyph is currently more Duolingo than Oura.
- **Milestone amber bleeds into alert semantics.** Amber is locked to over-budget/alerts. The milestone tint at `[7,14,21,30,60,90,100,365]` uses `Accent.warning` which is amber — this creates a collision where milestone celebrations share the same colour signal as "you went over your calorie target." The tint needs its own token.
- **Freeze-protected state is visually noisy.** The `Shield` glyph + "freeze" text label alongside the flame glyph and numeral creates three competing elements in a 22pt pill. The freeze state needs a cleaner idiom.
- **The pip has no "next freeze" affordance.** `availableFreezes` and the `earnFreezeIfMilestone` (every multiple of 7) data is computed but never surfaced at-a-glance. A user on day 9 doesn't know they're 5 days from their next earned freeze.
- **Web pip is display-only with no tap target or tooltip.** For web users, the streak is a number with no path to context.

### 2.2 TodayStreakInsightCard

- **The "N available" freeze badge is disconnected from the mechanic.** Showing `freezesAvailable: 2` tells users the count but not the rule (earn one every 7 days). Users who hit 0 have no signal for when the budget will refill.
- **"You earned a freeze" dismissible row is one-shot and disappears forever.** After dismiss it's gone with no lasting record. Users who want to see their freeze history have no surface.
- **Copy is correct but visually flat.** "You've logged {n} days in a row." is the right tone, but the card renders the sentence at body text size alongside the badge — no editorial hierarchy.

### 2.3 Streak freeze surfacing

- **No visual "freeze used" history.** `usedHistory` is computed and `protectedDateKeys` are derived, but there is no calendar or timeline showing which days were protected. Users who miss a day don't know a freeze silently saved them unless the app tells them explicitly on next open.
- **`dropOldFreezesForMonth` trims earned-at after 90 days.** This is mathematically correct but creates a scenario where `earnedAt.length` falls without user awareness. No surfacing of this.

### 2.4 Milestone30DayModal

- **Stats are listed, not told as a story.** Four stat rows (avg kcal / longest streak / top foods / weight delta) are presented in equal-weight rows. There is no narrative sentence that says what they mean together.
- **"Keep going" CTA is grammatically correct but emotionally thin.** After 30 days of data, the modal should feel like a genuine moment — not a dialog with a single button.
- **The modal appears on Progress tab only (ENG-632).** This is the right call — confirmed. No Today cold-open. But within Progress, there is no persistent badge or card that marks the milestone for users who have already seen it (it disappears after `milestone_30_shown_at` is set).

### 2.5 Win-moment overlay

- **Goal-hit and macro-hit share the same Lottie.** ENG-798 is already ticketed. No new work here beyond confirming the gap survives to ship.
- **The overlay is correct in rationing (once-per-calendar-day) but has no "what caused this" context.** The celebration fires; the user doesn't know if it was a streak milestone (3/7/30/100), a goal-hit (≥85% ring), or a macro-hit.

### 2.6 Weekly check-in (mobile `/weekly-recap` + web dialog)

- **The `whyLine` and `deltaLine` are presented as body text rows.** "2,340 → 2,410 kcal/day" and the observational why-line are the most intelligent things in the product. They are currently styled at body weight in a dialog/screen with no visual hierarchy that says "this is the insight."
- **No editorial image backing the hero.** The check-in triggers a TDEE recalibration that is genuinely personal — "here is what your body did last week." Every best-in-class comparable (Oura especially) wraps this kind of insight in a warm, photo-backed hero. Currently: plain card background.
- **The floor-clamp honesty line (`floorAppliedKcal`, F-157) is buried.** When the 1200-kcal floor is applied it fires a disclaimer, but it is currently a small footnote below the suggestion. Users who hit the floor deserve to see the honest explainer prominently.
- **Accept / keep-current / dismiss tri-state actions are visually equivalent.** All three render as similar-weight buttons. The primary action (accept the updated target) should be visually dominant.
- **No `first_week` / `low_confidence` states rendered differently.** The `buildWeeklyCheckin` cascade produces three distinct kinds: `first_week` (encouraging), `low_confidence` (explains the limit), `ready` (full insight). Currently they share the same card chrome.

### 2.7 Weekly recap / Digest card (Progress)

- **`resolveDigestHeadline` result is same-size as body text.** The digest headline cascade ("Last week: down 1.2 kg.", "Streak held — 8 days.", etc.) is the most important single line in the digest. It should be the first thing the eye lands on.
- **`digestStory.ts` day-of-week pattern line ("~250 more kcal on Saturdays") is rendered at body weight.** This is an Oura-grade behavioural insight that currently looks like a footnote.
- **`bestDay` (Closest to target) is a label in a list.** It should be the hero element of the recap — a named day with a delta from target, rendered with more visual weight.
- **`weightDeltaKg` is shown as a plain number.** "−0.8 kg" needs a directional cue and context (the week span, the first→last weigh-in values).
- **`formatRecapForShare` CTA is not visible until the user has read the full card.** The share moment should be accessible earlier and more naturally prompted.

### 2.8 Missed-yesterday banner

- **Banner blends into the Today card stack.** The correct no-CTA, forward-looking copy ("Yesterday's gone — today's a fresh start.") is right, but the card renders with no visual differentiation from nudge cards or the streak insight card.
- **Amber is NOT the right tint.** Missing a day is not an over-budget/alert signal. The banner should use sage/ink — calm recovery tone.

### 2.9 Onboarding nudge queue

- **Cards look like marketing cards.** The import / recipes / Apple Health nudges have CTAs styled as full-width buttons which compete with the primary Today actions. A nudge is a quiet suggestion, not a second CTA bar.
- **No progress indicator for the queue.** A user who dismissed the import nudge has no signal that the recipes nudge is next. The queue is invisible to the user.

### 2.10 Goal-pace re-tune sheet (mobile)

- **The sheet opens cold with no reminder of context.** `GoalPaceRetuneSheet` presents the pace options without a brief recap of why a re-tune is suggested (the TDEE delta and why-line from the check-in). Context is lost between the check-in card and the retune sheet.

---

## 3. Component redesign specs

---

### 3.1 StreakPip

**Current purpose:** Restrained consecutive-logging pip in the Today date row. Milestone tint + freeze-protected state.

**Current weaknesses:** Wrong glyph semantics, amber collision, noisy freeze state, no "next freeze" affordance.

**Best-in-class benchmark:**
- Oura "1 Day Streak" (https://mobbin.com/screens/f3d63f0f-0f36-4b11-a212-23b0c4e962d0) — warm candle-flame on near-black, single serif numeral, single-line calm copy. The celebration is in the type size, not the saturation.
- Habitify inline "3-day streak" (https://mobbin.com/screens/6cd17f96-9eae-4ed5-86f7-d7d9d8fb2944) — streak as quiet sub-label under the habit, not a hero.
- Anti-pattern: Numo "don't stop!" (https://mobbin.com/screens/cae1eb96-5ca5-4496-9dc4-9aa305c289ef) and Done "DON'T BREAK THE STREAK" (https://mobbin.com/screens/a1296c87-74bf-447d-9395-14811f65ef64) — exact violations of `FORBIDDEN_TODAY_PHRASES`.

**Proposed redesign**

_Glyph:_ Replace `Flame` with a small custom or lucide `Sun` or `Sparkles` icon — warm, non-alarmist, not fire. The Flame glyph is phonetically "you're on fire" which violates the voice rules. A minimal sun-arc (circle segment, not full disc) or a small dot-burst works. Recolour to terracotta for active state. Keep `Shield` for freeze-protected.

_Milestone tint:_ Introduce a dedicated token `--streak-milestone` mapped to a warm **deep terracotta** (`#A3522C`, one step darker than `--accent`), separate from `--warning` (amber). Amber stays exclusively for over-budget and alert states. The milestone pip uses `--streak-milestone` border + numeral, the background stays white. Labels ("1 week streak", "2 month streak", etc.) keep the existing milestone set `[7,14,21,30,60,90,100,365]` exactly.

_Layout:_ The pill contains three elements in a 22pt height:
1. Left: the sun-arc glyph, 14pt, terracotta (active) / warm-grey (inactive / 0-day)
2. Centre: Inter semi-bold numeral, 13pt
3. Right: only when freeze-protected — `Shield` 12pt sage (`#7C8466`), no text label

_"Next freeze" affordance:_ Add a ghost tooltip on tap (mobile) or hover (web) that shows the next freeze earn day. Example: "Next freeze: day 14". This is one line below the streak count, shown only when `availableFreezes < budgetMax` and the current streak is between milestones. Uses `earnFreezeIfMilestone` logic — next earn = next multiple of 7 above current streak length. Text style: Inter 11pt warm-grey.

_States:_
- `0` days: glyph warm-grey, numeral "–", label none. Accessible label: "No streak yet."
- `1` day: glyph terracotta 50% opacity, numeral "1", label none.
- `≥2` days active: glyph terracotta full, numeral, no label.
- Milestone: glyph `--streak-milestone`, numeral, milestone label below (e.g. "1 week streak") in Inter 11pt `--streak-milestone`.
- Freeze-protected: glyph terracotta + `Shield` sage right, no additional text. Tooltip on tap: "Freeze used [day]".
- `0` active with recent freeze: same as freeze-protected above but numeral is the protected streak length.

_Web pip:_ Add a `<Tooltip>` wrapper with the same "next freeze: day N" content. No navigation tap (no `/weekly-recap` route on web). Accessible label via `aria-label`.

_Interactions:_ Mobile — tap pip → `/weekly-recap`. Web — no navigation. Both — haptic: none (the pip is informational, not a celebration trigger).

_Microcopy (unchanged — already best-in-class):_ "You've logged {n} days in a row." in TodayStreakInsightCard; "Start streak" for 0-day state in pip label.

**User benefit:** The pip now communicates the full state (active / milestone / protected / next earn) in three glyphs without gamification alarm or amber collision. Users always know when their next freeze is coming.

---

### 3.2 TodayStreakInsightCard

**Current purpose:** Expanded streak insight on Today — count, freeze badge, "You earned a freeze" one-shot row. Mobile + web parity.

**Current weaknesses:** Freeze badge disconnected from earn mechanic; flat body text hierarchy; one-shot dismiss with no history surface.

**Best-in-class benchmark:**
- Alma "Streak saves: N / How it works" (https://mobbin.com/screens/06d5642e-8ce4-48f2-8515-bd3ce61defc8) — counted resource with an explainer affordance. The one design element missing from TodayStreakInsightCard.

**Proposed redesign**

_Card chrome:_ Soft warm-grey background (`#F6F5F2`), hairline border (`#ECEAE4`), 12pt corner radius. No colour-block header.

_Layout — two rows:_

Row 1 (always visible):
- Left: sun-arc glyph 20pt terracotta
- Centre: Fraunces bold `{n}` at 28pt warm-ink (`#1B1814`) — the editorial big numeral the design system specifies for scores
- Right of numeral: Inter regular "days in a row" 13pt warm-grey, vertically centred

Row 2 (conditional):
- When `freezesAvailable > 0`: Inter 12pt warm-grey "· {n} freeze{s} available" with small `Shield` sage 12pt
- When `freezesAvailable === 0` and streak is between milestones: Inter 12pt warm-grey "· Next freeze at day {nextMultipleOf7}" — uses same data as pip tooltip
- When `freezesAvailable === 0` and streak is on a milestone: nothing (the milestone label in the pip is the signal)
- When "You earned a freeze" (new earn this session, not yet acknowledged): a third row — small sage badge "Freeze earned" + Inter 12pt "You hit {milestone}-day logging. One freeze added." with a `×` dismiss. On dismiss: writes `streak_freeze_earned_seen` event, removes the row. This replaces the current one-shot dismissible row but keeps the same event taxonomy.

_"How it works" affordance:_ A hairline-bordered ghost button "How freezes work" at the bottom of the card (Inter 12pt terracotta). Tap opens a bottom sheet (mobile) or tooltip popover (web) with three sentences: "Miss a day? A freeze saves your streak." / "You earn a freeze every 7 days of logging." / "You have a budget of {budgetMax} freezes." No upsell. No Pro language. This is the Alma "How it works" pattern applied to Suppr's mechanic.

_Accessibility:_ `accessibilityLabel` on the big numeral: "{n}-day logging streak". Shield glyph: `accessibilityLabel="Streak freeze active"`.

_States:_
- Empty (0 days): card hidden — do not show a 0-day insight card. The pip handles the "Start streak" state.
- 1–6 days: Row 1 + Row 2 freeze count or next-earn line.
- Milestone day: Row 1 with milestone label in `--streak-milestone`, Row 2 freeze count.
- Freeze just used (shown once): prepend a calm sage row "Freeze used yesterday. Your streak is protected." with `Shield` 12pt sage. Fires `streak_freeze_used` event read on mount.
- Loading: skeleton placeholder, two rows, warm-grey shimmer.
- Error: card hidden (swallow — same current behaviour).

**User benefit:** Users understand exactly how freezes work, when the next one is coming, and what a freeze save means — without a gamification register or a Pro paywall.

---

### 3.3 Streak freeze detail (new: freeze history row / "How it works" sheet)

**Current purpose:** N/A — freeze history has no dedicated surface today.

**Current weakness:** `usedHistory` is computed but never rendered. Users who miss a day and are silently protected have no confirmation. The budget mechanic is opaque.

**Proposed redesign**

_No new screen._ The "How it works" bottom sheet (described in 3.2) expands to include:

- A compact timeline of the last 5 freeze events (earned / used), each as a one-line row: `Shield` 14pt sage + date key + "Earned" or "Used (streak saved)". Pulled from `usedHistory` and `earnedAt` in the ledger, formatted as short date ("Mon 2 Jun").
- If `usedHistory` is empty: "No freezes used yet." in Inter 12pt warm-grey.
- If `earnedAt` is empty (budget 3 but never earned one yet): "Log 7 days in a row to earn your first freeze." — forward-looking, not a deficit signal.

_No separate route._ This is a sheet, not a screen. Mobile: `BottomSheet` at 40% height. Web: `Popover` anchored to the "How freezes work" button.

_Microcopy rules:_ Never say "spend a freeze." Say "a freeze was used." Never say "you wasted a freeze." Never surface `dropOldFreezesForMonth` trim events to users.

---

### 3.4 Missed-yesterday banner

**Current purpose:** Calm recovery banner, no CTA, fixed copy. Fires on Today when yesterday has 0 meals and prior journal history exists. Not on first day of week.

**Current weaknesses:** Blends into card stack; amber tint risk (must use sage/ink, not amber).

**Best-in-class benchmark:**
- Oura "Rest Mode" (https://mobbin.com/screens/e9b7815f-8a3e-4774-a777-f0b121901b21) — recovery state framed as normal, not failure. Calm copy. Zero guilt.
- Me+ "Shall we continue our journey tomorrow?" (https://mobbin.com/screens/59717fd3-8d48-4592-b977-8ae0f18cbe69) — forward-looking register (despite the cartoon character — discard the character, keep the forward tone).
- Anti-pattern: Done "DON'T BREAK THE STREAK / streak goes to 0" (https://mobbin.com/screens/a1296c87-74bf-447d-9395-14811f65ef64) — the shaming version.

**Proposed redesign**

_Card chrome:_ White base, `2px` left border in sage (`#7C8466`), 12pt radius, no fill colour. The sage border is the only colour signal — "this is recovery, not an alert." No amber. No terracotta.

_Layout:_ Single-line card.
- Left: `Sunrise` lucide icon 16pt sage
- Text: Inter regular 14pt warm-ink "Yesterday's gone — today's a fresh start." — copy unchanged, this is already best-in-class
- No CTA, no dismiss button. Card auto-disappears per `missedYesterday.ts` rules (only shows when yesterday = 0 meals, prior history, not first day of week).

_Web parity:_ Same card, same copy, same sage left-border treatment. `NutritionTracker.tsx` existing render point, replace visual chrome only.

_States:_ This card has one state (visible / not visible per engine logic). No loading state needed — the check is synchronous from loaded data.

_Accessibility:_ `accessibilityRole="alert"` — this is an informational alert, not interactive. `accessibilityLiveRegion="polite"`.

**User benefit:** A user who missed yesterday sees a calm, forward-looking signal that does not shame or add friction. The sage left-border reads as "a note from your coach" rather than a failure warning.

---

### 3.5 Onboarding nudge queue

**Current purpose:** Priority-ordered nudge queue (import → recipes → Apple Health). Max 2 shown. Cooldown-gated. Mobile-only.

**Current weaknesses:** Cards look like marketing CTAs; queue is invisible; buttons compete with Today primary actions.

**Best-in-class benchmark:**
- Finch "9 Goals" gentle prompts (https://mobbin.com/screens/48a1abab-bae0-427d-a75e-c0b89403adbc) — subordinate, dismissible, low-priority.
- Runna "Tips for today" (https://mobbin.com/screens/3581e2f0-a0b7-4d35-b290-31ff2971043a) — quiet inline hints that do not stack aggressively.

**Proposed redesign**

_Card chrome:_ Hairline-bordered warm-grey card (`#F6F5F2`, border `#ECEAE4`). No filled CTA button. Instead: a text-link CTA — Inter 13pt terracotta with a `→` glyph. This reduces the visual weight of the nudge below the primary Log actions.

_Layout:_
- No icon at lead (icon was contributing to the "marketing card" register)
- Single short sentence (the existing nudge copy, already correct length)
- Text-link CTA right-aligned
- Small `×` dismiss in top-right corner, 16pt warm-grey, `accessibilityLabel="Dismiss suggestion"`

_Queue indicator:_ Do not add a dot/step indicator. The nudge queue is intentionally invisible — showing "1 of 3" would turn it into a progress bar which is a gamification register. Users see one nudge at a time; they don't need a count.

_Max-2 cap:_ The `BELOW_MEALS_PROMPT_MAX = 2` cap stays. When two nudges show, each gets its own card. No stacking into one card.

_Cooldown / dismissal UX:_ No change to the logic (`primary` writes cooldown + permanent-removal if flagged; `later` writes cooldown only). The text-link CTA maps to `"primary"` action; the `×` dismiss maps to `"later"`.

**User benefit:** Nudges are visually subordinate to the primary Today content. Users are not greeted with two full-width marketing buttons below their food log.

---

### 3.6 Weekly Check-in — mobile `/weekly-recap` screen

**Current purpose:** First-day-of-week banner → `/weekly-recap` screen → check-in section with TDEE delta, why-line, goal-pace re-tune. MacroFactor-parity. Gate: confidence ≥ medium; `daysLoggedThisWeek ≥ 5`; not shown in last 6 days.

**Current weaknesses:** whyLine / deltaLine presented as body text rows; no editorial image; floor-clamp honesty line buried; accept/keep/dismiss visually equivalent; `first_week`/`low_confidence`/`ready` states share same chrome.

**Best-in-class benchmark:**
- Oura Readiness insight cards (https://mobbin.com/screens/9606969d-6f33-4cc7-8ef9-33d1f56cebbc, https://mobbin.com/screens/c1a31cec-0c1c-4fb5-9408-4fe8ad8baf80, https://mobbin.com/screens/2f008eb0-30b0-4137-a981-0e9b1d68a495) — big editorial score arc + narrative paragraph that reads like a calm coach explaining the number. The single best template for the check-in hero.
- Fitbit "Last Week 4 of 5 days" (https://mobbin.com/screens/c0923855-95d0-4c0c-a86f-cf32c637d771) — clean week-grid + last-week comparison.
- MyFitnessPal "Weekly Digest" (https://mobbin.com/screens/8dce255f-648b-4a32-92f4-9cba7467236a) — direct competitor; plain stat list, one-line summary at top. Suppr's narrative already beats it — lift the visual presentation.

**Proposed redesign — `/weekly-recap` screen**

_Screen layout (mobile):_

**Hero card — check-in or recap depending on `buildWeeklyCheckin` kind:**

The hero occupies the top ~45% of the screen. It is a rounded card (16pt radius, white) with:

1. Background: hyperreal finished-dish photograph (natural light, ceramic/linen props, shallow depth of field — per the locked meal photography rule). 50% dark overlay gradient from bottom, so text over the bottom half reads cleanly in white.
2. Over the overlay — top section:
   - Fraunces bold 32pt white: the `headline` from `buildWeeklyCheckinContent` or `buildWeeklyRecap`. This is the **only** headline on the whole screen. Example: "Your week in review." / "Well logged." / "Check-in ready."
   - Inter regular 15pt white/80% opacity: the `whyLine` — the observational why-sentence. Example: "Your intake was close to your TDEE last week, and your weight stayed level." This is the coaching paragraph. It wraps to two lines maximum.
3. Bottom of overlay — the `deltaLine`:
   - Inter semi-bold 18pt white: "2,340 → 2,410 kcal/day" — the TDEE delta rendered as a clean before/after. If no delta (`first_week` or `low_confidence` kind): show the `headline` only, no deltaLine.
4. If `floorAppliedKcal` is set (F-157 floor-clamp): a sage-tinted info row below the hero card: `Info` icon 14pt sage + Inter 13pt warm-grey "Your suggested target was raised to {floor} kcal to stay above the safe minimum." This line is **never** buried — it appears immediately below the hero, full width, before the action buttons.

**Action row (below hero card):**

Three actions, vertically stacked (not side by side — the tri-state deserves vertical space):

1. Primary: filled terracotta button "Update my target to {suggestedTarget} kcal" — width full, 48pt height. Maps to `"accepted"` decision.
2. Secondary: outlined warm-ink button "Keep {currentTarget} kcal" — same width, 44pt height. Maps to `"kept_current"`.
3. Tertiary: plain text link Inter 13pt warm-grey "Ask me next week" centred below the two buttons. Maps to `"dismissed"`.

All three actions write to `profiles.last_weekly_checkin_decision`. The `suggestedTarget` is computed from `currentTarget + tdeeDelta`, floored at 1200 kcal — surfaced in the button label.

**State variants:**

- `first_week` kind: hero shows encouraging headline, no deltaLine, no action buttons. Single "Got it" terracotta button. Copy: "You're building your history. Keep logging to unlock your first personalised check-in."
- `low_confidence` kind: hero shows headline + a one-sentence honest explainer ("Not enough weigh-ins yet to calculate your TDEE accurately."). Single "Got it" button. No suggested target.
- `ready` kind: full layout above.

**Below the check-in card — recap section:**

After the hero card and actions, the `/weekly-recap` screen continues with the recap metrics for the previous completed week. These are distinct from the check-in (check-in = TDEE recalibration; recap = last week summary). Layout:

- Section header: Inter semi-bold 12pt warm-grey uppercase tracking-wide "LAST WEEK"
- `daysLogged` / `total: 7` as a mini week-strip: 7 pill cells Mon–Sun, filled terracotta if logged, warm-grey hairline if not. Uses `weekLoggedDays` from `computeWeekLoggedDays`.
- Three stat tiles (2+1 layout): `avgCalories` left, `avgProtein` right, `avgFiberG` below left — each: Fraunces bold 22pt numeral + Inter 11pt warm-grey label. Denominators: days-with-food, not 7 (per spec — averaged over days-with-food).
- `bestDay` ("Closest to target"): a named-day chip. Fraunces italic 16pt warm-ink day name + "was your closest to target" Inter 13pt warm-grey below. Carries `targetCalories` for context: "Target was {n} kcal." If null (no eligible day): hidden.
- `weightDeltaKg`: if non-null: a single stat line `↓ {n} kg` (green / `↑ {n} kg` sage for gain — neither is "bad") + "from {weightFirstKg} → {weightLastKg} kg" Inter 12pt warm-grey. Never shown as "+0.0 kg" (spec rule). If null (<2 weigh-ins): "Log your weight to see trends" in Inter 12pt warm-grey with a ghost "Log weight" text-link terracotta.
- Share button: `Share2` lucide 20pt warm-grey text-link "Share your week" at bottom of recap section. Triggers `formatRecapForShare`.

**Goal-pace re-tune sheet:**

`GoalPaceRetuneSheet` opens from a text-link "Review your pace" below the accepted check-in. The sheet opens pre-populated with the check-in context visible at the top (the `whyLine` in a small sage-tinted info card) so the user has context when choosing a new pace target. No other changes to the sheet mechanic.

**Weekly check-in banner (Today, first day of week):**

`WeeklyCheckinBanner.tsx` redesign: sage left-border card (matching missed-yesterday treatment for consistency), `CalendarCheck` lucide 16pt sage, Inter regular 14pt warm-ink "Your weekly check-in is ready." Text-link "See it →" terracotta right-aligned. No confetti, no countdown.

---

### 3.7 Weekly Check-in — web dialog

**Current purpose:** `weekly-checkin-dialog.tsx` — in-Today modal with accept/keep/dismiss. Content from `buildWeeklyCheckinContent`.

**Current weaknesses:** Same as mobile — body-text hierarchy, no image hero, floor-clamp line buried, action buttons visually equivalent.

**Proposed redesign**

_Dialog chrome:_ Max-width 480px, white background, 16pt radius, shadow `0 8px 32px rgba(0,0,0,0.12)`. No fullscreen. Escape key dismisses (writes `"dismissed"`).

_Hero:_ Same structure as mobile hero card — finished-dish photograph in the top 200px of the dialog, dark gradient overlay from bottom, Fraunces 26pt white headline + whyLine 14pt white/80%. For web the image is `object-fit: cover` in a fixed-height container.

_deltaLine:_ Inter semi-bold 16pt warm-ink below the image (outside the overlay), on white background.

_Floor-clamp line:_ Same sage-tinted info row, positioned between deltaLine and action buttons.

_Action buttons:_ Same vertical stack as mobile — primary terracotta filled, secondary outlined, tertiary text-link.

_`first_week` / `low_confidence` states:_ Same differentiated treatment as mobile, no action buttons on those variants.

---

### 3.8 Weekly Recap / Digest card (Progress tab)

**Current purpose:** Recap narrative card on Progress tab. `resolveDigestHeadline`, `digestStory.ts` sentences, day-of-week pattern line, share affordance. Always visible (not gated by check-in gate).

**Current weaknesses:** Headline same visual weight as body text; pattern line reads as footnote; bestDay buried in a list; weightDelta as plain number; share CTA at end of card only.

**Best-in-class benchmark:**
- Oura 7-day sparkline card (https://mobbin.com/screens/2f008eb0-30b0-4137-a981-0e9b1d68a495) — score arc + coaching paragraph + contextual sparkline. The model for the digest story card.
- Runna "Recovery done" + "My insights" tiles (https://mobbin.com/screens/57dd0758-c29a-49cc-9ec1-cab66ee22485) — personalised narrative lead + insight tiles. Validates `digestStory` as a named-user narrative.
- MFP Weekly Digest (https://mobbin.com/screens/8dce255f-648b-4a32-92f4-9cba7467236a) — direct competitor. Plain. Suppr's narrative is already richer — only the visual presentation needs lifting.

**Proposed redesign**

_Card chrome:_ White, hairline border (`#ECEAE4`), 16pt radius. The Digest card is the **Progress tab lead card** — it sits above all other Progress cards. Do not demote it.

_Layout:_

1. **Headline section** — top of card, full width:
   - Fraunces bold 22pt warm-ink: `resolveDigestHeadline` result. Example: "Last week: down 1.2 kg." / "Streak held — 8 days." / "Quiet week." This is the first thing the eye lands on. No competing text at the same scale.
   - Inter regular 13pt warm-grey below headline: the `digestStory` calorie/protein sentence. Example: "You averaged 1,840 kcal and 112g protein across 6 logged days."

2. **Pattern line** — when present (suppressed <14d data or <200 kcal gap):
   - A hairline separator above this section.
   - `TrendingUp` or `TrendingDown` lucide 14pt sage + Inter regular 13pt warm-grey: the day-of-week pattern. Example: "You tend to eat ~250 more kcal on Saturdays." This is an Oura-grade insight — give it visual weight with the icon and a distinct section, not a footnote.

3. **Closest-to-target highlight** — when `bestDay` non-null:
   - A soft warm-grey inset tile (8pt radius, `#F6F5F2`) below the pattern line.
   - Fraunces italic 18pt warm-ink: day name (e.g. "Thursday"). Inter 12pt warm-grey: "Closest to your target · {targetCalories} kcal goal." This is the emotional centrepiece of the recap — give it the same card-in-card treatment the Oura insight tiles use.

4. **Weight delta line** — when non-null:
   - Two-column row: left = directional weight change (`↓ 0.8 kg` in success green, `↑ 0.4 kg` in sage — neither "bad"); right = span ("6 Jun – 12 Jun").
   - Subtext Inter 11pt warm-grey: "{firstKg} kg → {lastKg} kg". Never "+0.0 kg".

5. **Mini week-strip** — 7 pill cells Mon–Sun, filled terracotta if logged, warm-grey if not. Compact version (20pt height, 6pt gap). Shows `daysLogged` at a glance without a separate row.

6. **Share row** — inside the card, below the week-strip, right-aligned:
   - `Share2` 16pt warm-grey + Inter 12pt warm-grey "Share this week". Not a button — a text affordance. Tapping at any point in the card's bottom section should be reachable without scrolling past stats.

_States:_
- `daysLogged === 0`: show "Quiet week." headline only + the week-strip (all empty). No fabricated stats. "No food logged last week." in Inter 13pt warm-grey.
- Loading: two skeleton rows at 22pt and 13pt, warm-grey shimmer.
- Recap not in window (outside Sat 18:00–Tue timeframe for sunday-start, or equiv): card shows most recent available recap. If `weeklyRecap.shouldShowRecap` is false, the card still renders with last-dismissed week's data as a historical summary rather than hiding entirely.

**Web parity:** Same card structure in `digest-blended.tsx` or `digest.tsx`. The Fraunces headline token and the Closest-to-target inset tile apply on web exactly as on mobile.

---

### 3.9 30-day milestone modal / dialog

**Current purpose:** Stats-rich, no-paywall, no-upsell trust card fired once on Progress tab after 30 distinct days of logging. Stats: avg daily kcal, longest consecutive streak, top foods (≤3, HealthKit fallbacks excluded), weight first→last.

**Current weaknesses:** Stats listed at equal visual weight with no narrative; "Keep going" CTA is thin; no persistent badge after the modal has been dismissed.

**Best-in-class benchmark:**
- pliability "You did it! Path complete." (https://mobbin.com/screens/7557a666-1e29-4df9-a6e0-0819dddcbb87) — full-bleed calm colour-field celebration, no gamification chrome, adult non-cartoonish big moment.
- Elevate "Weekly Report / Accomplishments" (https://mobbin.com/screens/1d9b1f48-d2b1-465d-899b-2a751dc196ad) — real accomplishments in a structured list; validates Suppr's four-stat structure.
- Anti-patterns: Duolingo "You earned a star!", Me+ "Wow! You did it!", Liven "LEVEL UP", Forest emoji tree — all cartoon/gamified. Violate the no-"!" calm-coach rules and the explicit "no paywall/upsell on 30-day milestone" rule.

**Proposed redesign**

_Mobile modal chrome:_ Presents as a sheet from the bottom (70% screen height), not a centred dialog. White background, 20pt top radius. Dark drag handle at top centre.

_Layout:_

1. **Full-width hero block** at the top of the sheet (120px height):
   - Soft warm terracotta gradient background (`#C2683E` → `#E8A87C` left-to-right) — pliability's "calm full-field celebration" translated to Suppr palette. No photograph here — the colour field is the celebration.
   - Fraunces bold 28pt white centred: "30 days of logging." — plain factual, not exclamatory. No "!". No "You did it!".
   - Inter regular 14pt white/80%: "{daysLogged} distinct days in your food diary." Below the title.

2. **Stats section** (below the hero block, on white background):

   Four stats as a 2×2 grid of inset tiles (`#F6F5F2`, 8pt radius, hairline border):

   - Top-left: Fraunces bold 22pt warm-ink `{avgDailyKcal}` + Inter 11pt warm-grey "avg daily kcal"
   - Top-right: Fraunces bold 22pt warm-ink `{longestStreak}` + Inter 11pt warm-grey "longest run"
   - Bottom-left (when `topFoods.length > 0`): Inter 13pt warm-ink list of top foods (max 3, comma-separated) + Inter 11pt warm-grey "most logged"
   - Bottom-right (when `totalWeightDeltaKg !== null`): Fraunces bold 22pt `{delta > 0 ? '+' : ''}{delta}kg` in sage (weight change is directional, not judged good/bad) + Inter 11pt warm-grey "since you started" and the date range
   - If `totalWeightDeltaKg === null`: replace bottom-right tile with "Add weigh-ins to see your trend." in Inter 12pt warm-grey — never "+0.0 kg", never fabricated.

3. **Single CTA** at the bottom of the sheet:
   - Filled terracotta button "Keep going" full-width, 48pt height. Same copy as current — correct. No paywall. No upsell. Fires `milestone_30_dismissed` on tap (per existing event taxonomy).

_Web dialog:_ Same structure in `milestone-30-day-dialog.tsx`. Max-width 440px centred modal. Hero block as top section, then 2×2 grid, then CTA. Same content rules.

_Post-dismiss state:_ Once `milestone_30_shown_at` is set, the modal never re-appears. This is correct behaviour. To give a lasting artefact: add a small "30-day streak" achievement chip to the Progress tab header row (Inter 11pt warm-grey "30-day milestone reached · {date}") — a permanent quiet badge, not an ongoing celebration.

_Accessibility:_ `accessibilityViewIsModal={true}` on mobile. `role="dialog"`, `aria-modal="true"` on web. Focus trapped. ESC dismisses (web).

**User benefit:** The 30-day milestone feels like a genuine moment of acknowledgement. The four honest stats make the achievement real. No cartoon, no exclamation, no paywall.

---

### 3.10 Win-moment overlay

**Current purpose:** Lottie celebration overlay, once-per-calendar-day gate. Three landmark kinds: streak (3/7/30/100), goal-hit (≥85% ring ≤ goal), macro-hit (100–150% of target). Loud success haptic on Lottie beat. Unconditional — `redesign_winmoment` collapsed permanently-on (ENG-1651).

**Current weaknesses:** Goal-hit and macro-hit share the same Lottie (ENG-798, already ticketed). No "what caused this" context during the overlay. Rationing is already best-in-class.

**Proposed redesign (minimal — the mechanism is correct)**

_Overlay:_ Keep the Lottie approach and the pointer-events none design. Keep the once-per-calendar-day gate.

_Context line:_ Add a single text line below the Lottie animation (or bottom-third of the overlay):
- `kind === "streak"`: Fraunces italic 16pt white "Day {milestone}." — just the milestone number in editorial type
- `kind === "goal-hit"`: Fraunces italic 16pt white "On target." — calm, factual
- `kind === "macro-hit"`: Fraunces italic 16pt white "{macroName} goal hit." — which macro

The context line uses `kind` and `milestone?` from `detectWinMoment`'s return. It resolves the "why is this happening?" UX gap without adding verbose copy.

_Haptics:_ Two-tier haptic design is correct and more sophisticated than any Mobbin comparable — preserve exactly:
- `confirmLog()` → quiet Light-impact (<100ms) on every ordinary log (flag: `redesign_motion`)
- Win-moment beat → loud `impactAsync(Heavy)` on the Lottie keyframe — unconditional (`redesign_winmoment` collapsed permanently-on, ENG-1651)

_ENG-798 gap:_ The macro win-moment sharing the goal-hit Lottie is acknowledged. A dedicated macro Lottie (different animation — a ring-fill burst rather than a ring-close) is the only legitimate additive opportunity here. Carry this into the ENG-798 spec when that work starts. Do not add confetti.

_Do NOT add:_ confetti, mascots, scoreboard rank numbers, streak count overlay text, streak-loss countdown, currency glyphs.

---

### 3.11 Weight + TDEE trend chart (recap/Progress context)

**Current purpose:** `weightDeltaKg`/`weightFirstKg`/`weightLastKg` surfaced in recap; adaptive TDEE delta surfaced in check-in. The chart contract sits in the Progress surface but is directly connected to check-in/recap narrative.

**Best-in-class benchmark (gold standard):**
- MacroFactor Expenditure chart with Flux Range confidence band (https://mobbin.com/screens/c4424a5d-cf7e-4ed0-a3f5-f66629846a9e, https://mobbin.com/screens/469af4d6-1ee6-4b1b-9f54-96c813e4d716, https://mobbin.com/screens/ffa3f603-c5a4-4c51-9576-205eaec263a6) — smoothed trend line + translucent confidence band + "Updating vs Holding" legend + Average/Difference header + scrubable tooltips + 1W/1M/3M/6M/1Y/All ranges. Proves depth and beauty are not in tension.

**Anti-patterns (reject explicitly):**
- Noom "120lb by June 22" prediction line (https://mobbin.com/screens/a617cbce-d0e0-4f6f-a2e1-3c74a6065931, https://mobbin.com/screens/ec47268d-4d57-4520-b581-f4041f856c0c) — deterministic forecast line with no confidence band. Beautiful, analytically dishonest.
- Yazio "reach 70kg by April 7" (https://mobbin.com/screens/9bb99bb2-df6d-43c1-85c8-36f90c93c51c) and Alma weight chart (https://mobbin.com/screens/d5d1924d-5970-4437-92d8-e9097400bac1) — smoothed line + goal dashed line only, no uncertainty.

**Chart spec (for Progress weight chart + recap weight delta context):**

1. **Trend line** — smoothed EWMA over raw weigh-ins, recoloured to terracotta on white.
2. **Confidence band** — translucent terracotta fill (`rgba(194,104,62,0.12)`) behind the trend line. Band width reflects `adaptiveTdeeConfidence` level. Narrow at high confidence, wider at medium, widest (and labelled "Calibrating") at low.
3. **Raw weigh-in scatter** — actual scale readings as small filled circles (4pt, warm-ink `#1B1814`, 60% opacity) behind the trend. Users see real vs smoothed.
4. **Header row** — above the chart: Fraunces bold 20pt warm-ink average weight for the period + Inter 12pt warm-grey signed delta ("−0.8 kg" in success green, "+0.4 kg" in sage). Exact date range Inter 11pt warm-grey.
5. **Goal line** — hairline `--muted` dashed horizontal at the target weight (if set), with a small pill label "Goal {n} kg" anchored right. Does not extend beyond the chart bounds.
6. **Scrubable tooltip** — on long-press (mobile) / hover (web): date + value + "Trend: {trendKg}". Inter 12pt, white-background tooltip, 8pt radius.
7. **Range toggles** — 1W / 1M / 3M / 6M / 1Y / All. Disabled (greyed) when insufficient data for that range (MacroFactor does this; Suppr should too).
8. **"Updating / Holding" legend** — two small pills below the chart: terracotta "Updating" (when `adaptiveTdeeConfidence` is building) / sage "Holding" (when stable / stale). Each 20pt height, Inter 11pt.
9. **Sparse state** (< 2 weigh-ins): chart hidden, replaced by `WeightSparseState` CTA — redesign this to match the Progress spec (see `docs/ux/redesign/progress-insights.md` §3.4 for the weight chart sparse state spec).

**Hard rule:** Never ship a bare forecast line without a confidence band. The Noom/Yazio forecast-line aesthetic is explicitly rejected for any in-product trend view.

**TDEE delta in check-in context:** The `deltaLine` "2,340 → 2,410 kcal/day" is a textual expression of TDEE confidence — it does not need a chart. The chart spec above is for the Progress weight chart. Keep the deltaLine as editorial type in the check-in hero (per §3.6).

---

## 4. Concrete visual spec — design tokens

### Colour roles for this surface

| Token | Hex | Use in habits surface |
|---|---|---|
| `--accent` (terracotta) | `#C2683E` | Active streak pip, primary CTA buttons, text-link CTAs, streak-earned badge |
| `--streak-milestone` | `#A3522C` | Milestone pip tint (new token — distinct from `--warning`) |
| `--secondary` (sage) | `#7C8466` | Shield glyph, freeze row icon, sage left-border on recovery/nudge cards, Closest-to-target accent, "Holding" legend |
| `--warning` (amber) | `#C9892C` | RESERVED: over-budget/alerts ONLY. Not used in this surface except for the calorie ring over-budget state (ring-specific override) |
| `--success` | `#5E7C5A` | Goal-hit win-moment context line, weight-down delta directional cue |
| `--foreground` (warm-ink) | `#1B1814` | All body text, Fraunces numerals, stat values |
| `--muted-foreground` | `#9B9590` | Labels, sub-text, dates, "warm-grey" throughout |
| `--card` | `#F6F5F2` | Inset tiles, nudge cards, how-it-works rows |
| `--border` | `#ECEAE4` | Hairline borders on all cards |
| White base | `#FFFFFF` | Card backgrounds, dialog/sheet backgrounds |

**Amber is NOT used for:** milestone streaks, freeze counts, missed-yesterday banner, nudge cards, or any habits-surface celebration. Amber is over-budget/alert only.

### Type roles

| Role | Font | Size | Weight | Use |
|---|---|---|---|---|
| Display / hero headline | Fraunces | 28–32pt | Bold | Modal/screen headlines ("30 days of logging.", check-in headline) |
| Editorial numerals | Fraunces | 20–28pt | Bold | Streak count in insight card, stat tiles, avg kcal, longest streak |
| Section sub-header | Fraunces | 18–22pt | Bold | Recap headline (`resolveDigestHeadline`) |
| Italic label | Fraunces | 16–18pt | Italic | Closest-to-target day name, win-moment context line |
| Body / data | Inter | 13–15pt | Regular | Narrative sentences, why-line, body of all cards |
| Label / meta | Inter | 11–12pt | Regular | Sub-labels, date ranges, tile labels, queue indicators |
| CTA primary | Inter | 15pt | Semi-bold | Filled button labels |
| CTA secondary | Inter | 14pt | Regular | Outlined button labels |
| CTA tertiary / text-link | Inter | 13pt | Regular | Dismiss / "Ask me next week" / share links — terracotta for action links, warm-grey for dismissals |

### Spacing and radius

- Card outer radius: 12–16pt (16pt for hero cards / modals; 12pt for inline insight cards)
- Card inset tile radius: 8pt
- Card horizontal padding: 16pt
- Card vertical padding: 16pt outer, 12pt between rows
- Stack gap between Today cards (streak insight, missed-yesterday, nudge): 8pt
- Bottom sheet handle: 4×32pt rounded rect, warm-grey 30%, centred 8pt below top edge

### Imagery rule (critical — per locked direction)

- **Finished-dish photographs** (check-in hero card, `/weekly-recap` hero, 30-day milestone if imagery is used): hyperrealistic editorial style — natural/moody light, ceramic bowls, linen, wooden boards, shallow depth of field. @thelittleplantation / @_foodstories_ reference. Never flat stock, never watercolour.
- **Celebration states** (30-day milestone hero block, milestone pip): colour-field gradient — NOT photography. The terracotta gradient is the celebration, not an image.
- **Ingredient single-subject images**: unchanged — existing stylised-photoreal white-background egg/blueberry style. Do not mix with meal photography.
- **No mascots, no cartoon characters** anywhere in this surface.

### Motion and haptics

- Win-moment Lottie: keep as-is. Duration and keyframe unchanged.
- Loud `Heavy` impact haptic: win-moment Lottie beat only.
- Quiet `Light` impact haptic (<100ms): every ordinary `confirmLog()`. Flag: `redesign_motion`.
- Sheet open/close: `spring` timing, `damping: 20, stiffness: 300`. Not a linear slide.
- No bounce animations on streak numbers (no "ticking up" counter animation). Numbers appear at the correct value. Animation on a streak count is a gamification register.
- Missed-yesterday banner: fade-in only, no slide. 200ms, `easeOut`.

---

## 5. Accessibility requirements

- All colour-encoded states (streak active, milestone, freeze-protected, over-budget, missed-yesterday) must have a non-colour equivalent: glyph, label, or `accessibilityLabel`.
- `StreakPip` accessible label: "{n}-day logging streak" / "Streak protected by freeze" / "Start your streak".
- Win-moment overlay: `accessibilityViewIsModal={true}`. Announce via `AccessibilityInfo.announceForAccessibility("{milestone} logged.")`— non-visual screen reader users hear a brief announcement.
- 30-day milestone modal: focus trapped. First focus goes to the Fraunces headline.
- Missed-yesterday banner: `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`.
- Colour contrast: Fraunces white 28pt on the terracotta gradient hero meets WCAG 2.1 AA for large text. White Inter 14pt on the 50% dark overlay (check-in hero photograph) must achieve ≥4.5:1 — the overlay darkness level should be adjusted until this is met per screen.
- "How freezes work" sheet: full VoiceOver / TalkBack accessibility (all rows readable in sequence, dismiss button reachable).

---

## 6. Web vs mobile — confirmed divergences (do not fix in redesign)

| Item | Mobile | Web | Status |
|---|---|---|---|
| StreakPip tap | `/weekly-recap` | Display-only | Intentional — no `/weekly-recap` web route |
| Weekly check-in entry | Banner → screen | In-Today dialog | Intentional — web dialog covers the need |
| Goal-pace re-tune | Dedicated sheet | Settings → Targets | Intentional |
| `/weekly-recap` dedicated screen | Yes | No | Intentional — Progress Digest card is web equivalent |
| Onboarding nudge queue | Yes | No | Intentional — HealthKit-native; no Today nudge surface on web |
| "How freezes work" sheet | Bottom sheet | Popover/tooltip | Platform-native idiom difference, same content |

---

## 7. Flag gates

| Component | Flag | Scope |
|---|---|---|
| StreakPip glyph change + milestone token | `habits_redesign_v2` | Visual — must be flagged |
| TodayStreakInsightCard editorial hierarchy | `habits_redesign_v2` | Visual — must be flagged |
| "How freezes work" sheet | `habits_redesign_v2` | New UI — must be flagged |
| Missed-yesterday banner sage left-border | `habits_redesign_v2` | Visual — must be flagged |
| Check-in hero card with photograph | `habits_redesign_v2` | Visual/structural — must be flagged |
| 30-day milestone modal terracotta gradient hero | `habits_redesign_v2` | Visual — must be flagged |
| Win-moment context line | none — unconditional | `redesign_winmoment` collapsed permanently-on (ENG-1651); no flag remains to extend |
| Haptics two-tier | `redesign_motion` | Already gated — no change needed |
| Digest card Fraunces headline hierarchy | `habits_redesign_v2` | Visual — must be flagged |

All new visual/structural changes ship behind `habits_redesign_v2` per CLAUDE.md non-negotiable rule. Old path stays alive in the `else` branch until the flag holds 100% for two weeks with no regression.

---

## 8. FUNCTIONALITY PRESERVED checklist

Every feature, data point, chart layer, gating rule, and copy guardrail from the functional inventory (Input A) is accounted for below. Nothing is removed, hidden, gated, or simplified.

### Engines and math

- [x] `computeLoggingStreak` — grace window (not-yet-logged today walks from yesterday) preserved
- [x] `computeWeekLoggedDays` — Mon–Sun, ≥1 meal, surfaced as 7-pill mini week-strip
- [x] `computeProtectedStreak` — raw streak never mutated; protected streak derived; MAX_WALK 2000 cap preserved
- [x] `availableFreezes` — `earnedAt.length − usedHistory.length`, clamped `[0, budgetMax]`, preserved
- [x] `earnFreezeIfMilestone` — every multiple of 7, `0→7` earns one not seven, preserved; surfaced as "next freeze at day N"
- [x] `dropOldFreezesForMonth` — 90-day trim on earnedAt; `usedHistory` never dropped; trim events not surfaced to users (correct)
- [x] `readFreezeLedger` — defensive JSON parser, preserved
- [x] `streak_freeze_budget_max` default 3 — free for all, no Pro gate. Redesign adds zero paywall language. Confirmed.
- [x] `computeLongestStreak` — all-time longest consecutive run; surfaced in 30-day milestone tile
- [x] Milestone label set `[7,14,21,30,60,90,100,365]` — all labels preserved, new `--streak-milestone` token replaces amber collision
- [x] Win-moment landmark set `[3,7,30,100]` for streak kind — preserved
- [x] `GOAL_HIT_MIN_FRACTION = 0.85` and `MACRO_HIT_MIN_FRACTION` / `MAX_FRACTION` — preserved; once-per-calendar-day gate preserved
- [x] `detectWinMoment` rising-edge only — preserved; `kind` surfaced in new context line
- [x] `MILESTONE_30_DAY_THRESHOLD = 30` distinct days (NOT consecutive) — preserved
- [x] `shouldShowMilestone30Day` — fires once ever; `milestone_30_shown_at` suppresses permanently — preserved
- [x] `buildMilestone30DayContent` — all four stats (avgDailyKcal, longestStreak, topFoods ≤3, totalWeightDeltaKg) preserved; `isHealthImportFallbackTitle` filter preserved; `null`-not-"+0.0 kg" rule preserved
- [x] `buildWeeklyCheckin` — three kinds `first_week`/`low_confidence`/`ready`; `MIN_WEIGHT_DATAPOINTS_FOR_CONFIDENCE = 3`; `TDEE_NOISE_FLOOR_KCAL = 20`; F-129 high-confidence carve-out — all preserved; surfaced as three distinct visual states
- [x] `buildWhyLine` — full branch matrix preserved; rendered as editorial coaching paragraph in hero overlay
- [x] `shouldShowWeeklyCheckin` — confidence ≥ medium; finite/positive TDEE; `daysLoggedThisWeek ≥ 5`; 6-day cooldown — preserved; decision tri-state `accepted`/`kept_current`/`dismissed` preserved
- [x] `suggestedTarget = currentTarget + tdeeDelta`, floored at 1200 kcal — preserved; surfaced in primary button label
- [x] `floorAppliedKcal` (F-157) — preserved; rendered as prominent sage-tinted info row before action buttons (never buried)
- [x] `buildWeeklyRecap` — all fields: daysLogged, avgCalories/avgProtein/avgFiberG (averaged over days-with-food not 7), proteinAdherencePct/fiberAdherencePct, avgHydrationMl, hydrationDaysOnTarget, streakLength (protected), freezesAvailable, bestDay/selectClosestToTargetDay, weightDeltaKg/First/Last, dayTargetOverrides honoured — all preserved
- [x] Usual-meals growth-loop line (`buildUsualMealRecapInsight`) — preserved; surfaces in recap section
- [x] `resolveDigestHeadline` — first-match cascade preserved; rendered as Fraunces 22pt dominant headline
- [x] `digestStory.ts` narrative sentences — preserved; calorie/protein/closest-day sentences rendered as body text below headline; day-of-week pattern line rendered with icon + distinct section
- [x] `weeklyDigestSuggestion.ts` 5-rule cascade — preserved; `DigestSuggestionTier` forward-compat type preserved; zero active Pro rules confirmed — no Pro gate added
- [x] `belowMealsPromptSelection.ts` priority order `checkin > northStar > snap > nudge`; `BELOW_MEALS_PROMPT_MAX = 2` — preserved
- [x] `missedYesterday.ts` rules — today-only, prior history, yesterday count 0, not first day of week — preserved; no CTA added; copy unchanged
- [x] Onboarding nudge catalogue — `import` (libraryCount < 3, 7d cooldown), `recipes` (< 5, 14d cooldown), `permissions` (lifetimeMealCount ≥ 3, undetermined, 7d, removeOnAction) — all preserved
- [x] `weeklyRecap.shouldShowRecap` — Sat≥18:00/Sun/Mon/Tue timing gates preserved
- [x] Push route `app/api/push/weekly-recap/route.ts` — dual-rail Expo+VAPID, per-user dedupe <6 days, 5000 row cap, `DeviceNotRegistered` null-token, dead web-push endpoint delete — all preserved; no visual surface change
- [x] `profiles.weekly_recap_push_enabled` toggle — preserved
- [x] `streak_freezes_earned_at`/`streak_freezes_used_history`/`streak_freeze_budget_max` schema — preserved; no migration needed for redesign

### Analytics events

- [x] `streak_freeze_used` (`{dateKey, freezesRemaining}`) — preserved
- [x] `streak_freeze_earned` — preserved
- [x] `streak_freeze_earned_seen`/`_acknowledged` — preserved (one being retired per spec; redesign does not remove either)
- [x] `streak_reset` — preserved
- [x] `day_target_hit_win_moment_shown` (`{kind, milestone?, platform}`) — preserved; `kind` now also surfaced in context line
- [x] `weight_new_low_win_moment_shown` — preserved (distinct from goal-hit event)
- [x] `milestone_30_shown`/`_dismissed` (`{daysLogged, longestStreak, topFoodCount, surface:"progress"}`) — preserved
- [x] `weekly_recap_shown`/`_dismissed`/`_shared`/`_save_prompt_tapped` — preserved
- [x] Full push funnel events — preserved
- [x] `weekly_checkin_viewed`/`_shown`/`_accepted`/`_dismissed`/`_banner_dismissed`/`_banner_tapped` — preserved

### Copy guardrails

- [x] `FORBIDDEN_TODAY_PHRASES` — "below maint/TDEE", "under/over budget", "you went over", "don't break your streak", "streak lost", "broke your streak", "Today's meals" — none appear in any redesigned copy
- [x] No "!" in recap/check-in copy
- [x] No "crushed it"/"amazing"
- [x] No 🔥/confetti glyphs
- [x] No streak-anxiety copy
- [x] Past days = past tense
- [x] Freezes = "freezes available", never "currency"
- [x] 30-day modal = "no paywall, no upsell" — confirmed; "Keep going" CTA only

### Gating and Free/Pro

- [x] Streak: free ✓
- [x] Freezes (budget 3): free for all, no Pro gate ✓
- [x] Milestones: free ✓
- [x] Win-moments: free ✓
- [x] Missed-yesterday: free ✓
- [x] Weekly check-in: free ✓
- [x] Recap/Digest: free ✓
- [x] Nudges: free ✓
- [x] 30-day milestone: free, no upsell ✓
- [x] `DigestSuggestionTier` — forward-compat type preserved; zero active Pro rules; no Pro-gated suggestion added in redesign ✓

### Charts

- [x] Weight trend chart: trend line + confidence band + raw scatter dots + average/delta header + scrubable tooltip + range toggles (1W/1M/3M/6M/1Y/All, greyed when insufficient data) + goal hairline + "Updating/Holding" legend ✓
- [x] Forecast-line-only (Noom/Yazio style): explicitly rejected ✓
- [x] Mini week-strip (7-cell logged/not-logged): preserved in recap section and `/weekly-recap` screen ✓

### Platform carve-outs

- [x] StreakPip tap → `/weekly-recap`: mobile only, preserved
- [x] Web pip display-only: preserved (tooltip added; no navigation)
- [x] `/weekly-recap` screen: mobile only, preserved
- [x] Weekly check-in banner: mobile only, preserved
- [x] Check-in dialog: web only, preserved
- [x] Goal-pace re-tune sheet: mobile only, preserved
- [x] Onboarding nudge queue: mobile only, preserved
- [x] Web check-in entry via in-Today dialog: preserved

### Known open items (carried forward, not introduced by redesign)

- ENG-798: dedicated macro win-moment Lottie. Redesign adds the context line for macro-hit kind using the existing goal-hit Lottie; dedicated animation is the ENG-798 scope.
- SEE-don't-orchestrate caveat: this spec is code-grounded but pixel validation (live `/weekly-recap`, StreakPip, freeze, milestone on-device captures) is required before sign-off on implementation. See `feedback_see_dont_orchestrate.md`.

---

## 9. Pre-implementation checklist

Before any implementation begins:

1. Capture `/weekly-recap` screen on device (current state) — Maestro or manual.
2. Capture StreakPip states: active, milestone (day 7+), freeze-protected, 0-day.
3. Capture 30-day milestone modal on device.
4. Capture TodayStreakInsightCard with freezes available vs 0.
5. Diff against this spec. Flag any divergence before coding.
6. Ship all visual changes behind `habits_redesign_v2` feature flag.
7. Keep `redesign_motion` as a separate granular flag. (`redesign_winmoment` no longer exists — collapsed permanently-on, ENG-1651.)
8. Introduce `--streak-milestone` design token in the token file before any tint change.
9. Run `tests/unit/streakPipMilestone.test.ts` and `tests/unit/streakInsightCopy.test.ts` after any pip or insight-card changes — these must pass unchanged (the logic is not changing; only the visual chrome).
10. Validate amber is absent from all habits-surface components after implementation (grep for `--warning` / `Accent.warning` in the affected files).
