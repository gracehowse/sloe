# Planner summary card — redesign spec

**Phase 6 P1.** Visual refit. Surfaces: `apps/mobile/app/(tabs)/planner.tsx` lines 1519–1560 (styles 759–815); `src/app/components/MealPlanner.tsx` (referenced by `src/app/App.tsx`).
**Authority:** production design spec; D-2026-04-27-02 (Plan tab structure), D-2026-04-27-04 (north-star moment), D-2026-04-27-16 (trust posture).
**Source:** visual-qa pixel-level audit finding #4.

---

## 1. Design intent

Planner summary card is the visual anchor of the Plan tab. Four jobs in one glance:

1. Tells me which week I'm looking at.
2. Tells me whether the plan is working (how many days hit my targets).
3. Tells me what to do if it's not working (worst-short-day prescription).
4. Gives me the two actions I want — open shopping list + regenerate.

Must feel like the **artifact** of a working week, not a flat utility surface. Plan is sit-down work; the summary card is the "verdict" the user opens the tab to read. To Plan what the calorie ring is to Today: the one block worth lingering on.

Restraint is the bar. Must not compete with the day-strip below for attention.

**Carry-forward from live:** "Week of {Month Day}" overline copy (already prototype-aligned), ±10% tolerance for "hits target" calculation, worst-short-day diagnosis copy (with light voice pass per §1.7).

---

## 2. Card anatomy

Single `<SupprCard>` with `gradient` variant. Five regions top-to-bottom:

| Region | Content | Treatment |
|---|---|---|
| **A — Eyebrow row** | Left: `<Calendar>` 12pt lucide + "WEEK OF MON 27 APR". Right: `<TrustChip>` summarising worst source (`usda` if all verified, `off-adjusted` for mixed, `estimated` if any AI-est). | `Type.label` 11/14 700 +0.08em uppercase, `text-secondary`. Eyebrow icon and chip share baseline. |
| **B — Primary metric** | "**5** of 7 days hit your targets" — leading numeral is the tabular-nums hero. | `Type.headline` 17/700/-0.01em on the label. Numeral `Type.ringValue` 36/700/-0.7 letterspace + `tabular-nums` mandatory. |
| **C — Secondary metric pills** | Three pills flex-row gap 8pt: **Total kcal** (e.g. "13,650 kcal · avg 1,950") · **Protein hit** (e.g. "P 5/7") · **Worst day** (e.g. "Wed −180"). | `Type.caption` 11/500 inside pill. `Radius.full`, padding 3×8, height 22pt. Worst-day pill **amber-toned** when present, **success-toned** when none short. |
| **D — Diagnostic line** | One sentence prescription. Three variants: (a) all hit → "Wed lands tightest at +40. Hold this plan." (b) some short → "Wednesday is ~180 kcal short. Add a snack or swap the dinner." (c) some over → "Friday runs 320 over. Swap the dinner or scale a portion down." | `Type.body` 14/20/400 mobile / 0.9375rem web. `text-secondary`. Single line mobile (truncates); two-line max web. |
| **E — Action row** | Primary "Shopping list" with `<ShoppingCart>` 14pt + label. Secondary "Regenerate" with `<RefreshCw>` 14pt + label. Overflow `<MoreHorizontal>` 30×30 → action sheet "Save as template / Apply template / Clear plan / Share plan". | Primary: filled `--primary`, primary-fg, `Type.body` 13/700, height 36pt, padding 14×9, `Radius.md`. Secondary: outlined `var(--border)` on `var(--card)`, otherwise identical. Overflow: ghost square. |

Total card padding 20pt mobile / 24px web. Region gaps: A→B 8pt, B→C 12pt, C→D 14pt, D→E 16pt.

**Why these metrics:** the user already sees per-day calorie progress on the day-strip below. Summary card's job is to roll those into "is the plan working" — `summaryScore.hits` answers it. Total weekly kcal is the trust-anchor (the number the planner balances against). Protein hit-count is the second trust-anchor (the macro the planner explicitly scales for via `residualProteinGap`). Worst-day pill is the actionable prescription.

---

## 3. Background treatment

