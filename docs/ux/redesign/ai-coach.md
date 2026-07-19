# AI Coach / Insights Engine — Best-in-class Redesign Spec

**Surface:** Deterministic coaching, narrative insights, North-Star suggestion, progress commentary, digest, trajectory forecast, inline today insights, fasting narrative
**Platforms:** iOS primary (mobile), web parity
**Date:** 2026-06-02
**Status:** ⚠️ SUPERSEDED (2026-07-19) — see banner below. Originally "Spec — not yet implemented" (2026-06-02).

---

## ⚠️ SUPERSEDED — READ THIS BEFORE ANYTHING BELOW

**This doc's central claim is no longer true.** Section 0 states *"There is no
AI chat, no 'Ask' tab, no LLM-backed coach in Suppr"* and §3.12 explicitly
instructs *"Do not build the bounded Ask surface until the product explicitly
greenlights it."* Both statements were accurate on 2026-06-02. They are false
today.

**What shipped:** on 2026-07-01, Suppr shipped exactly the surface §3.12
said not to build yet: a standalone `/coach` destination screen with an
LLM-voiced day narrative ("Today's read") plus three LLM-answered bounded Ask
chips ("Ask the coach"), sitting alongside a ranked "What to eat next" list.
It is bounded, not free-text/open-conversation — every LLM output is
number-grounded and validated against the app's own computed facts, so the
"never invents a number" trust gate this spec cared about is preserved — but
the flat claim "there is no LLM-backed coach in Suppr" is no longer accurate,
and the "do not build" instruction in §3.12 has been overtaken by a shipped
feature.

**Rollout:** the Coach screen is default-on for both web and mobile, gated
only by a PostHog kill switch rather than a staged ramp — it ships to
everyone today, not a subset. (In code, the gate is the `coach_screen_v1`
flag, which sits inside the broader `REDESIGN_DEFAULT_ON` default.)

**Canonical doc for the shipped Coach screen:**
[`docs/journeys/what-to-eat-next.md`](../../journeys/what-to-eat-next.md) —
Part 2, "The full Coach destination screen". Read that doc for what is
actually live today (entry points, the three sections, grounding contract,
known web/mobile parity defects, analytics).

**What is still true / still useful here:** the deterministic North-Star
"what to eat next" engine described in §3.1 (card layout, band chips, states,
preserve-exactly rules) is largely accurate to what shipped in the Today
block, and the visual-craft reasoning throughout this doc (typography roles,
card grammar, benchmark rationale) remains a legitimate historical record of
the original constraint-driven design thinking. **Do not treat any claim
about "no AI coach exists" or "the Ask surface is unbuilt" as current** —
those two claims, and only those, are the parts this banner supersedes.
Everything else in the body below should be cross-checked against
`docs/journeys/what-to-eat-next.md` before being relied on for anything
shipping today.

---

## 0. Critical framing — read before anything else

> **⚠ Superseded — see banner above.** The paragraph immediately below was
> accurate on 2026-06-02 and is **false as of 2026-07-01**, when Suppr
> shipped a bounded, LLM-voiced Coach surface. Kept verbatim below as
> historical record only — do not cite it as current.

**There is no AI chat, no "Ask" tab, no LLM-backed coach in Suppr.** The four-tab bar is Today / Plan / Recipes / Progress. Every `ai*` route in the codebase is extraction-only (photo→food, voice→food, label→nutrition, recipe-import). None generates advice, conversation, or coaching.

What this spec calls "AI Coach / Insights" is a **distributed, deterministic, rules-based narrative and suggestion engine** spanning five pillars across Today and Progress. The entire engine is a trust differentiator: it never invents a number, always hedges uncertain estimates, shows confidence explicitly, and suppresses output rather than fabricate when data is absent.

The redesign task is:
1. Elevate the visual and typographic presentation of every insight surface to best-in-class without dropping a single data point, suppression rule, or honesty gate.
2. Unify the scattered insight grammar into a coherent visual language ("insight card" system) that reads as one intelligent coaching layer even though it is deterministic under the hood.
3. Define how a potential net-new bounded "Ask" surface could ship without violating the "never invents a number" guarantee — as a design spec only, not a commitment to build.

**Hard gate:** if any redesign decision removes, hides, simplifies, or weakens any feature, data point, suppression rule, confidence signal, or honesty footnote, it fails automatically.

---

## 1. Surface overview

### Purpose

The coaching/insight layer answers the questions a thoughtful human nutritionist would answer after reviewing a week of logs:
- "Of everything I cook, what should I eat now?" (North-Star, Today)
- "What is my actual maintenance calorie burn?" (adaptive TDEE, Progress)
- "How did last week go?" (Digest, Progress)
- "Where am I headed?" (Trajectory, Progress)
- "How am I doing right now today?" (Deficit + Activity Bonus inline, Today)
- "What one change would help most this week?" (Suggestion cascade, Digest)
- "What is happening in my body during this fast?" (Fasting narrative, Fasting screen)

The engine answers these with the user's own logged data and stated goals. It does not speculate, hallucinate, or generate beyond the rules it was given.

### Role in the product

- **Today tab anchor (pillar 1, 4):** North-Star "What to eat next" is the second element after the calorie ring — the "what to do now" answer. Deficit + Activity Bonus are the "how am I doing now" answers.
- **Progress tab storytelling (pillars 2, 3):** ProgressHeadline + DigestStoryCard + TrajectoryCard + Digest form the complete weekly story. They must not be collapsed.
- **Sunday push (pillar 3):** the week's key figure delivered to the lock screen.
- **Fasting screen companion (pillar 5):** body-stage narrative under the fasting ring.
- **Trust differentiation:** every competitor (MFP, MacroFactor, Cal AI, Noom) either shows no reasoning or shows confident reasoning. Suppr shows hedged-but-specific reasoning — this is the differentiator that survives any visual refresh.

### Navigation map (mobile)

```
Today tab
  ├── North-Star block (NorthStarBlock.tsx) — slot 2, permanent
  ├── TodayDeficitInsight banner — conditional (logged + deficit + above noise floor)
  └── TodayActivityBonusCard — conditional (burn data present)

Progress tab
  ├── ProgressHeadline ("THIS WEEK") — adaptive-TDEE regime narrative
  ├── DigestStoryCard ("WEEK DIGEST") — always visible
  ├── TrajectoryCard ("PROJECTED WEIGHT") — ≥5 food-logged days
  └── Digest / DigestBlended — Sat 18:00 → Tue, dismissible per week

Fasting screen (/fasting.tsx)
  └── Fasting-stage narrative — under the ring

Standalone sheets (no direct tab)
  └── Sunday push → lock screen
```

### Navigation map (web)

