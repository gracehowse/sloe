# Cook Mode redesign spec — 2026-04-28

**Phase 6 P1.** Visual refit only — D-2026-04-27-09 freeze blocks new features. Surfaces: `src/app/components/CookMode.tsx`, `apps/mobile/app/cook.tsx`.
**Authority:** `docs/specs/2026-04-27-production-design-spec.md` motion §1.1, type §1.2, depth §1.3, dark mode §1.4, iconography §1.5, voice §1.7.
**Source:** `docs/audits/2026-04-28-visual-qa-pixel-level.md` finding #1.

## Later additions

- **2026-06-19 (ENG-944) — "For this step" inline ingredient chips.** A calm
  uppercase-captioned chip row of the ingredients each step references
  (amount + name, scale-aware, serif) renders beneath the instruction in cook
  mode on both platforms. Pure token matcher (`stepIngredients.ts`), no schema
  change, gated behind the default-OFF `cook_step_ingredients_v1` flag. Full
  record: `docs/decisions/2026-06-19-cook-step-ingredients.md`.

## Ship status (2026-04-30 partial — audit P1 / B5)

Mobile took a focused subset of this spec on 2026-04-30 ahead of the full visual refit, driven by the customer-lens audit:

- **§6 multi-timer story** — partially shipped. Mobile now imports `parseTimersInStep` + `formatTimer` from the shared `recipeTimers.ts` (item 1) and renders a single suggested-duration pill from the first match in the current step's text. Count-down with Success haptic + "Step done?" prompt on completion. Multi-timer rail (items 2–4) and stopwatch retirement (item 5) remain backlog — the legacy stopwatch is preserved as a fallback when no duration is parseable, so the screen never regresses from the prior UX.
- **§7 done state** — partially shipped. `🎉` retired in favour of a calm completion card with `CheckCircle2` (lucide) hero, captured cook duration ("Took you Nm SSs"), 1-tap rating row (5 lucide `Star` icons; persistence deferred — no `recipe_ratings` table yet), and "Add to my regulars" which writes a single-item `user_saved_meal` via the shared `createSavedMeal` so the user can re-log the recipe from Quick Add. Per-recipe `cook_history` persists to AsyncStorage (`suppr-cook-history-v1:{recipeId}`), capped at 10 entries, ready for the planned "you usually cook this in N min" surface. Headline copy is **"Recipe done."** (audit task brief 2026-04-30) rather than **"Plated."** — when the full spec ships the brand-direction wins; today's ship matches the user-facing audit.
- **§9 cross-platform parity** — also took a focused parity lift on the AI logging review surfaces (audit B5). Voice + Photo log sheets now compose from shared `<AiLogReviewItem>` and `<AiLogReviewSummary>` components so confidence chips, Low/Med/High colour, "Log anyway" gate and totals row can never drift between the two AI surfaces. Includes percentage chip ("High 92%") and the new "Overall AI confidence" header.

Items not yet shipped (canonical spec target): force-dark default, gradient IconBox, multi-timer active rail, `expo-notifications` backgrounded reminders, web parity for the same completion polish, `recipe_ratings` schema + persistence, "Plated." rebrand of headline copy.

---

## 1. Design intent

Cook Mode is a kitchen tool. User is one-metre away, hands wet/oily, eyes flicking between phone and pan. Screen must be **legible at arm's length, calm in the periphery, and instantly readable for the two things that matter — what to do now, and how long is left.**

Current build reads as placeholder: flat surfaces, system-mono numerals, emoji as celebration. Premium-tier Cook Mode is the same surface re-rendered against the spec — type ladder, depth tier, lucide iconography, Suppr motion vocabulary. **No new affordances added** (freeze).

---

## 2. Layout

### 2.1 Surface tier

Full-screen sheet, not card-on-page. Three tiers:
- **Surface (page)** — flat, no shadow.
- **Card (Step block, Done card, Active-timer strip)** — `Elevation.card`, 1px border, `Radius.lg` 16pt.
- **Floating (Done IconBox)** — `Elevation.floatPrimary` (primary glow).

**Cook Mode forces dark by default** — kitchen lighting and screen glare both improve under dark. Respects explicit user theme override. Sets `data-cook-mode="true"` flag on body.

### 2.2 Mobile layout (top to bottom)