**Replace flat 8% primary tint with a true 135° linear gradient.** Use existing `--north-star-bg-from / -to / -border` tokens (the same DNA as Today's north-star block — both are "verdict" surfaces).

### Web

```css
.planner-summary-card {
  background: linear-gradient(135deg, var(--north-star-bg-from) 0%, var(--north-star-bg-to) 100%);
  border: 1px solid var(--north-star-border);
  border-radius: var(--radius-card);
  box-shadow: var(--elev-card);
}
```

- Light: `rgba(76, 108, 224, 0.08)` → `rgba(224, 72, 136, 0.04)` at 135°.
- Dark: `rgba(108, 140, 255, 0.14)` → `rgba(255, 126, 179, 0.08)` at 135°.

### Mobile

`expo-linear-gradient`:

```tsx
import { LinearGradient } from 'expo-linear-gradient';

<LinearGradient
  colors={[colors.northStarBgFrom, colors.northStarBgTo]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.summaryCard}
>
  {/* card content */}
</LinearGradient>
```

`styles.summaryCard` keeps `borderRadius`, `borderWidth`, `borderColor: colors.northStarBorder`, `padding`, `marginBottom`. Drops `backgroundColor` literal. **No `Accent.primary + "14"` arithmetic.**

The 135° angle (top-left → bottom-right) reads as "movement forward" — right metaphor for a planning artifact.

### Reduce-transparency

When `AccessibilityInfo.isReduceTransparencyEnabled()` (mobile) / `prefers-reduced-transparency: reduce` (web) is on, replace gradient with flat `var(--card)` background and same 1px border. Card depth comes from `--elev-card` shadow only.

---

## 4. Typography

| Region | Token | Mobile | Web |
|---|---|---|---|
| Eyebrow A | `Type.label` | 11/14/700/+0.08em uppercase | 11px/1.3/700/+0.08em uppercase |
| Hero numeral B | `Type.ringValue` | 36/36/700/-0.7 + tabular-nums | 2.25rem (36px)/1.0/700/-0.7 + `font-variant-numeric: tabular-nums` |
| Hero label B | `Type.headline` | 17/22/700/-0.01em | 1.125rem (18px)/1.3/700/-0.01em |
| Pill text C | `Type.caption` | 11/14/500 + tabular-nums on numerics | 11px/1.4/500 + tabular-nums |
| Diagnostic D | `Type.bodyMuted` | 14/20/400 | 0.9375rem (15px)/1.5/400 |
| Button label E | `Type.body` | 13/20/700 | 0.8125rem (13px)/1.4/700 |

**No `fontSize: <number>` literals.** All sizes via `Type` table. **Tabular-nums mandatory** on hero numeral, "13,650"/"1,950" inside kcal pill, "5/7" inside protein pill, "−180"/"+40"/"+320" inside worst-day pill.

**Eyebrow uses `+0.08em`** letter-spacing (NOT 1.2/1.4 pixel literals — drift from Type table).

---

## 5. Macro split — REJECTED in favour of metric pills

The brief asked for a recommendation. **Recommendation: absent on this card.** Use metric-pill row (region C above).

- 4-cell macro-remaining bar already shipped on Today (`MacroBarCell`). Repeating is duplicate-content anti-pattern (`feedback_no_duplicate_today_hero_content.md`).
- Ring on Plan competes with calorie ring on Today; D-2026-04-27-04 reserves ring geometry for Today.
- Pills (P/C/F averages) would either be 21 cells (too dense) or a 7-day average with no day-level signal (already in day-strip below).
- Metric pills C row deliver the same trust signals — total kcal, protein hit-rate — without redundant geometry.

---

## 6. Action affordances

**Primary CTA — "Shopping list".** Full-rounded button (`Radius.md`), filled `--primary`, white-fg text, lucide `ShoppingCart` 14pt 1.75 left of label. Mobile 36pt height, 14×9 padding. Press scale 1 → 0.98 (mobile, per §1.1); web hover `opacity: 0.92` over 100ms.

**Why Shopping is primary:** user clicked into Plan tab. Most likely next action — once they've checked the verdict — is supermarket. Regenerate is a tool action; Shopping is the export action. Per D-2026-04-27-11 mobile is the supermarket-phone surface.

**Secondary CTA — "Regenerate".** Outlined, ghost bg (`colors.card` mobile / `var(--card)` web), `colors.border` 1px, `text` fg, lucide `RefreshCw` 14pt 1.75. Same height + padding. Loading state replaces label + icon with `ActivityIndicator`/spinner; button `disabled={generating}`.

**Overflow — `<MoreHorizontal>` icon button.** Square 36×36, ghost bg, lucide glyph 18pt 1.75. Sits 12pt right of secondary, baseline-aligned. Action sheet:

| Action | Behaviour |
|---|---|
| Save as template | Existing `createPlanTemplate` → toast "Saved as 'Week of 27 Apr'" |
| Apply template | Existing `PlanTemplatesSheet` |
| Clear plan | Confirm "Clear this plan? Your shopping list will be wiped." → destructive "Clear plan" |
| Share plan | **NEW** — native share sheet: short text "My week on Suppr — 1,950 kcal/day average" + deep link. Flagged as deferred if templates+clear are priority. |

**Trust chip in eyebrow row** is metadata, not an action. Tapping opens popover ("Source breakdown: 12 USDA · 4 OFF · 2 estimated") on web / native action sheet mobile. **Optional, can defer.**

---

## 7. Empty state

Card currently doesn't render at all when `plan` is null/empty. **Decision: render distinct `<EmptyState>` variant of the card** — gives Plan tab a constant top-of-content anchor regardless of state.

| Sub-state | Trigger | Content |
|---|---|---|
| **No plan, library ≥ 5** | `!plan && savedRecipes.length >= 5` | Eyebrow "WEEK OF {MON DD}". Hero `<CalendarDays>` 32pt + headline "No plan yet — build this week" `Type.headline`. Diagnostic "We'll generate a 7-day plan from your library that hits your targets." Primary CTA "Build this week" (full-width mobile, 50% web). Secondary "Open library →" text-button. |
| **No plan, library < 5** | `!plan && savedRecipes.length < 5` | Same shell. Headline "Pick a few more recipes first". Diagnostic "Save 5+ recipes from Discover and we'll plan your week." Primary "Open library". Secondary disabled "Build this week" + caption "Need {5 - n} more saved." |
| **Free tier, days > 1 attempted** | `isFree && days > 1` | Headline "Plan your full week with Pro". Diagnostic "Free is 1 day. Pro plans 7 and writes a shopping list." Primary "Try Pro free for 7 days" → paywall. Secondary "Use 1-day plan". |

**Empty card uses same gradient background.** Surface is the artifact regardless. Border, padding, radius identical. Only content swaps.

---

## 8. Motion

Five named moments. All map to spec §1.1.

| Moment | Trigger | Animation | Reduce-motion |
|---|---|---|---|
| **Entrance** | Card mounts (Plan tab opens first time) | Opacity 0→1 + translateY 8pt→0 over 250ms `--ease-spring-soft` with overshoot. Web framer-motion `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.25,ease:[0.34,1.56,0.64,1]}}` | Opacity-only 150ms |
| **Week-toggle change** | User taps Today/Tomorrow/Next week; eyebrow date changes | Eyebrow crossfades 150ms `--ease-pm`. Hero metric, pills, diagnostic each crossfade 200ms with 60ms stagger so the eye sees the card "settle" left-to-right | Single 150ms opacity dim → restore |
| **Day-cell tap on day-strip below** | Tapping a day cell highlights which day this card's "worst day" pill references | Worst-day pill bg pulses to amber-soft 600ms `--ease-spring-soft` then settles. Selection haptic | No pulse — pill stays settled |
| **Plan-generation completion** | `generatePlan` resolves; new `summaryScore` flows | (1) Card briefly scales 1→1.01→1 over 400ms `--ease-spring-soft`. (2) Hero numeral counts up old→new over 600ms `--ease-spring-soft` (Reanimated `useSharedValue` + `withSpring`). (3) Pills tween width on text change. (4) Success haptic at scale peak (180ms in) | Numeral snaps; no scale; pills snap; haptic still fires |
| **Loading (regenerate in flight)** | `generating` state | Secondary button replaces icon + label with spinner. Card body **does not** pulse — user keeps reading current verdict while new one builds. After resolve, fall through to "Plan-generation completion" | Identical |

---

## 9. Cross-platform

### Same on web and mobile

Card anatomy regions A–E identical. Gradient angle (135°), tokens, border. Type ladder. CTA labels and order. Empty-state content. Trust chip selection logic. Tabular-nums on every numeric. Reduce-motion fallbacks.

### Intentional deviations

| Surface | Mobile | Web (desktop) | Why |
|---|---|---|---|
| Width | Full-bleed minus 20pt H padding | Constrained to Plan column max-width 640px on tablet, main column with sidebar 248 on desktop. Mobile-web (<768px) matches mobile rules | Web Plan is sit-down; never marquee-loud width on desktop |
| Action row | Buttons stack 50%/50% width with overflow far right | Buttons size to label content (auto width). Overflow 12px right of secondary. Right-aligned within row; diagnostic line + actions can share row 4 on desktop with horizontal space | Mobile users tap large; desktop has hover and doesn't need stretched buttons |
| Hero numeral | Inline with headline label on same line | Same — but numeral at `2.5rem` (40px) on desktop ≥1024px to balance wider card | Wider card = larger hero |
| Press feedback | Scale 1→0.98 + confirm haptic on primary; success haptic on regenerate complete | Hover `opacity: 0.92` over 100ms; focus-visible 2px primary ring + 2px offset | Spec §1.1 |
| Trust chip popover | Native action sheet on tap | Floating popover anchored below chip | Native pattern per platform |
| Gradient implementation | `expo-linear-gradient` `<LinearGradient>` wrapper | CSS `linear-gradient(135deg, ...)` on the card div | Platform primitive |

### Mobile-web

CSS `linear-gradient` supported in every browser. No fallback needed. Mobile-web uses web Planner code path (per Suppr's mobile-web-mirrors-web architecture), inherits CSS gradient automatically.

---

## 10. Acceptance criteria

1. Card renders true 135° linear gradient using `--north-star-bg-from` → `--north-star-bg-to` (web) and `colors.northStarBgFrom` → `colors.northStarBgTo` (mobile via `expo-linear-gradient`). Flat `Accent.primary + "14"` literal removed.
2. Border colour `--north-star-border` / `colors.northStarBorder`. `Accent.primary + "38"` removed.
3. Hero numeral renders at 36pt 700 -0.7 letterspace with `fontVariant: ['tabular-nums']`. **No `fontSize: 17` literal** for headline.
4. Four metric pills (kcal · protein hit · worst day · success variant) render with macro-tone or success/warning tint per §2 row C, NOT a single `Type.caption` line of comma-separated text.
5. Action row: primary "Shopping list" with `<ShoppingCart>` 14pt left of label; secondary "Regenerate" with `<RefreshCw>` 14pt left; overflow `<MoreHorizontal>` 36×36. Overflow opens action sheet with at minimum "Save as template / Apply template / Clear plan".
6. Trust chip in eyebrow renders one of `usda` / `off-adjusted` / `estimated` based on worst source.
7. Empty state: when `!plan`, card still renders with empty-state shell (gradient bg, eyebrow, hero glyph, headline, diagnostic, primary CTA). Card does not disappear.
8. Empty-state library-gated variants (≥5 / <5 / free-tier-locked) all render correct copy + CTA.
9. Entrance: opacity 0→1 + translateY 8→0 over 250ms `--ease-spring-soft` on first mount. Reduce-motion: opacity-only 150ms.
10. Plan-generation completion: hero numeral counts up over 600ms; card scale 1→1.01→1 over 400ms; success haptic on mobile at +180ms. Reduce-motion: numeral snaps, no scale, haptic still fires.
11. Web focus-visible ring (2px `--primary` + 2px offset) on every interactive element (chip, primary, secondary, overflow).
12. Mobile press feedback scale 1→0.98 + confirm haptic on primary/secondary; decisive haptic on overflow open.
13. VoiceOver labels: primary "Open shopping list", secondary "Regenerate this week's plan", overflow "More plan actions", trust chip "Source: {summary}".
14. Tabular-nums on hero, all pill numerics, any tooltip numerics. `font-variant-numeric: tabular-nums` (web) / `fontVariant: ['tabular-nums']` (RN) per usage.
15. Touch targets ≥44pt mobile / 36px web (44px coarse-pointer) on all four interactive surfaces.
16. Cross-platform deviations only where listed in §9.
17. Open questions in §11 resolved before merge.
18. Visual-qa side-by-side (live vs redesign) shows redesign reads as **anchor of the surface**, not flat utility band, on light + dark, mobile + web.
19. Sync-enforcer parity holds within named deviations.
20. Audit row "Planner summary card" in `docs/audits/2026-04-28-visual-qa-pixel-level.md` (entry #4) marked resolved post-merge.

---

## 11. Open questions

- **Q1.** Trust chip selection logic — summary chip rolls up worst source across plan's meals. Confirm with `nutrition-engine` whether exposing per-meal source is cheap on existing plan structure. If not, defer chip and ship card without it.
- **Q2.** Share plan action — depends on a deep-link route for plans which doesn't exist yet. Route to `journey-architect` to confirm whether plan-share is in 90-day plan or strike from overflow menu for now.
- **Q3.** Plan-generation completion haptic — spec §1.1 reserves `success` haptic for "meal logged, recipe saved, plan generated". Confirm scale-pulse + numeral count-up doesn't double-fire haptics with existing planner generation flow. `executor` to dedupe.
- **Q4.** Free-tier empty-state placement — currently locked-7-day case shows `Alert.alert` upgrade dialog (`planner.tsx:1604`). Empty card §7 third sub-state replaces with inline upsell. Confirm with `monetisation-architect` that inline doesn't undercut paywall conversion.