```
/account (Today dashboard)
  ├── north-star-block.tsx — slot 2, permanent
  ├── TodayWeeklyInsightCard — desktop right-rail only (intentional carve-out, no mobile equiv)
  └── Deficit banner — parity to be confirmed (see gap §8.3)

/account/progress (Progress dashboard)
  ├── progress-headline.tsx
  ├── digest-story-card.tsx
  ├── trajectory-card.tsx
  └── digest.tsx / digest-blended.tsx
```

---

## 2. Current design audit — weaknesses by pillar

### 2.1 North-Star block

**Current weaknesses:**
- The why-line ("Fits your remaining 42g protein") is typeset at the same weight as the recipe title — the hierarchy between "what" (recipe) and "why" (reason) is flat.
- The fit-band chip (`tight / close / loose`) uses generic badge styling with no clear connection to the calorie ring's 3-state grammar. A user who has learned the ring colours doesn't carry that vocabulary to the chip.
- The macro caption below the recipe thumb (e.g., "420 kcal · P 38g · C 28g · F 14g") is in a compact sans that competes with the title rather than supporting it.
- The skip (×) affordance on web is a small icon with no label — users don't know they can skip to a next-best suggestion.
- State variation is handled by conditional rendering of the same card chrome. Empty states (new-user, no-fit, over-budget) inherit the card's full border/shadow treatment when they don't need it — they read as broken cards, not intentional states.
- The recipe thumbnail is a square crop that shows no food quality signal — the edit-photo-style crop flattens editorial appeal.

### 2.2 ProgressHeadline (adaptive-TDEE narrative)

**Current weaknesses:**
- The `ConfidenceChip` is rendered after the narrative text, not before. The user reads "Your maintenance held steady at 2,140 kcal" before they see "medium confidence" — the confidence should frame the statement, not post-qualify it.
- The `numerals[]` figures (bolded inline kcal numbers) use the same Inter typeface as the surrounding body. The visual emphasis on the key number is mild; a tabular-nums weight shift alone is not enough to make the number feel load-bearing.
- The three regime labels (`calibrating / adjustment / steady`) are not visible to the user — the chip only shows confidence level. When the engine is in `adjustment` regime, the card is the most valuable thing on screen, but it does not read differently from `steady`.
- The pre-story placeholder (`{N} more days to your first insight` + a ring) uses a subtle ring that does not connect visually to the calorie ring or the DigestStoryCard's logged-days counter — they appear unrelated.

### 2.3 DigestStoryCard

**Current weaknesses:**
- The "{daysLogged}/7 days logged" hero number is the right move but is typeset at the same size as the insight lines — it doesn't anchor the card visually.
- The delta pill (under/over vs target) carries the most actionable signal on the card but sits below the supporting text — it should be closer to the hero number.
- The closest-day line and day-of-week pattern line appear in the same visual register as the calories and protein lines. Priority is unclear; scanning the card reveals no hierarchy between "what happened" and "pattern explanation."
- On mobile, the italic insight line wraps inconsistently when the day-of-week pattern line is long — the italic text overruns the card padding on narrow devices.

### 2.4 TrajectoryCard

**Current weaknesses:**
- The forecast is expressed as "{kg} in ~{N} weeks" in a single sentence. The Bevel comparable shows that even a simple projection gains trust from a visible method line and a trend sparkline — the current text-only expression reads as a guess, not an estimate.
- The basis line ("last 7 days averaged {X} kcal/day vs {Y} target") is present but typeset at caption size, making it easy to miss — it is the most important trust signal on the card.
- The placeholder state (`{N} more days to see your trajectory`) uses a progress bar but offers no visual continuity with the projection card it will become. The bar has no context: a user doesn't know what the bar is counting toward.
- The footnote "Based on 7,700 kcal ≈ 1 kg. An estimate, not a promise." is present but occupies the most visually dismissed position (bottom, caption, muted) — given that this is the most legally and tonally important sentence on the card, it deserves better typographic treatment.

### 2.5 Digest / DigestBlended

**Current weaknesses:**
- The 2×2 stat grid (Streak, Avg calories, Avg protein, Weight Δ) uses uniform tile treatment. The tiles carrying contextual narrative (the closest-day sentence, the "usual meal" prompt) compete for space with the grid and frequently push below the fold on smaller devices.
- The Share action is a text button — on iOS this conflicts with the system Share Sheet idiom, and the share event is one of the most valuable activation signals in the product.
- The dismiss "Got it" reads as low-investment. The Digest is the one place in the product where a user has a natural prompt to reflect — the dismiss affordance should feel intentional, not apologetic.
- `shouldShowRecap` fires Sat 18:00 → Tue — the card appears at the bottom of the Progress scroll and is easily missed on Sunday morning. There is no visual signal at the top of the tab indicating the recap is available.

### 2.6 Week Digest suggestion cascade

**Current weaknesses:**
- The cascade renders inside the Digest card with no visual hierarchy above the stat grid. The single highest-leverage recommendation of the week sits below a fold that users may never reach.
- The "Nothing to change this week. Your numbers held." null state is the right restraint but is rendered in the same secondary text style as the body of a suggestion — it reads the same as "no data" rather than "excellent, nothing to fix."
- The CTA button in each suggestion is a tertiary-style text link. Given that these suggestions drive meaningful user actions (saving a meal, confirming a target change), the CTA needs a more deliberate tap target.

### 2.7 TodayDeficitInsight banner

**Current weaknesses:**
- The banner uses an inline text format with no visual container — it blends into the Today scroll and is easy to overlook between the North-Star block and the meal log.
- The sub-line ("Week avg: ~{N} kcal/day") uses identical styling to the primary line — the distinction between today's figure and the weekly average is not apparent at a glance.

### 2.8 TodayActivityBonusCard

**Current weaknesses:**
- The basal / activity / workout breakdown is accurate but typographically dense — three numeric rows with no visual hierarchy between "base burn" (always present) and "activity earned" (the meaningful delta).
- The "Maintenance" tile + TDEE popover is the most analytically valuable element on the card but is reachable only via a tap on the tile label — users who don't know it exists will never find it.
- `weekDeficitToKg` kg-equivalent is shown at the bottom of the card in caption text. This is the one place in the Today tab where the user can see their energy-balance week at a glance, and it is hidden below the fold of the card's natural scroll position.

### 2.9 Fasting-stage narrative

**Current weaknesses:**
- The time-bucketed copy appears below the ring with no typographic distinction from general body copy — it reads as a footnote rather than the primary informational content of the screen.
- The hedged qualifiers ("may", "often", "typically") are the legally and tonally correct approach, but their typographic treatment does not reinforce the hedge — they could be read as confident claims by a user skimming.

### 2.10 Win-moment

**Current weaknesses:**
- The win-moment copy line sits in the Today feed with no distinctive visual treatment — it is easy to scroll past.

---

## 3. Component-by-component redesign

### 3.1 North-Star "What to eat next" block