1. **Header bar** 56pt — left `X` + "Exit" (44pt target), centre recipe title `Type.caption` ellipsis, right `ListChecks` 20pt for ingredients sheet.
2. **Step progress bar** 4pt height (up from 3pt), full-width, no padding. Track `colors.cardBorder`, fill `Accent.primary`.
3. **Active-timer strip** (only when `runningTimers.length > 0`). Horizontal scroll rail of timer pills, padding `lg × md`, bg `colors.card`, 1px bottom border.
4. **Step body** — flex 1, padding `xl × xxl-top`, stacked with `xl` gaps:
   - Eyebrow `Type.label` 11pt 700 +0.08em uppercase — "STEP {n} OF {total}"
   - Step number circle (see §3) — 56pt, self-aligned start
   - Step title (optional, when first sentence is a clear imperative ≤60 chars) — `Type.title` 24/700/-0.02em
   - Step body — `Type.headline` 17/24/700 (kitchen-readable size). Inline timer pills in text.
5. **Nav bar** — pinned bottom, 64pt, top border. Three slots: Prev (44pt circular icon), Next/Finish (56pt min-width 200pt primary), spacer.
6. **Helper text** — `Type.caption` `colors.textTertiary` centred. Hidden after first nav action.

### 2.3 Web layout

Same vertical structure. On desktop ≥1024px: opens as right-side sheet 480px wide; body 18px (1px concession to desktop reading distance); nav bar 72px tall; step number 64px. Ingredients sidebar `w-80` retained but recomposed with `<SupprCard>` rows.

### 2.4 Spacing rhythm

Strict — `Spacing.xl` (20) between block tiers, `Spacing.lg` (16) within tier, `Spacing.md` (12) for tight pairings. **No literal numbers in StyleSheet.**

---

## 3. Step-number affordance

Replaces `borderRadius: 8` rectangle.