#### Purpose
Single-recipe suggestion: of all saved recipes, which fits the remaining calories and macros best right now?

#### Benchmark
Oura Readiness card (https://mobbin.com/screens/c1a31cec-0c1c-4fb5-9408-4fe8ad8baf80) — verb-led headline + single explanatory paragraph + one action; Flo daily insights carousel (https://mobbin.com/screens/76915719-aae9-4f30-bf14-72be9dd7f474) — "one strong card now, next available on skip" pattern.

#### Proposed redesign

**Card chrome:**
- White surface (`#FFFFFF`), 1px hairline border (`#ECEAE4`), `border-radius: 16px`, soft shadow (`0 1px 4px rgba(27,24,20,0.06)`).
- No gradient fill — the recipe thumbnail provides the visual warmth.

**Layout (active suggestion state):**
```
[Thumbnail — 80×80 rounded-12 left-flush]   [slot label "DINNER" — uppercase caption, muted sage]
[Recipe name — Fraunces Semibold 17px, 2-line clamp, ink #1B1814]
[Why-line — Inter Regular 13px, muted (#7C8466), e.g. "Fits your remaining 42g protein"]
[Band chip + Macro row]
[CTA button (terracotta, full-width on mobile)]
```

**Fit-band chip:** pill with terracotta fill at 12% opacity, terracotta text (`#C2683E`), 11px Inter Semibold uppercase. Labels: `HITS WITHIN 3%` / `CLOSE FIT` / `ROUGHLY FITS`. Tight band gets an additional 1px terracotta border to distinguish from close. This visually connects to the terracotta CTA, forming one coherent "action system."

**Why-line typography:** Inter Regular 13px, muted sage `#7C8466` — always one line (truncate at 60 chars). Precedes the band chip, not follows it, so the user reads reason → confidence → action.

**Macro row:** Inter Regular 12px, tabular-nums, muted `#9E9A94`. Format: `{N} kcal · P {g}g · C {g}g · F {g}g`. Sits below the band chip, smallest visual weight on the card.

**Skip affordance (×):** top-right of card, 28×28 touch target, × glyph in `#9E9A94`. Label appears on first-ever skip: "See another?" tooltip (dismissed after one session). Aria-label: "Skip suggestion". Swipe-left on mobile also triggers skip (reduce-motion fallback: tap only). On first skip, the tooltip teaches the next-best behaviour.

**CTA button:** full-width terracotta `#C2683E`, white label, Inter Semibold 15px, 48px height, `border-radius: 12px`. Slot-aware label: "Log breakfast" / "Log lunch" / "Cook ahead" / "Cook it" / "Log it".

**"Why this suggestion?" tap target (web):** tap the why-line → opens a bottom sheet (mobile) / tooltip popover (web, 280px width) showing: why-line (larger), predicted macros vs remaining, band explanation ("Within 3% of your remaining calories at this portion."), portion multiplier used. This sheet is the transparency layer — it exists to show the user the engine's reasoning, not to sell the suggestion.

**Thumbnail:** 80×80px, `border-radius: 12px`, `object-fit: cover`. If recipe has no image, render a warm terracotta monogram tile (recipe initial, Fraunces, white on `#C2683E` at 60% opacity). Never a broken image state.

**Empty / special states:**

| State | Trigger | Visual treatment |
|---|---|---|
| `new-user` | zero meals logged | No card chrome. One line: Fraunces Italic 16px "Log your first meal — suggestions get smarter once we've seen you eat." with a → nudge toward the log sheet. |
| `library-empty` | < threshold recipes | Terracotta bordered card, sage body copy, "Browse Recipes" tertiary CTA in sage. |
| `no-fit` | nothing fits remaining macros | Same card chrome, no thumbnail. Copy: "Nothing in your library fits under {N} kcal. Browse for something lighter?" + "Browse" CTA. |
| `over-budget` | remaining calories ≤ 0 | Amber `#C9892C` tinted card (5% fill), amber hairline border. Copy: "You've hit your calories for today — eat freely, or save for tomorrow." No CTA. No recipe card. |

**Preserve exactly:**
- `NORTH_STAR_LIBRARY_MIN = 5`, relaxed to 2 during `NORTH_STAR_ACTIVATION_WINDOW_DAYS = 30`.
- Portion multipliers clamped to `{0.5, 1.0, 1.5, 2.0}`.
- Asymmetric calorie penalty: over × 3, under × 1.5.
- Band thresholds: tight ≤ 5%, close ≤ 15%, loose > 15%. Chip says "3%" — intentional, pinned.
- Slot windows and CTA map exactly as specified.
- Why-line 3-rule priority: protein+calorie → protein → calorie fallback.
- Skip → `pickNextNorthStarSuggestion(..., excludeIds)`.

**Motion:**
- Skip: card slides out left at 200ms ease-out, next card fades in. Reduce-motion: instant swap.
- CTA tap: 80ms scale(0.97) press, haptic `impactLight` (mobile).

**Accessibility:**
- Card announced as: "Suggestion: [recipe name], [why-line], [band label], [CTA label]."
- Skip button: accessible label "Skip this suggestion."
- VoiceOver focus order: recipe name → why-line → band chip → macro row → CTA → skip.

**User benefit:** clear action, clear reason, clear fit signal — the one answer to "what should I eat now" that no competitor delivers with this specificity.

---

### 3.2 ProgressHeadline (adaptive-TDEE narrative)

#### Purpose
Weekly adaptive TDEE story in one of three regimes: calibrating / adjustment / steady. Carries `ConfidenceChip` and bolded numerals.

#### Benchmark
Opal weekly story ("Your most productive day was Thursday") — https://mobbin.com/screens/ac63bdf2-84b7-4d57-9f52-f92176b5433b — inline-coloured key numerals inside a flowing sentence; Oura readiness narrative (https://mobbin.com/screens/e2d94334-c086-4427-8a8c-6f76a9ac0c7a) — number then paragraph, confidence implied by tone.

#### Proposed redesign

**Section label:** `THIS WEEK` in 10px Inter Semibold uppercase, `#9E9A94`, `letter-spacing: 0.08em`. Full-width separator hairline above.

**ConfidenceChip — repositioned:** sits BEFORE the headline sentence (left-flush, top of card), not after. The chip frames the statement: the user sees "medium confidence" before reading the number. Chip design: rounded pill, 10px Inter Semibold uppercase, coloured background at 12% opacity.

| Confidence | Text | Colour |
|---|---|---|
| low | ESTIMATING | amber `#C9892C` |
| medium | LEARNING | sage `#7C8466` |
| high | CONFIDENT | success green `#5E7C5A` |

**Headline sentence:** Fraunces Regular 20px, `#1B1814`, line-height 1.3. The `numerals[]` figures are set in Fraunces Semibold 20px with tabular-nums — same typeface but heavier weight, so the number feels load-bearing inside the sentence without a colour change.

Example: "Your maintenance **held steady at 2,140 kcal** this week."

**Regime visual distinction:**
- `steady`: headline in standard ink, chip CONFIDENT/LEARNING.
- `adjustment`: headline in standard ink + a small inline delta badge ("+80 kcal ↑" or "−40 kcal ↓") in sage/amber respectively, immediately after the adjusted figure. This makes the `adjustment` regime visually distinct from `steady` without requiring the user to know the regime vocabulary.
- `calibrating`: headline in `#7C8466` (muted), chip ESTIMATING. The muted colour signals "this is an early estimate" without requiring any text explanation.

**Pre-story placeholder:** when < `STORY_DATA_FLOOR_DAYS` (3) logged days, render a single card with a progress arc (matching the calorie ring's track grammar, not a bar) showing `loggedDays/3` fill, labelled "{N} more days to your first insight." in Fraunces Italic 16px. Arc colour: sage `#7C8466` at 40% for track, 100% for fill.

**States:** all three regimes + placeholder + null (renders nothing when no data at all).

**Preserve exactly:**
- Three regimes, regime selection logic, all copy rules.
- `ConfidenceChip` and `numerals[]` — visual treatment changed, data unchanged.
- `buildProgressStoryPlaceholder` floor at 3 days.
- Early-estimate hedge in calibrating copy.

---

### 3.3 DigestStoryCard ("WEEK DIGEST")

#### Purpose
Always-visible weekly story: days logged, calorie delta vs target, protein adherence, closest day, day-of-week pattern.

#### Benchmark
Opal ("Your most productive day was Thursday with 29m") — https://mobbin.com/screens/ac63bdf2-84b7-4d57-9f52-f92176b5433b — clean inline-numeral sentence, key figures differentiated typographically. MFP Weekly Digest (https://mobbin.com/screens/8dce255f-648b-4a32-92f4-9cba7467236a) — scannable recap layout (borrow the layout, discard the descriptive-only approach).

#### Proposed redesign

**Hero row:**
```
[Fraunces Semibold 32px] {N}/7     [Delta pill — right-flush]
[Inter Regular 13px muted] days logged
```

The "{N}/7" is the biggest number on the card. Fraunces at 32px anchors the card's visual hierarchy. The `/7` is Fraunces Regular 32px in `#9E9A94` — same size, muted, so the logged count reads first.

**Delta pill:** immediately right-flush to the hero row (top-right corner, vertically centred with the number). Rounded pill, 11px Inter Semibold. Colour: success green fill (under target), destructive red fill (over target), `#F6F5F2` neutral fill with ink text (within ±max(40, 4%)). Text: "+240 kcal" / "−180 kcal" / "~on target". This is `classifyDigestHeroTone` — preserve exactly.

**Supporting lines:** Inter Regular 14px, `#1B1814`, one per line, 4px gap between lines. Lines appear in order: calories → protein → closest day → pattern. Each line that would be false is suppressed (preserve `shouldShowRecap` rules exactly).

**Insight line (italic):** the closest-day or pattern line is set in Fraunces Italic 15px `#7C8466` as the last line — a typographic signal that this is editorial commentary, not a figure. Max 2 lines; truncate with ellipsis.

**Delta-pill colour rule:** uses `classifyDigestHeroTone` — preserve the ±max(40, 4%) neutral band exactly. This is the same rule as the calorie ring's 3-state grammar, reinforcing cross-card consistency.

**Empty state:** "Quiet week — log a meal to start your story." in Fraunces Italic 16px, centred, no card chrome beyond the section label.

**Preserve exactly:**
- All sentence suppression rules.
- `classifyDigestHeroTone` thresholds.
- `STORY_DATA_FLOOR_DAYS` gate.
- Day-of-week pattern suppression (<14 days or delta <200 kcal).

---

### 3.4 TrajectoryCard ("PROJECTED WEIGHT")

#### Purpose
"{kg} in ~{N} weeks" forecast with basis line (7-day avg kcal vs target) and honesty footnote.

#### Benchmark
**Bevel Trends Analysis** (https://mobbin.com/screens/522ddab2-6b35-4dea-889c-a60767f75809 and detail https://mobbin.com/screens/7c9bdd48-f883-4338-b673-cdccb0685a01) — the gold standard: trend vs raw points, projection figure, multiple lookback windows with sparklines, explicit "7-day rolling averages" method disclosure. Noom/YAZIO curves for aesthetic reference only — their false-precision framing is explicitly rejected.

#### Proposed redesign

**Card layout:**
```
[Section label: PROJECTED WEIGHT]
[Hero: Fraunces Semibold 28px] {kg} kg   [Fraunces Regular 16px muted] in ~{N} weeks
[Basis line: Inter Regular 13px sage] "Last 7 days: {X} kcal/day avg vs {Y} target"
[Forecast curve — 160px tall SVG/Skia]
[Honesty footnote — see below]
```

**Forecast curve visual:**
- Horizontal axis: today → projected endpoint (N weeks out), equal spacing.
- Historical segment: thin `#7C8466` line with scatter dots at each weigh-in (`r=3px`, filled terracotta). No fill below the historical line — raw points only, visually honest.
- Projection segment: dashed `#C2683E` line (4px dash, 4px gap), extending from the last weigh-in to the projected endpoint. Soft area fill: `#C2683E` at 6% opacity below the projected line. This borrows Noom/YAZIO's *curve aesthetic* only (the fill warmth) without their false-precision confidence framing.
- Goal weight marker: horizontal dashed hairline in success green `#5E7C5A` with a "Goal" label chip at right edge.
- Projected endpoint: filled terracotta circle (`r=5px`) with the projected weight value in a floating label (Fraunces Regular 14px, white on terracotta pill).
- No x-axis date labels below 320px card width (they collide) — use a "~{N} weeks" label instead.

**Honesty footnote:** rendered at bottom of card in Inter Regular 11px, `#9E9A94`. Content: "Based on 7,700 kcal ≈ 1 kg. An estimate, not a promise." This line is **not** pushed to caption opacity — it uses the same muted colour as supporting labels, not a near-invisible footer grey. It is the most important line on the card and deserves to be read.

**Tap-through (mobile):** tap card → full-screen weight trajectory view (future: Bevel-style multi-window table showing 7/14/28/90-day windows each with mini sparkline and rolling-average disclosure). Spec the entry point now; implement in a follow-up.

**Placeholder state:** "{N} more days to see your trajectory" with a progress arc (same grammar as ProgressHeadline placeholder — visual continuity: both are "earning the next insight" states). Below the arc: Inter Regular 13px sage "A 3-day average swings too much to forecast honestly." — this is the honesty sentence that makes Suppr more trustworthy than any comparable.

**Null state** (no current weight logged): renders nothing. Preserve.

**Preserve exactly:**
- 5 food-logged days gate for projection state.
- `KCAL_PER_KG = 7700` — do not change to 7,500 or 8,000.
- Rolling 7-day avg basis line.
- Placeholder sentence verbatim: "A 3-day average swings too much to forecast honestly."
- Goal marker (null when no goal set — renders nothing, not 0).

---

### 3.5 Digest / DigestBlended (Sunday recap card)

#### Purpose
Weekly recap card (Sat 18:00 → Tue), dismissible per week. 2×2 stat grid + narrative lines + suggestion cascade + share/dismiss.

#### Benchmark
MFP Weekly Digest (https://mobbin.com/screens/8dce255f-648b-4a32-92f4-9cba7467236a) for layout reference; Oura single-insight banner (https://mobbin.com/screens/9606969d-6f33-4cc7-8ef9-33d1f56cebbc) for suggestion framing.

#### Proposed redesign

**Availability indicator:** when `shouldShowRecap` is true, a terracotta dot appears on the Progress tab icon in the bottom nav. This is the only cross-surface signal; the card itself stays on the Progress tab. A "Your week recap is ready" banner (1-line, terracotta hairline border, sage text) pins to the top of the Progress scroll when the card is below the fold. Both are suppressed after dismiss.

**Card header:** Fraunces Semibold 22px, the `resolveDigestHeadline` result (e.g. "Last week: down 0.4 kg." / "Closest to target: Tuesday."). Below: Inter Regular 13px muted, the `weekLabel` ("Jun 26 – Jul 2").

**2×2 stat grid:** four tiles, white surface, `border-radius: 12px`, hairline border. Tile anatomy: 10px Inter Semibold uppercase label in muted sage → 24px Fraunces Semibold value in ink → 12px Inter Regular supporting line in muted. Tiles: Streak / Avg calories / Avg protein + adherence % / Weight Δ. Weight tile respects `weightSurfaceMode` (hidden → swaps to "logging consistency" tile). Preserve exactly.

**Narrative lines:** appear below the grid in Inter Regular 14px `#1B1814`, 6px gap per line. Italic for the celebration/prompt line (same Fraunces Italic 15px treatment as DigestStoryCard insight line). Lines: closest-to-target, first→last weigh-in, maintenance line, usual-meal celebration or prompt. Suppress rules preserved exactly.

**Suggestion cascade module:**
Rendered above the stat grid, not below. It is the highest-priority content in the card — not an afterthought. Visual treatment:
- Terracotta 4px left-border accent on the module container.
- Headline: Fraunces Semibold 17px ink.
- Body: Inter Regular 14px muted.
- CTA: terracotta text button, 44px touch target, right-flush.
- Null state: "Nothing to change this week. Your numbers held." in Fraunces Italic 15px sage — visually distinct from "no data" by using the Fraunces italic (editorial confidence) vs Inter regular (neutral reporting).

**Share action:** iOS Share Sheet / `navigator.share` pattern — rendered as a standard share icon (SF Symbol `square.and.arrow.up` / Lucide `Share2`) with the label "Share week" (not a text-only button). Touch target 44px. Haptic `impactLight`. Event: `weekly_recap_shared`.

**Dismiss:** "Got it" becomes "Done for this week" — Inter Regular 15px, `#7C8466`, centred below the card. Haptic `selectionFeedback`. Event: `weekly_recap_dismissed`.

**Loading state:** skeleton variant of the card layout (hairline shimmer on each element). Not a spinner.

**Error state:** "Couldn't load your recap." in sage italic, with "Try again" terracotta text CTA.

**Offline state:** "Showing last synced data." inline note above the grid in 11px muted.

**Preserve exactly:**
- `shouldShowRecap` window: Sat 18:00 → Tue.
- `weekKeyFor` dismiss-per-week behaviour.
- `resolveDigestHeadline` first-match rules.
- `bestDay` scoring (≥80% macro targets logged, ties → most recent).
- `weightSurfaceMode` tile swap.
- Share + dismiss analytics events.
- `progress_digest_blend` flag gate on DigestBlended variant.

---

### 3.6 Week Digest suggestion cascade (standalone engine)

The cascade is rendered as the lead module inside the Digest card (see §3.5). Additional notes:

**CTA tap target:** never a text link. Always a contained button, 44×44px minimum, terracotta text on white, `border-radius: 8px`, `padding: 8px 16px`. The CTA for `re_log_prompt` ("Save it") and `maintenance_recalibration` ("Review target") perform the most valuable actions in the product — they must not be buried.

**Rule identity (for analytics):** each cascade result renders its `rule` string as a data attribute on the module container for PostHog session replay attribution. Not visible to user.

**Preserve exactly:**
- All 5 rules, strict priority order.
- Null state sentence verbatim: "Nothing to change this week. Your numbers held."
- `tier` field — no Pro-gated suggestions ship; the type exists for future use.
- 120-char headline cap, 200-char body cap, no exclamation marks, no performance adjectives.
- `weekly_digest_suggestion_shown` event with `rule` property.

---

### 3.7 TodayDeficitInsight banner

#### Purpose
"~{N} kcal deficit so far today" with weekly average sub-line.

#### Benchmark
Oura "Rest Mode is on" inline contextual banner (https://mobbin.com/screens/e9b7815f-8a3e-4774-a777-f0b121901b21) — quiet, single-line, doesn't compete with the hero.

#### Proposed redesign

**Container:** full-width, white surface, `border-radius: 12px`, `1px` hairline border `#ECEAE4`, `padding: 12px 16px`. No shadow — this is an informational banner, not a card.

**Primary line:** Inter Semibold 15px ink, "~{N} kcal deficit so far today". The `~` tilde is part of the copy and signals approximation — do not remove.

**Sub-line:** Inter Regular 13px sage, "Week avg: ~{N} kcal/day". 4px below the primary line. Hidden when |avg| < 50 kcal/day.

**Visual hierarchy:** the primary line is set in Semibold (heavier), sub-line in Regular (lighter) — two clear registers, no confusion about which figure is today's vs the weekly view.

**Suppression:** renders nothing when: nothing logged today; no burn data; net is a surplus (≤0). Preserve these rules exactly — an empty banner is worse than no banner.

**Window toggle:** the "week avg" label changes to "7-day avg" per the user's Settings preference — surface this with the correct label only (do not show both).

---

### 3.8 TodayActivityBonusCard

#### Purpose
Burn breakdown (basal + activity + workouts), weekly deficit rollup, optional Maintenance tile with TDEE popover.

#### Benchmark
Fitbit Today narrative tiles (https://mobbin.com/screens/7a43ee28-ce4a-4c03-ad22-ad8fc98bd9bd) — labelled basal + activity breakdown; Oura readiness ring+narrative for the TDEE popover grammar.

#### Proposed redesign

**Summary row (above fold):** single line, Inter Semibold 15px: "Burned {N} kcal today" with a terracotta chevron to open the full breakdown. This is the first-glance answer; the detail is one tap away.

**Breakdown (expanded / always-visible on larger screens):**
Three-row list, each row: 14px Inter Regular label (left) + 14px Inter Semibold value (right). Row order: Basal metabolic rate → Activity → {Workout name}s. The Activity row shows the delta above basal — this is the meaningful number ("You burned 280 kcal above your base rate today").

**Weekly deficit rollup:** sits below the breakdown, separated by a hairline. Two rows: "Week deficit: ~{N} kcal" (Semibold) → "≈ {kg} kg of fat" (Regular sage). The kg-equivalent is visible by default — not hidden in caption text. `weekDeficitToKg` via 7700 — preserve exactly.

**Maintenance tile + popover:** the tile label is now "Your maintenance: {N} kcal" (full Semibold label, not a small secondary text link) with an info icon (`ⓘ`) to the right. Tapping the `ⓘ` opens the TDEE explainer popover. This surfaces the most analytically valuable element to users who have not yet discovered it.

**Tap → burn-detail screen:** the full card taps to `apps/mobile/app/burn-detail.tsx`. Preserve.

**Preserve exactly:**
- `weekDeficitToKg` using 7700 kcal/kg.
- `buildTdeeExplainerCopy` / `buildMaintenancePopoverCopy` — confidence + source in popover.
- `onOpenBurnDetail` handler.

---

### 3.9 Win-moment

**Treatment:** a single full-width warm message in Fraunces Italic 18px, ink, centred, with a 1px terracotta hairline rule above and below (4px above card, 4px below). No confetti. No animation beyond a gentle fade-in (300ms ease-out). This is the Noom-delight line: the product deliberately favours a quiet, specific acknowledgement over gamification — no badges, no streak fireworks, no celebratory motion.

**Preserve exactly:** the win-moment trigger conditions (hitting calorie target / weight win). No gamification elements added.

---

### 3.10 Fasting-stage narrative

#### Purpose
Time-bucketed hedged copy under the fasting ring.

#### Benchmark
Oura ring + narrative paragraph (https://mobbin.com/screens/146a11e1-f12f-4536-810a-029788d8a1ce); Calm Sleep Check-In hedged association framing (https://mobbin.com/screens/efb70f0a-118c-4dd7-9181-f3ea43ce5039).

#### Proposed redesign

**Typographic treatment:** Fraunces Regular 17px `#1B1814`, line-height 1.45, displayed immediately below the ring in a dedicated narrative zone (no card chrome — the ring already provides visual containment).

**Hedging visual signal:** the opening hedge word ("During", "Around", "After") is set in Fraunces Italic — a subtle typographic marker that signals "this is a characterisation, not a fact." The rest of the sentence is Regular.

**Time label:** Inter Semibold 11px uppercase `#9E9A94`, displayed above the narrative text. Format: `{H}h {M}m fasted`. This gives the user an anchor before reading the body-stage copy.

**Extended fast state:** "Extended fast territory — check in with your goals." in Fraunces Italic 17px sage. The italic and sage together signal "proceed with your own judgment" without being directive.

**Preserve exactly:**
- All eight time buckets and their exact copy.
- All hedged qualifiers ("may", "often", "typically") — do not edit to remove hedging even if copy editing is tempting.
- No absolute health claims.

---

### 3.11 TodayWeeklyInsightCard (web desktop right-rail)

**No change to scope:** intentionally web desktop-only (no right-rail on mobile). Redesign refines typography only:
- The "N days logged" label → Fraunces Semibold 24px.
- The 7-bar sparkline → each bar filled terracotta at opacity proportional to `day_kcal / (target × 1.2)`, empty days at `height: 4%` (preserve).
- Weekly avg kcal → Inter Semibold 16px below the sparkline.

**Preserve exactly:** scale to `target × 1.2`, refuse to show "0 kcal" (preserve).

---

### 3.12 Net-new bounded "Ask" surface (design spec, not a build commitment)

> **⚠ Superseded — see banner at the top of this file.** This section was
> written as a design-only spec, explicitly gated on a future product
> greenlight that had not happened yet. That greenlight happened: on
> 2026-07-01 Suppr shipped the bounded Ask surface as "Ask the coach" —
> three fixed chips, grounded, Pro-gated AI phrasing with a deterministic
> template fallback for Free users, default-on (implementation gate:
> `coach_screen_v1`). The "not a build commitment" framing below no longer
> applies; the shipped implementation is documented in
> [`docs/journeys/what-to-eat-next.md`](../../journeys/what-to-eat-next.md)
> (Part 2, "Ask the coach") and
> [`docs/api/endpoints.md`](../../api/endpoints.md) (`/api/nutrition/coach-ask`
> contract). The visual/interaction spec below is kept as historical record —
> some of it (the chip-row / no-free-text-input model, the non-diagnostic
> disclaimer, the "never invents a number" hard gate) is close to what
> shipped; other details (exact chip copy, "Sources" panel, entry-point chip
> below North-Star) diverged. Do not treat this section as a description of
> the current product.

**Gate:** this section defines the visual and interaction spec for a bounded Ask surface **only if** the product decides to build it. The engine beneath must remain deterministic or must be a bounded data-grounded LLM with citation-only generation (never open completion).

**Interaction model (Perplexity-Sources pattern):** https://mobbin.com/screens/a494bfc9-f0cd-4776-bf0f-3aeb1022af9c

No free-text open input. Instead:
- A row of 3–4 tappable suggested question chips (Inter Semibold 13px, sage pill, terracotta on active): "Why was Tuesday my best day?", "What moved my maintenance this week?", "What's a good dinner for tonight?"
- Each chip maps to a pre-computed answer built from the user's own logged data — not LLM completion.
- Answer card: Fraunces Regular 17px narrative sentence(s) + a "Sources" section listing the exact figures used (e.g., "Based on your 6 logged days, avg 1,840 kcal, protein 138g/day"). The Sources panel uses the same visual grammar as the TrajectoryCard basis line — tabular numbers, muted sans.
- Follow-up chips appear below the answer: related questions drawn from the same data context.
- Non-diagnostic disclaimer: Inter Regular 12px muted, bottom of the sheet: "Suppr is a tracking tool, not a medical or dietary advisor."

**Hard gates (non-negotiable for any implementation):**
- No open text input until a fully-grounded, citation-only architecture is validated.
- Every answer must cite the user's own figures — never a generic fact.
- "Never invents a number" rule applies without exception.
- Non-diagnostic disclaimer is always visible.
- If LLM is used, it receives only the user's own logged data as context and is prompted to cite it verbatim.

**Visual spec:** bottom sheet (mobile, 90% height), right panel (web desktop). White surface, same card grammar as the rest of the insight system. Entry point: a "Ask Suppr" chip below the North-Star block (terracotta pill, Inter Semibold 13px, Lucide `MessageCircle` icon).

---

## 4. Unified visual spec

### Design tokens

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1B1814` | Primary text |
| `--muted` | `#9E9A94` | Labels, metadata, captions |
| `--sage` | `#7C8466` | Secondary text, supporting lines, italic hedge |
| `--terracotta` | `#C2683E` | Primary CTA, active state, fit-band chip, projection line |
| `--amber` | `#C9892C` | Over-budget / alert state (calorie ring uses destructive red — this is macros/sodium only) |
| `--success` | `#5E7C5A` | Under-budget, goal marker |
| `--destructive` | (calorie ring over-budget only — per locked rule) | |
| `--surface` | `#FFFFFF` | Card backgrounds |
| `--card-bg` | `#F6F5F2` | Warm-grey card backgrounds (secondary surfaces) |
| `--border` | `#ECEAE4` | Hairline borders |

### Typography roles

| Role | Typeface | Size | Weight | Use |
|---|---|---|---|---|
| `display-hero` | Fraunces | 32px | Semibold | DigestStoryCard days hero, TrajectoryCard kg figure |
| `display-title` | Fraunces | 22–28px | Semibold | Digest header, Trajectory headline |
| `display-body` | Fraunces | 17–20px | Regular | ProgressHeadline sentence, fasting narrative, win-moment |
| `display-italic` | Fraunces | 15–17px | Italic | Insight/editorial lines, null states, hedge qualifier |
| `label-caps` | Inter | 10–11px | Semibold | Section labels (THIS WEEK, PROJECTED WEIGHT), ConfidenceChip |
| `body-primary` | Inter | 14–15px | Regular/Semibold | Supporting lines, suggestion body |
| `body-small` | Inter | 12–13px | Regular | Macro row, basis line, sub-line, footnotes |
| `numeral` | Inter | any | Semibold tabular-nums | Data figures in body context |

### Card grammar

All insight cards share one physical grammar:
- `border-radius: 16px`
- `background: #FFFFFF`
- `border: 1px solid #ECEAE4`
- `box-shadow: 0 1px 4px rgba(27,24,20,0.06)` (mobile: use native shadow props)
- `padding: 16px`
- Section label (10px Inter Semibold uppercase `#9E9A94`) as the first element, `margin-bottom: 8px`

Empty/null states do not get card chrome — they appear as full-width muted sentences, reducing visual noise when there is nothing to show.

### Chart grammar (TrajectoryCard)

- Historical line: `#7C8466` 1.5px stroke, scatter dots at weigh-ins.
- Projection line: `#C2683E` dashed (4/4px).
- Projection area fill: `#C2683E` at 6% opacity.
- Goal line: `#5E7C5A` dashed hairline.
- Endpoint label: white Fraunces 14px on terracotta rounded pill.
- No x-axis grid lines — clean background.
- Y-axis: two reference lines only (current weight, goal weight). No axis labels unless tapped.

### Spacing scale (8px base)

- Card internal padding: 16px
- Between cards on a scroll: 12px
- Between section label and first element: 8px
- Between lines within a card: 4–6px
- Touch targets: 44px minimum (iOS HIG)

### Motion

- Card entry (insight cards on Progress scroll): `opacity 0→1, translateY 8→0px`, 250ms ease-out, staggered 50ms per card.
- North-Star skip: slide out left 200ms ease-out, fade in next 150ms.
- Win-moment: fade in 300ms ease-out.
- Reduce-motion: all transitions instant.

### Accessibility

- All numerical insights must have accessible labels that include units ("2,140 calories per day, medium confidence").
- ConfidenceChip must be announced: "Confidence: medium" (not just the badge colour).
- Suppressed states must not be silently absent — VoiceOver users need a "no data yet" announcement on first visit.
- Colour is never the only signal for over/under budget — the delta pill includes text ("over target", "under target").

---

## 5. Parity notes

| Surface | Mobile | Web | Status |
|---|---|---|---|
| North-Star block | NorthStarBlock.tsx | north-star-block.tsx | Parity |
| North-Star why-dialog | Component exists | Confirmed | **Unconfirmed** |
| TodayWeeklyInsightCard | Not present | Desktop right-rail | Intentional carve-out |
| TodayDeficitInsight | Confirmed | **Unconfirmed** | **Parity check needed** |
| ProgressHeadline | progress-headline.tsx (mobile) | progress-headline.tsx (web) | Parity |
| DigestStoryCard | DigestStoryCard.tsx | digest-story-card.tsx | Parity |
| TrajectoryCard | TrajectoryCard.tsx | trajectory-card.tsx | Parity |
| Digest / DigestBlended | Digest.tsx + DigestBlended.tsx | digest.tsx + digest-blended.tsx | Parity |
| Win-moment | index.tsx + planner.tsx | settingsWinMomentWeb | Parity |
| Fasting narrative | fasting.tsx | N/A | Mobile-only (fasting screen) |
| Sunday push | _layout.tsx scheduling | weekly-recap route | Parity |

---

## 6. FUNCTIONALITY PRESERVED checklist

Every audited feature, data point, rule, and gate — confirmed preserved (or improved) in this spec:

**North-Star engine (Pillar 1)**
- [x] `NORTH_STAR_LIBRARY_MIN = 5`, relaxed to 2 during 30-day activation window
- [x] Portion multipliers clamped to {0.5, 1.0, 1.5, 2.0}
- [x] Asymmetric calorie penalty: over-shoot × 3, under-shoot × 1.5
- [x] Protein shortfall penalty × 0.5, no overshoot penalty
- [x] Carb distance × 0.1, fat distance × 0.1
- [x] Band thresholds: tight ≤ 5%, close ≤ 15%, loose > 15%
- [x] Chip label "Hits within 3%" — intentional mismatch to threshold, pinned
- [x] Slot windows: breakfast 06:00–10:30, lunch 10:30–14:30, snack 14:30–17:30, dinner 17:30–22:00
- [x] Slot-aware CTA map preserved exactly
- [x] Why-line 3-rule priority order preserved
- [x] Skip → pickNextNorthStarSuggestion with excludeIds
- [x] Five render states: default / new-user / library-empty / no-fit / over-budget
- [x] Returns null when remaining calories ≤ 0

**Progress narrative engine (Pillar 2)**
- [x] ProgressHeadline three regimes: calibrating / adjustment / steady
- [x] ConfidenceChip (low / medium / high) — repositioned before headline, not removed
- [x] `numerals[]` bolded figures — preserved, visual treatment improved
- [x] Pre-story placeholder floor at `STORY_DATA_FLOOR_DAYS = 3`
- [x] Calibrating sub-regimes: first-week (<3 days) vs mid-warmup
- [x] DigestStoryCard: all six sentence types with suppression rules
- [x] `classifyDigestHeroTone` ±max(40, 4%) thresholds
- [x] Day-of-week pattern suppression (<14 days or delta <200 kcal)
- [x] TrajectoryCard: ≥5 days gate for projection, placeholder for <5
- [x] `KCAL_PER_KG = 7700` — not changed
- [x] Basis line (7-day avg vs target) — elevated, not removed
- [x] Placeholder sentence verbatim preserved
- [x] Null state (no current weight) renders nothing
- [x] Honesty footnote "An estimate, not a promise." — preserved, typography improved

**Digest + suggestion cascade (Pillar 3)**
- [x] `shouldShowRecap` window: Sat 18:00 → Tue
- [x] `weekKeyFor` dismiss-per-week
- [x] `resolveDigestHeadline` first-match rules (all 5)
- [x] `bestDay` scoring (≥80% macro targets, ties → most recent)
- [x] 2×2 stat grid: Streak, Avg calories, Avg protein + adherence %, Weight Δ
- [x] `weightSurfaceMode` tile swap behaviour
- [x] Narrative lines with all suppression rules
- [x] Suggestion cascade: all 5 rules, strict priority order
- [x] Null state sentence verbatim: "Nothing to change this week. Your numbers held."
- [x] `tier` field type — no Pro-gated suggestions ship
- [x] 120-char headline / 200-char body caps
- [x] No exclamation marks, no performance adjectives
- [x] `weekly_digest_suggestion_shown` event with `rule` property
- [x] `progress_digest_blend` flag gate on DigestBlended

**Sunday push (Pillar 3)**
- [x] `PushBodyVariant`: zero_days / calories_only / with_weight / with_suggestion / with_adherence
- [x] `PUSH_BODY_MAX_CHARS = 178` with intelligent truncation
- [x] No "0 kg" for missing weigh-in
- [x] Explicit signs (+0.3 / −0.4 / 0.0)
- [x] No exclamation marks / performance adjectives

**Today inline insights (Pillar 4)**
- [x] TodayDeficitInsight: burn−consumed formula, net-deficit only (≤0 suppressed)
- [x] Sub-line: Σ(burn−consumed) / loggedDays — not /7 (2026-05-26 fix preserved)
- [x] Noise floor: sub-line hidden when |avg| < 50 kcal/day
- [x] All four suppression conditions preserved
- [x] Window label respects Settings preference (week avg vs 7-day avg)
- [x] TodayActivityBonusCard: basal + activity + workouts breakdown
- [x] `weekDeficitToKg` via 7700
- [x] `buildTdeeExplainerCopy` / `buildMaintenancePopoverCopy` preserved
- [x] Tap → `burn-detail.tsx`
- [x] Win-moment trigger conditions, Noom-delight treatment (no gamification)
- [x] TodayWeeklyInsightCard: web desktop-only (intentional carve-out)
- [x] Sparkline scale to target × 1.2, refuse "0 kcal"

**Fasting narrative (Pillar 5)**
- [x] All 8 time buckets and copy preserved
- [x] All hedged qualifiers preserved — no edits
- [x] No absolute health claims

**AI extraction (not coaching — preserved unchanged)**
- [x] Claude primary / OpenAI fallback provider architecture
- [x] `AiBudgetExceededError` and budget reservation
- [x] Extraction-only routes: photo-log, voice-log, scan-label, verify-recipe, recipe-import, plan-import, cookbook-import
- [x] AI log review UX: confidence chips, "Log anyway" gate, low-confidence amber border, AI-estimate badge
- [x] Photo path: range-first (kcal ranges per item, macro grouping, plate total)

**Trust posture (applies across all pillars)**
- [x] Confidence always visible (ConfidenceChip preserved + repositioned)
- [x] Hedged copy: "estimate", "~", "may", "often", "typically" — never removed
- [x] Never invents a number
- [x] All suppression/noise-floor rules (never shows "0 kcal" as a data-backed result)
- [x] No exclamation marks in coaching copy
- [x] Non-diagnostic disclaimer in any bounded Ask surface

**Gating (all Free unless noted)**
- [x] North-Star: Free
- [x] ProgressHeadline, DigestStoryCard, TrajectoryCard, Digest: Free
- [x] Suggestion cascade: Free (tier field preserved for future)
- [x] TodayDeficitInsight, TodayActivityBonusCard: Free
- [x] Win-moment: Free
- [x] Fasting narrative: Free
- [x] Sunday push: Free
- [x] Voice logging: Pro-only / server-enforced (unchanged — this is logging, not coaching)

---

## 7. Implementation notes for executor

1. **Do not build the bounded Ask surface** until the product explicitly greenlights it. The spec in §3.12 is a design reference only.
2. **TodayDeficitInsight web parity is unconfirmed.** Locate and verify the web equivalent of the banner before implementing the redesign there.
3. **North-Star why-dialog mobile parity is unconfirmed.** Check that `NorthStarBlock.tsx` on mobile renders the same why-dialog sheet as web, not just the why-line text.
4. All visual changes (card grammar, typography, chip styles, trajectory chart) must ship behind a feature flag per CLAUDE.md.
5. The trajectory chart SVG/Skia implementation should be extracted into a `<TrajectoryChart />` component separate from `TrajectoryCard.tsx` to keep the screen file under 400 lines.
6. The ConfidenceChip repositioning (before headline, not after) is a meaningful layout change — it needs a flag gate and before/after screenshots in the PR.
7. Font loading: Fraunces must be preloaded on web (next/font) and bundled on mobile (expo-font). Fallback: Georgia → serif.

---

## 8. Known parity gaps

**TodayDeficitInsight web parity.** The web location of the deficit banner
hasn't been confirmed against the mobile implementation. This is a core
insight surface on Today, so the gap is worth closing before any further
redesign work touches it.

**North-Star why-dialog mobile parity.** The mobile component exists, but
whether it renders the same explanatory sheet as the web tooltip/popover
hasn't been confirmed.

**TodayWeeklyInsightCard.** Web-desktop right-rail only, with no mobile
equivalent. This is an intentional carve-out, not a gap.

---

## 9. Related documents

- [`docs/journeys/what-to-eat-next.md`](../../journeys/what-to-eat-next.md) — canonical doc for the shipped Coach screen (entry points, sections, grounding contract, analytics).
- [`docs/decisions/2026-07-01-coach-screen-eng1240.md`](../../decisions/2026-07-01-coach-screen-eng1240.md) — the decision to ship the Coach screen.
- [`docs/decisions/2026-05-25-noom-delight-vs-gamification-line.md`](../../decisions/2026-05-25-noom-delight-vs-gamification-line.md) — the win-moment vs. gamification decision referenced in §3.9.
- [`docs/api/endpoints.md`](../../api/endpoints.md) — the `/api/nutrition/coach-ask` contract behind "Ask the coach".