| Property | Mobile | Web |
|---|---|---|
| Shape | perfect circle, `borderRadius: 28` on 56pt × 56pt | `border-radius: 9999px` on 64px × 64px |
| Background | `Accent.primary` solid (NOT 20% tint) | `var(--primary)` solid |
| Foreground | `colors.primaryForeground` (#fff) | `var(--primary-foreground)` |
| Type | `Type.headline` 17/700/-0.01em + tabular-nums | `1.125rem` 700 tabular-nums |
| Elevation | `Elevation.card` | `var(--elev-card)` |
| State on advance | scale 1 → 1.06 → 1.0 over 240ms `--ease-spring-soft` | framer-motion equivalent |
| Reduce-motion | scale skipped; 200ms colour-pulse on bg | identical |

**Solid primary, not tinted.** Tinted-on-tinted reads as a chip; solid reads as a marker. Self-aligned start (left), not centred — left-aligned hierarchy reads faster from arm's length.

---

## 4. Timer design

### 4.1 Typography

Timer numerals are second-most-prominent. Must be **tabular** (digits don't shift), **designed** (no Menlo), match the type ladder.

| Token | Mobile | Web |
|---|---|---|
| Active running countdown | `Type.ringValue` 36/36/700/-0.7 + tabular-nums | `2.25rem`/36px/700/-0.025em + `font-variant-numeric: tabular-nums` |
| Pill / rail timer | `Type.body` 14/20/500 + tabular-nums | `0.9375rem`/1.5/500 + tabular-nums |
| Done ribbon | `Type.caption` 11/14/500 | `0.6875rem`/1.4/500 |

**No `fontFamily: 'Menlo'`.** Inter (web), SF Pro (iOS), Roboto (Android) all ship `tnum` features that produce tabular-aligned numerals.

### 4.2 States

| State | Pill geometry | Foreground | Background |
|---|---|---|---|
| **Idle** (inline pill in step text) | 22pt height | `Accent.primary` | `Accent.primary` 15% + `Play` 12pt + label e.g. "10 min" |
| **Running** | 28pt height | `Accent.primary` | 10% bg + 1px primary 30% border + countdown e.g. "9:34" + `· label` + `X` 14pt |
| **Completed** | 28pt height | `Accent.success` | 12% bg + 1px success 30% border + `Check` + "Done · {label}" + `RotateCcw` 14pt |

**Pause state documented but NOT shipped** (freeze).

### 4.3 Active running countdown — primary panel

When ≥1 timer running, the **most-recently-started timer** lifts into a SupprCard above the rail:
- Eyebrow `Type.label` "TIMER"
- Numeric `Type.ringValue` 36pt 700 tabular-nums (primary running, success completed)
- Sub-row `Type.caption` "{label} · started {n}m ago"
- Trailing controls `RotateCcw` Reset 18pt + `X` Cancel 18pt (44pt tap targets)
- Last-3-seconds: numeric pulses 1.0 → 1.04 → 1.0 every second
- Completion: 600ms colour transition primary → success + caption "Done — tap to silence"

### 4.4 Inline timer pill

Web pattern survives intact. Refit:
- Glyph upgraded to lucide `Play` 12pt filled (mobile gains via `lucide-react-native`)
- Padding 4pt × 10pt
- Radius `Radius.md` 12pt (was 8pt on web)

### 4.5 Tap interactions

| Trigger | Response |
|---|---|
| Tap inline pill | confirm haptic; pill scales 1 → 0.96 → 1; adds to rail; primary panel updates; analytics `recipe_timer_started` with `{ recipeId, seconds }` |
| Tap running countdown numeric | selection haptic; cycles primary panel through rail |
| Tap Reset | confirm haptic; analytics `recipe_timer_reset` (NEW event) |
| Tap Cancel | selection haptic; pill slides out 200ms; demote next-most-recent into panel |
| Timer hits 0:00 | success haptic; chime (web) / haptic + system notification (mobile, when backgrounded); pill turns success-tinted; toast "Timer done: {label}" 1.5s |

---

## 5. Nav button states

### 5.1 Primary "Next" / "Finish"

| State | Mobile | Web |
|---|---|---|
| Enabled | `Pressable` 56pt, `Accent.primary`, `Type.headline` 17/22/700, `Radius.md`, `Elevation.floatPrimary` | `min-h-14 bg-primary text-primary-foreground rounded-xl shadow-[var(--elev-float-primary)] text-base font-semibold` |
| Press | scale 1 → 0.96 over 100ms; confirm haptic | opacity 0.92 over 100ms |
| Hover (web) | n/a | translateY(-1px) + shadow bump 150ms |
| Focus (web) | n/a | 2px ring-primary, ring-offset-2 |
| Last-step | label "Finish", lucide `Check` 18pt prepended | identical |

Microcopy: **"Next"** then **"Finish"** on last step. Not "Done!", not "Next Step". One word.

### 5.2 Secondary "Prev"

44pt circular icon-only button. Disabled state: bg `colors.background` (recedes), border 50%-alpha, glyph `colors.textTertiary`, **no shadow**, `opacity: 1` (colour does the work, NOT opacity-down).

VoiceOver: "Previous step. Disabled. You're on the first step." when `isFirst`.

### 5.3 Web trailing forward button — RETIRED

The third icon-button right of "Next" with `disabled:opacity-0` is removed. Two nav controls (Prev + Next) is canonical. Saves 56pt horizontal real estate.

---

## 6. Multi-timer story (mobile parity)

**Decision: single shared design.** Mobile gains web's multi-timer behaviour. Parity restoration, not new feature.

1. Mobile imports `parseTimersInStep` and `formatTimer` from shared `src/lib/nutrition/recipeTimers.ts` (already shared-safe).
2. Active-timer rail: horizontal `ScrollView` of pills per running timer, 250ms tick cadence.
3. Single global tick: one `setInterval` drives every running timer (canonical web pattern); cleared when `runningTimers.length === 0`.
4. **Backgrounded-timer notification** (mobile-only): `expo-notifications` schedule on timer-start, cancel on cancel/reset/exit. Permission denial degrades silently.
5. **Stopwatch retired** — current `timerActive`, `timerElapsed`, `intervalRef` count-up logic deleted. The parsed-timer pipeline replaces it.

---

## 7. Done state

Replaces emoji `🎉` and "Skip — back to recipe" pattern.

### 7.1 Layout

Centred SupprCard, max-width 360pt mobile / 480px web, padding `xxl × xl`. Stack:

1. **IconBox** 80×80 circle, `Elevation.floatPrimary`, gradient `linear-gradient(135deg, Accent.primary 0%, Accent.magenta 100%)` (brand gradient, used sparingly). Foreground lucide `Check` 36pt 2.5 stroke white. **No emoji.**
   - Reveal: scale 0.7 → 1.04 → 1.0 over 600ms `--ease-spring-soft` + opacity 0 → 1; success haptic at scale-peak.
2. **Headline** `Type.title` 24/700/-0.02em — **"Plated."** (single word, full stop. No exclamation, no emoji).
3. **Body** `Type.body` 14/20/500 muted — `{recipe.title} · {servings} serving{s}` then sub-line `{kcal} kcal · {protein}g · {carbs}g · {fat}g` with tabular-nums.
4. **Primary CTA "Log this meal"** — full-width, lucide `Check` 18pt prepended. Existing `handleLogMeal` (web) / autoLog query (mobile).
5. **Logged confirmation** (post-tap web; post-return mobile) — primary swaps to "Logged to tracker" success pill + secondary "View in tracker".
6. **Tertiary "Done"** — text-only, ghost, exits.
7. **Share CTA** — deferred (out of scope, captured for future).

### 7.2 Microcopy

- Headline: **Plated.**
- Body: `{recipe.title} · {servings} serving{s}` / `{kcal} kcal · {protein}g · {carbs}g · {fat}g`
- Primary CTA: **Log this meal** → **Logged to tracker** (after tap)
- Secondary: **View in tracker**
- Tertiary: **Done**

UK English. No exclamation marks. No emoji. Voice §1.7 compliant.

---

## 8. Motion language

### 8.1 Step transitions

Tap Next/Prev: outgoing body fade + 8pt translate opposite over 200ms `--ease-pm`; incoming body fade + 8pt translate from direction over 200ms with 60ms stagger. Step circle: scale-pulse 1.0 → 1.06 → 1.0 (does NOT translate — eye registers the new step). Progress bar tweens to new value over 300ms `--ease-pm`.

Reduce-motion: opacity-only crossfade 150ms, no translate, value swap with 200ms colour pulse.

Mobile: `react-native-reanimated@^3` (already a dep) — `withTiming` + `withSequence(withTiming, withSpring)`. Web: `framer-motion@^11` `<AnimatePresence mode="wait">` keyed on currentStep.

### 8.2 Timer countdown

Numeric updates every 250ms (matching tick). Tabular-nums means widths fixed → no reflow. Last 3 seconds: scale pulse 1.0 → 1.04 → 1.0 over 1s repeating. 0:00 hit: 600ms colour transition primary → success; success haptic + chime/notification.

### 8.3 Done-state reveal

1. Step body fade out 200ms `--ease-decel`.
2. Done card slide-in from below 16pt + fade over 350ms `--ease-spring-soft`.
3. IconBox scales 0.7 → 1.04 → 1.0 over 600ms `--ease-spring-soft`, +200ms relative to card.
4. Success haptic at IconBox scale peak (mobile).

Reduce-motion: card opacity-fades 200ms; IconBox at final scale; haptic still fires.

---

## 9. Cross-platform deviations (intentional)

| Deviation | Mobile | Web | Why |
|---|---|---|---|
| Force dark by default | Yes | Yes | Kitchen lighting/glare. User can override. |
| Backgrounded-timer notification | `expo-notifications` schedule | n/a (chime + tab-title flash + toast) | Mobile more likely backgrounded mid-cook. |
| Wake lock | `useKeepAwake` in the standalone `/cook` screen AND in the inline cook overlay's phase components (`CookMiseEnPlace` + `CookStepSwipeSurface`, ENG-959) | `navigator.wakeLock` with visibility-change re-acquire | Parity. The inline overlay (now the primary cook surface) initially lacked keep-awake — ENG-959 wired it into the always-mounted phase children rather than the pinned `recipe/[id].tsx`. |
| Ingredients UI | Modal sheet from header `ListChecks` | Right-side panel `w-80` inside cook surface | Mobile has no spare horizontal real estate. |
| Haptic feedback | selection / confirm / success per spec §1.1 | n/a | Web has no haptics. |
| Audio chime | Notification sound (system) on completion | `AudioContext` 880Hz tone | Existing parity preserved. |

---

## 10. Acceptance criteria (24 items)

1. Step-number circle is perfect circle (`borderRadius: 28` on 56pt mobile / `border-radius: 9999px` web), solid `Accent.primary`, white foreground, `Type.headline` 700 tabular-nums. **No `borderRadius: 8`.**
2. Timer numerics use `Type.ringValue` + tabular-nums. **No `fontFamily: 'Menlo'`.** Grep returns zero hits.
3. Done state uses 80pt gradient IconBox with lucide `Check`. **No emoji** (grep `🎉` zero hits).
4. Done copy matches §7.2 exactly: "Plated." / "Log this meal" / "Logged to tracker" / "View in tracker" / "Done". UK English. No exclamation.
5. Disabled Prev visually distinct (background+border+textTertiary, no shadow, NOT `opacity: 0.3`).
6. Web trailing forward button removed.
7. Mobile parses inline timers via `parseTimersInStep` (shared). Pills render identically to web. Stopwatch removed.
8. Mobile single global tick (one `setInterval` 250ms); cleared when no running timers. No leaks.
9. Mobile active-timer rail with countdown / label / cancel / reset per pill. Idle/Running/Completed states match §4.2.
10. Primary countdown panel shows most-recently-started timer at `Type.ringValue` 36pt with Reset/Cancel.
11. Mobile backgrounded-timer notification via `expo-notifications`; cancels on cancel/reset/exit. Permission denial degrades silently.
12. Step transition motion matches §8.1 — fade + 8pt slide on body, scale-pulse on step number, no body translate. Reduce-motion: opacity 150ms.
13. Done-state reveal motion matches §8.3 — card slide-in 16pt over 350ms, IconBox scale 0.7 → 1.04 → 1.0 over 600ms with +200ms stagger. Success haptic at peak.
14. **No `fontSize: <number>` literals** in cook files. All via `Type.*` / Tailwind tokens.
15. **All icons lucide.** No `Icons.*` proxies, no Ionicons.
16. **No spacing literals** — all via `Spacing.*` / Tailwind scale.
17. Touch targets ≥44pt mobile / ≥36px web.
18. VoiceOver / aria-label on every icon-only button.
19. Focus-visible ring (web) — 2px primary, 2px offset.
20. Dark mode tokens via `useThemeColors` / CSS vars. **No hardcoded `#fff` / `rgba(255,255,255,...)`.**
21. Cook-mode-forced-dark via `data-cook-mode="true"` flag, honours user theme override.
22. Analytics: `recipe_timer_started { recipeId, seconds }` from mobile (was missing seconds). New `recipe_timer_reset` from both. `cook_mode_completed` parity.
23. Cross-platform parity within §9 documented carve-outs.
24. State coverage matrix in §11 rendered + visual-qa snapshot tested.

---

## 11. State matrix

idle / first-step / mid-cook / no-timers / running-1-timer / running-N-timers / completed-timer / step-with-no-timers / disabled-Prev / done / done-after-log / done-after-log-then-view / over-budget warning (informational, doesn't block log) / loading (no-instructions empty state with `BookOpen` 48pt + "No instructions yet" + body "Add steps in the recipe editor" + button "Open recipe") / offline (logging queues, "Will sync") / permission-denied notifications (one-time toast with Settings link) / backgrounded-timer fires / reduce-motion (every motion replaced with opacity-only).

---

## 12. Components

**Reused:** `<SupprCard>`, `<EmptyState>`, `<IconBox>`, lucide glyphs (X, ChevronLeft, Play, Check, RotateCcw, ListChecks, BookOpen, Share2, AlertCircle).

**Retired:** `Icons.*` legacy proxies in cook files; web trailing forward button; mobile count-up stopwatch state; emoji 🎉; `fontFamily: 'Menlo'`; `borderRadius: 8` step number rectangle.

**New:** none (freeze).

---

## 13. Open questions

1. Cook-mode forced-dark default — confirm with `customer-lens` whether it reads as "thoughtful kitchen tool" or "broken light theme" to first-timers. Defer to product-lead.
2. Backgrounded notification body — should it include step text ("Step 4 — bake")? Recommend yes.
3. Share affordance — out of scope; route to `growth-strategist` for whether Cook Mode is the right surface.
4. Pause state — documented in §4.2, blocked by freeze. Reopen post-D-2026-04-27-09 reconsideration.
5. Volume-button-to-advance — out of scope; route to `journey-architect`.

---

## 14. Sequence dependencies

Independent of B1.1 (tab collapse) and B2.1 (Log sheet). Depends on:
- Token additions from spec §1 (already in `theme.ts` and `theme.css`)
- `<SupprCard>` and `<EmptyState>` primitives (verified shipped)
- `lucide-react-native` (verified)
- `expo-notifications` (verify mobile dep; add if absent)

Safe to ship in parallel with onboarding refit and Progress stat-grid refit.
