# Onboarding Surface — Best-in-Class Redesign Spec

**Version:** 2026-06-02
**Status:** Design specification — awaiting HTML prototype + flag-gated implementation
**Surfaces covered:** All 14 onboarding steps (Welcome → App-choice → Signup → Goal → Sex → Age → Height → Weight → Activity → Pace → Diet → Strategy → Reveal → Data-bridges). `App-choice` ("Coming from another app?", ENG-990 / 2026-06-08) is flag-gated behind `onboarding-app-choice` and auto-skipped when OFF — see `docs/decisions/2026-06-08-onboarding-app-choice-capture.md`.
**Platforms:** iOS (primary), Web (parity — narrative column divergence documented)
**Functionality gate:** Every audited feature, data point, rule, calculation, safety check, and persistence mechanism must survive this redesign. See §12 for the exhaustive FUNCTIONALITY PRESERVED checklist.
**Source inventory:** `src/lib/onboarding/`, `apps/mobile/components/onboarding/`, `src/lib/nutrition/tdee.ts`, `src/lib/onboarding/targets.ts`, `src/lib/onboarding/persist.ts`

---

## 0. Locked design system

All token references use the warm-coaching direction locked 2026-06-02.

| Role | Hex | Usage on this surface |
|---|---|---|
| Page base | `#FFFFFF` | Step backgrounds — no cream wash |
| Ink / near-black | `#1B1814` | All body text, labels, question headers |
| Card surface | `#F6F5F2` | OptionCards, bridge cards, preview tiles |
| Hairline border | `#ECEAE4` | Card outlines, dividers, inactive ruler ticks |
| Terracotta (primary CTA) | `#C2683E` | Active card border, Continue button, selected pill, preset-chip recommended badge |
| Muted sage (secondary) | `#7C8466` | Step eyebrow labels, secondary subtitles, methodology notes |
| Amber (caution / near-floor) | `#C9892C` | warn-tier paceWarning banner, slider thumb at fast-loss threshold |
| Destructive / danger | `#D9463D` | danger-tier paceWarning banner + acknowledgement checkbox ring |
| Success green | `#5E7C5A` | Reveal "plan ready" confirmation, standard-pace chip mark |
| Progress bar fill | `#C2683E` | Onboarding progress bar (current step fraction) |
| Progress bar track | `#ECEAE4` | Unfilled portion of progress bar |

**Type roles:**

| Role | Font | Weight | Size (mobile) | Use |
|---|---|---|---|---|
| Display / editorial | Fraunces | 700 | 32–40 sp | Step H1, reveal kcal numeral, pace rate readout |
| Section header | Newsreader | 600 italic | 20–22 sp | Italic-underline accent phrase on Welcome + step eyebrows |
| Body | Inter | 400 | 15–16 sp | Subtitles, explanatory copy, card subtitles |
| Label | Inter | 600 | 13–14 sp | Card titles, pill labels, data labels |
| Caption | Inter | 400 | 12 sp | Methodology notes, fine print, expander content |
| Data numeral | Fraunces | 700 | 28–56 sp | Reveal calorie count, height/weight value, age value |
| Data unit | Inter | 400 | 14–16 sp | "years", "cm", "kg", "kcal/day" beside the numeral |

**Imagery rule:**
- Ingredient thumbnails (seeds, nuts, eggs, blueberries) = stylised-photoreal on clean white — keep existing style exactly.
- Finished dish / meal photography (welcome hero, diet card thumbnails) = hyperrealistic editorial food photography, @thelittleplantation / @_foodstories_ style: natural/moody light, ceramic bowls, linen props, shallow depth of field.
- No loose watercolour. No flat stock. No colour-block heroes.

---

## 1. Surface overview

**Purpose:** The single intake funnel that transforms a stranger into an activated user with a personalised calorie target, macro plan, seeded recipe library, and first weekly meal plan — in one linear pass.

**Role in the product:** Onboarding is the activation contract. If the user exits before step 13 completes, the north-star moment ("what to eat next") cannot fire on Today — the recipe library is empty and no plan exists. Every step in the funnel serves either trust-building (welcome/signup), data collection (stats/goal/pace/diet/strategy), or payoff (reveal/data-bridges).

**Navigation position:**
- Entry: cold open from app launch (new user), or Settings → "Refresh my plan" (returning user)
- Exit: `/(tabs)?onboarding_complete=1` (new user) or same with `refresh=1` flag (returning user)
- Route: `/onboarding` (canonical). `/onboarding-v2` is a thin redirect; keep it indefinitely.
- No back-stack outside the funnel during the flow (shell manages back as internal step navigation only).

**Platforms:** iOS-primary (Apple Sign-In, HealthKit, haptics, RulerSlider). Web parity with documented divergences (narrative column, email auth, no Apple Health card, step counter differences on refresh-plan).

### Jargon gloss at trust moments (ENG-1187, flag `onboarding_jargon_gloss_v1`, default-OFF)

Onboarding leans on unexplained `TDEE` / `BMR` / `Mifflin-St Jeor` at three
trust moments where a first-time user can't decode the acronyms. The mitigations
already present (plain headline number, honest "estimates" framing, the "Show
the maths" expander) stay; the gloss fixes the **default labels** so the acronym
is glossed on first use per screen, calm-coach voice — lead with the plain
phrase, keep the acronym secondary in parentheses, don't repeat the parenthetical.

| Site | Plain (default) | Glossed (flag ON) |
|---|---|---|
| Welcome reassurance bullet (web) | "Adaptive TDEE that learns from you" | "Adaptive daily calorie burn (TDEE) that learns from you" |
| Pace live-feedback tile (web + mobile) | "vs. your TDEE" | "vs. your daily burn (TDEE)" |
| Reveal BMR tile (web + mobile) | "BMR" | "Calories at rest (BMR)" |
| Reveal TDEE tile (web + mobile) | "Est. TDEE" | "Est. daily burn (TDEE)" |
| Reveal methodology note (web + mobile) | "…based on the Mifflin-St Jeor equation." | "…based on the Mifflin-St Jeor equation — a standard formula for estimating the calories you burn." |

All glossed + plain strings live in the shared copy module
`src/lib/onboarding/figmaCopy.ts` (imported by mobile via
`@suppr/shared/onboarding/figmaCopy`), so web ↔ mobile can't drift. Each of the
~5 render sites selects glossed vs plain via
`isFeatureEnabled("onboarding_jargon_gloss_v1")` with the plain copy in the
`else`. The flag is **default-OFF** (not in either platform's
`REDESIGN_DEFAULT_ON`); ramp via PostHog. The "Show the maths" expander keeps the
acronyms intentionally — it's the power-user audit trail, not a first-use trust
moment. Copy-parity + flag-gating pins: `tests/unit/onboardingJargonGloss.test.ts`.

---

## 2. Current design — full UX audit

### What is working

- **Intent-first question order** (goal → stats → pace → diet → strategy → reveal) is correct and validated by MacroFactor and Alma; do not reorder.
- **Progress bar without numeric counter** — correct decision (2026-04-30 removal of "N/13"). Validated: WHOOP, MFP use bars; Fitbod "Step 1/17" reads as a churn anchor.
- **200ms auto-advance on single-select** — speed advantage no comparable matches.
- **OptionCard structure** (icon + title + subtitle) — validated by WHOOP and Fitbod.
- **RulerSlider for height/weight** — validated by Tonal, Me+, MFP as the premium precise input.
- **Reveal count-up ring** — distinctive payoff moment; no comparable drops it.
- **"Show the maths" expander** — only app in the set with inline Mifflin formula transparency.
- **Pace danger-acknowledgement gate** — no comparable has a genuine block; Suppr exceeds the bar.
- **weightSkipped path** — no comparable handles null-target users; unique inclusion differentiator.
- **14 regulated allergens (EU FIC / UK FSA)** — all comparable apps show 8 or fewer; Suppr's full set is a compliance differentiator.
- **MFP CSV import card on data-bridges** — zero comparables; refugee-capture moat. Now paired with the front-of-funnel **App-choice step** ("Coming from another app?", ENG-990) that captures which tracker the user is leaving and pre-highlights the importer for an importable app — the Yazio competitor-switch pattern (`docs/research/2026-06-08-yazio-teardown.md`) wired into our real CSV pipeline.

### Weaknesses to fix

1. **Welcome hero gradient + dimmed "Example" tiles** — the brand-gradient hero with low-opacity illustration tiles reads as generic onboarding chrome. No hyperreal food image = misses the "cook what you love" positioning in the first 2 seconds.
2. **H1 typography on every step** — all headers are Inter bold, none is Fraunces display. The entire editorial warmth of the design system is absent from the step that users spend the most time in.
3. **Goal cards use lucide glyphs at baseline weight** — terracotta active-state border exists but glyphs are thin/generic vs the Fitbod line-art reference.
4. **Strategy step is static** — selecting a strategy card shows no live macro consequence; it's a quiz with a "RECOMMENDED" badge and nothing else. The connection between strategy and the reveal numbers is invisible to the user.
5. **Pace step projection card shows kcal + ±TDEE but no projected outcome date** — MacroFactor, BitePal, Lifesum, Cal AI, and MFP all show this; it is the single most motivating piece of information at this step.
6. **Slider thumb on Pace step does not escalate with the safety tier** — the 3-tier paceWarning fires a separate banner, but the thumb/track give no visual signal. The caution-escalation affordance (MacroFactor pattern) is missing.
7. **"Show the maths" expander is a flat text dump** — BMR formula + TDEE + Target as three rows. MacroFactor's numbered "1. Estimated Expenditure → 2. Average Target" narrative is more scannable and more credible.
8. **Reveal macro tile numerals are Inter** — all comparables (Cal AI, Lifesum, Alma) use a large serif numeral for the payoff moment. The editorial weight is missing.
9. **No projected-outcome line on reveal** — "On this plan, you'd reach approximately [X] by [date]" is present in MFP, Cal AI, Lifesum, MacroFactor, and BitePal. Absent here.
10. **Diet step has no food imagery on cards** — SideChef validates that small food thumbnails on diet cards make the choice feel grounded in real recipes, not abstract labels.
11. **Data-bridges step has no visual hierarchy between bridge types** — manual-targets card, Apple Health, notifications, URL importer, and MFP CSV all render at the same visual weight. The strategic value order (HealthKit → notifications → MFP → manual → URL tease) should drive visual prominence.
12. **No italic-underline accent on any H1** — Alma's primary editorial device (one emotive phrase emphasised with serif italic + underline accent) is absent across all 13 steps. This is the highest-leverage single type change.
13. **Privacy reassurance only on Sex step** — Me+ shows the reassurance inline on the weight step too, where it matters most.
14. **Web narrative column text** — the eyebrow/head/body/extra copy per step in `narrative.tsx` has not been updated to match the warm-coaching voice; it reads as a feature-list sidebar.

---

## 3. Step-by-step redesign

### Step 01 — Welcome

**Current purpose:** First impression; single CTA into funnel; teases Reel-import wedge via FloatingPreview.

**Current weaknesses:** Brand-gradient hero; dimmed "Example" tiles; H1 in Inter bold; no editorial serif; no hyperreal food.

**Best-in-class benchmark:**
- Alma "Track nutrients towards the goals *you care about*" — serif + italic-underline accent, near-white wash, no colour hero. [mobbin.com/screens/770d207f-3589-4cab-99f6-cc1bcc8f6e5e](https://mobbin.com/screens/770d207f-3589-4cab-99f6-cc1bcc8f6e5e)
- Alma "Your *nutrition coach* Alma is here to help" — shows a real macro ring + score card as proof of product. [mobbin.com/screens/08113bd6-f84a-41ca-9372-ec8fd2f8575d](https://mobbin.com/screens/08113bd6-f84a-41ca-9372-ec8fd2f8575d)
- MFP hyperreal food-bowl hero with floating macro rings. [mobbin.com/screens/45a2dcbc-29fa-4272-a532-f134c3026b61](https://mobbin.com/screens/45a2dcbc-29fa-4272-a532-f134c3026b61)

**Proposed redesign:**

*Layout (mobile):*
```
┌─────────────────────────────────────┐
│  [SupprMark logo, size 28, centered]│
│                                     │
│  ─── full-bleed editorial photo ─── │
│  hyperrealistic dish: natural light │
│  ceramic bowl, linen, shallow DoF   │
│  image fills top ~42% of screen    │
│                                     │
│  [FloatingPreview card, bottom-left │
│   of photo: "Sheet-pan chicken from │
│   instagram.com" + USDA pill —      │
│   keep this, upgrade photo to real] │
│                                     │
│  Eat well,                          │  ← Fraunces 700 36sp ink #1B1814
│  without *overthinking it.*         │  ← "overthinking it" = Newsreader 600
│                                     │     italic + 1px terracotta underline
│  Import any recipe. Get targets     │  ← Inter 400 15sp sage #7C8466
│  that fit around the food you love. │
│                                     │
│  ┌─────────────────────────────────┐│
│  │         Get started             ││  ← filled terracotta, 52px height
│  └─────────────────────────────────┘│     Inter 600 16sp white, radius 12
│                                     │
│  Already have an account? Sign in   │  ← Inter 400 14sp sage, tappable
└─────────────────────────────────────┘
```

*Key changes from current:*
- Remove brand-gradient hero. Replace with one hyperreal dish photograph (the Suppr editorial food style) occupying ~42% of screen.
- `SupprMark` logo moves above the photo, small (28px), ink colour, left-aligned — not centered over a gradient.
- H1 uses Fraunces 700 for "Eat well, without" + Newsreader 600 italic for "overthinking it." The italic phrase gets a 1px terracotta underline (Alma's primary editorial device).
- FloatingPreview card survives. The photo inside it upgrades from the dimmed illustration to a real hyperreal dish thumbnail (same USDA pill + "from instagram.com" copy). This is the Reel-import wedge tease — keep it prominent.
- No social proof count line (N=1 solo-tester; calm-voice rule; reinstatable at scale).
- Status bar: light-content (keep).
- "Example" label on FloatingPreview can be removed now that the image is genuinely illustrative of real product output.

*States:*
- Default: as above.
- Auto-skipped (isRefreshPlan or authed): shell bypasses, no render.

*Microcopy voice check:* "Eat well, without overthinking it." is grounded, permission-framing, not bubbly or shaming. Subtitle "Import any recipe. Get targets that fit around the food you love." anchors the positioning ("cook what you love, fit it to your goals") without a health claim.

*Accessibility:* Dish photo has alt text "A home-cooked meal ready to log". FloatingPreview card: aria-label "Example recipe card showing Suppr's recipe import feature". CTA button minimum touch target 44×44pt.

*User benefit:* The hyperreal dish photo + editorial type makes the positioning legible in under 2 seconds. The FloatingPreview card differentiates Suppr from every tracking-app welcome screen the user has seen before.

---

### Step 02 — Signup

**Current purpose:** Apple Sign-In; optional first-name capture; consent fine print.

**Current weaknesses:** The step is fully functional but visually plain — a sign-in button on a white screen with no copy that earns the trust ask. The fine print is small and crammed. The "Email sign-up coming soon" line is an advertised non-existent feature.

**Best-in-class benchmark:** No direct Mobbin comparable covers Apple-Sign-In-only onboarding. Internal best practice: show the user what they're signing into (one sentence about what gets created), not just "sign in."

**Proposed redesign:**

*Layout:*
```
┌─────────────────────────────────────┐
│  ← (back, only if not first step)  │
│                                     │
│  Your plan lives here.              │  ← Fraunces 700 32sp
│                                     │
│  Sign in to save your targets,      │  ← Inter 400 15sp sage
│  recipes, and daily progress.       │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  [Apple logo]  Sign in with     ││  ← system Apple button component
│  │               Apple             ││     (must stay for AppStore rules)
│  └─────────────────────────────────┘│
│                                     │
│  ── Optional ──────────────────── │  ← Inter 400 12sp hairline divider label
│                                     │
│  First name  [___________________] │  ← Inter 400 15sp input, hairline border
│                                     │
│  ─────────────────────────────────  │
│  By signing in you agree to         │  ← Inter 400 12sp caption sage
│  Suppr's Terms and Privacy Policy.  │
│  (link: Terms / Privacy Policy)     │
└─────────────────────────────────────┘
```

*Key changes from current:*
- H1 "Your plan lives here." in Fraunces 700 — the trust ask now has editorial weight.
- Remove "Email sign-up is coming soon" — never advertise a non-existent path.
- Fine-print copy tightened; Terms + Privacy Policy as inline links.
- Footer Continue button suppressed (kept — owned by session-gated shell effect, not the step).
- Error state: red `#D9463D` banner below the Apple button — unchanged logic, keep styling.

*States:*
- Default: as above.
- Loading (auth in flight): Apple button disabled, subtle activity indicator.
- Error: red banner above fine print; `ERR_REQUEST_CANCELED` silently suppressed (keep).
- Auto-skipped (session exists): shell bypasses.

*Microcopy:* "Your plan lives here." — calm authority, not "Create your free account!" No health claims. No urgency.

*User benefit:* The H1 tells the user what they're protecting by signing in, making the friction feel worthwhile.

---

### Step 03 — Goal

**Current purpose:** Intent-first fork. Sets goal type, drives strategy default, pace step visibility, target sign.

**Current weaknesses:** OptionCards use thin lucide glyphs. Active state shows terracotta border (good) but no fill shift. Card subtitles are accurate but read as feature-list copy.

**Best-in-class benchmark:**
- Fitbod goal cards with terracotta line-art glyphs + terracotta active border. [mobbin.com/screens/64e855b8-2f61-4d02-9195-fc0ecd184235](https://mobbin.com/screens/64e855b8-2f61-4d02-9195-fc0ecd184235)
- WHOOP "icon + bold label + one-line subtitle" single-select cards. [mobbin.com/screens/3dd64dce-3e4b-4603-92f6-cdaf5e38ac1f](https://mobbin.com/screens/3dd64dce-3e4b-4603-92f6-cdaf5e38ac1f)
- Tonal goal cards with body-comp subtitles. [mobbin.com/screens/a0bb4e2e-0082-4b57-b943-0600d062256d](https://mobbin.com/screens/a0bb4e2e-0082-4b57-b943-0600d062256d)

**Proposed redesign:**

*Layout:*
```
[progress bar — terracotta fill on hairline track]

What are you here for?               ← Fraunces 700 32sp

Let's build a plan around it.        ← Inter 400 15sp sage

┌──────────────────────────────────┐
│ [TrendingDown glyph, terracotta] │ ← OptionCard: 64px height, F6F5F2 bg
│ Lose fat          ›              │   active: C2683E hairline border (1.5px)
│ Gradual deficit, protein-first   │   + F6F5F2→warm tint fill shift
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ [Minus glyph, terracotta]        │
│ Maintain          ›              │
│ Keep things steady               │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ [TrendingUp glyph, terracotta]   │
│ Gain muscle       ›              │
│ Small surplus, high protein      │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ [ArrowLeftRight glyph, terracotta│
│ Recomposition     ›              │
│ Slight deficit, strength-focused │
└──────────────────────────────────┘

[Continue — appears after selection, 200ms auto-advance]
```

*Key changes from current:*
- Step question in Fraunces 700 ("What are you here for?") — applies to every step, the H1 role is always Fraunces from this point.
- Glyph colour: terracotta `#C2683E` at all times (not just selected). Validated by Fitbod.
- Active state: terracotta 1.5px border + very subtle warm card-fill (`#FDF9F6`, a warmer tint of `#F6F5F2`) — gives tactile selection feedback without a heavy colour block.
- Keep "Recomposition" — do not trim to 3 goals (recomp is a genuine differentiator).
- 200ms auto-advance: keep (validated by absence in all comparables — Suppr's speed edge).
- Subtitle voice shift: "Gradual deficit, protein-first" → "Lose fat steadily, protect muscle." One sentence that frames permission, not restriction. (Apply same voice reframe to all four cards.)

*States:*
- Default: all four cards, none selected.
- Selected: terracotta border + fill shift; Continue slides up (200ms delay before auto-advance fires).
- Error: n/a (canAdvance gated on selection, not a validation error).

*User benefit:* The terracotta glyph + active-border selection makes the intent choice feel deliberate and premium, not like a form radio.

---

### Step 04 — Sex

**Current purpose:** Mifflin coefficient input; ~166 kcal/day between male/female estimates.

**Current weaknesses:** "Prefer not to say" subtitle explaining the midpoint is buried. The expander is good but the accordion label is generic.

**Best-in-class benchmark:** No direct comparable for a 3-option sex step with trans/non-binary inclusivity copy. Suppr's existing expander explaining the midpoint is best-in-class for this.

**Proposed redesign:**

*Key changes from current:*
- H1 in Fraunces 700: "This helps estimate your metabolism." (replaces whatever the current label is). Subtitle: "All estimates. Suppr re-calibrates from your actual logs." — leads with the adaptive promise.
- Same 3 OptionCards + auto-advance.
- Expander accordion title: "Why does this matter?" (warmer than the current label).
- Privacy footer: keep exactly, same copy.
- Card glyphs and active state match the Goal step treatment (terracotta glyph, hairline active border).

*User benefit:* The "All estimates" + adaptive-calibration reassurance defuses anxiety about the input mattering too much. The inclusion expander is kept — it's a differentiator, not a gap to close.

---

### Step 05 — Age

**Current purpose:** Mifflin subtracts ~5 kcal/year; range 14–100; default 28.

**Current weaknesses:** Subtitle "Metabolic rate drops ~1% per decade after 20" is accurate but reads as clinical. The stepper is functional but the numeral rendering is Inter.

**Proposed redesign:**

*Key changes from current:*
- H1 Fraunces 700: "How old are you?"
- Main numeral rendered in Fraunces 700 56sp (the data-numeral role) with Inter 400 16sp "years" suffix — Tonal validates this serif-numeral treatment for body-stat inputs.
- Subtitle becomes: "Metabolism shifts with age — your targets will too." — framing change is about the adaptive system, not the number.
- Expander title: "How does this affect my target?" (keep expander copy verbatim — it's accurate and well-sourced).
- `MobileNumberStepper`: stepper controls remain; the numeral display above them gets the serif treatment.

---

### Step 06 — Height

**Current purpose:** `RulerSlider` input; metric/imperial toggle; range 140–210cm / 48–84in; default 170cm.

**Current weaknesses:** Unit segmented control is unlabelled (just "cm / ft·in"). The current value numeral is Inter.

**Proposed redesign:**

*Key changes from current:*
- H1 Fraunces 700: "How tall are you?"
- Value numeral: Fraunces 700 56sp; unit suffix in Inter 400 16sp. Validated by Tonal.
- Segmented control: small-caps Inter 600 12sp labels for "cm" / "ft · in" — maintain segment, clarify label.
- RulerSlider: keep ruler ticks in `#ECEAE4` (hairline), active tick and thumb in terracotta `#C2683E`. The slider centre marker becomes a terracotta line.
- Privacy footer is not needed here (height is lower sensitivity than weight).

---

### Step 07 — Weight

**Current purpose:** `RulerSlider`; metric/imperial; range 40–150kg / 90–330lb; weightSkipped path.

**Current weaknesses:** The weightSkipped path has good pulsing-Scale UI but no inline privacy note. The numeric value is Inter.

**Best-in-class benchmark:**
- Me+ "won't be collected or shared" inline reassurance directly on weight step. [mobbin.com/screens/bf9f7b73-b31b-41c8-b6e9-84fd3b93-6d9](https://mobbin.com/screens/bf9f7b73-b31b-41c8-b6e9-84fd3b93-6d9)
- Tonal's horizontal ruler with big serif numeral. [mobbin.com/screens/f949a4e9-815f-4789-b147-752873bd58eb](https://mobbin.com/screens/f949a4e9-815f-4789-b147-752873bd58eb)

**Proposed redesign:**

*Layout:*
```
How much do you weigh?              ← Fraunces 700 32sp

                72.0                ← Fraunces 700 56sp terracotta
                 kg                 ← Inter 400 16sp sage

[──────── RulerSlider ────────────]  ← ECEAE4 ticks, C2683E active mark

[  cm / ft · in  ] [  kg / lb  ]   ← segmented controls

🔒 Stored privately. Never shared.  ← Inter 400 12sp sage
   Only used to estimate your targets.

──────────────────────────────────
Prefer not to enter              >  ← Inter 400 14sp terracotta, tappable
```

*weightSkipped state (no change to logic, restyled):*
```
[Scale glyph, pulsing 2s ease, terracotta on F6F5F2 circle]

We'll learn your numbers            ← Fraunces 700 28sp
from your logs.                     ← (continuation)

Suppr calibrates from your first    ← Inter 400 15sp sage
couple of weeks of meal logging
and weigh-ins. No estimate needed.

Actually, I'll enter it          >  ← Inter 400 14sp terracotta, tappable
```

*Key changes from current:*
- Fraunces 700 for the weight numeral (same Tonal-validated treatment as Height).
- Privacy note ("Stored privately. Never shared.") added directly on this step — Me+ pattern; extends the existing Sex-step privacy footer to where it matters most.
- "Prefer not to enter" as a clear tappable row at the bottom of the main-entry state; "Actually, I'll enter it" on the skipped state — same copy as current but surfaced more visibly.
- **Hard preserve:** `weightSkipped` entire path — auto-skip of Pace, null targets, calibration copy, partial profile write. None of this changes.
- **Reject** inline BMI chip (BitePal) — conflicts with the brand's non-shaming posture and the weightSkipped inclusion work.

---

### Step 08 — Activity

**Current purpose:** 5 activity-level OptionCards mapping to Mifflin multipliers (1.2–1.9). Auto-advance 200ms.

**Current weaknesses:** Same visual-weight issue as Goal step (thin glyphs, no terracotta tint on active).

**Proposed redesign:**

*Key changes from current:*
- H1 Fraunces 700: "How active are you day-to-day?"
- Same 5 cards, same labels, same multipliers — no changes to logic or copy.
- Apply Goal-step visual treatment: terracotta glyph, terracotta active border + warm fill tint.
- Subtitle on step: "Outside of deliberate exercise." — clarifies the Mifflin multiplier definition (sedentary can include regular gym-goers with desk jobs) and reduces a common source of user miscalibration.
- 200ms auto-advance: keep.

---

### Step 09 — Pace (auto-skipped for maintain/weightSkipped)

**Current purpose:** Pace presets + continuous slider; live projection card (kcal + ±TDEE); 3-tier safety warning; danger-acknowledgement gate.

**Current weaknesses:** Slider thumb does not escalate with safety tier. No projected-outcome date. Preset chips are functional but visually flat. "Show this maths" is absent here (only on Reveal).

**Best-in-class benchmark:**
- MacroFactor escalating slider thumb: "Faster (Use Caution)" with `!` marker. [mobbin.com/screens/40ea93bb-5832-4add-b87c-7478dbac38fb](https://mobbin.com/screens/40ea93bb-5832-4add-b87c-7478dbac38fb)
- MacroFactor standard pace with green checked thumb. [mobbin.com/screens/e2a3e0fa-c865-4ab1-80a3-9ee9c46244fe](https://mobbin.com/screens/e2a3e0fa-c865-4ab1-80a3-9ee9c46244fe)
- MacroFactor live readout: lbs/week + %BW/week + kcal target + projected end date. [mobbin.com/screens/15188e61-2a91-4076-980a-e419eab48265](https://mobbin.com/screens/15188e61-2a91-4076-980a-e419eab48265)
- BitePal named presets + projected date card. [mobbin.com/screens/4faff70d-3d2f-43fd-9b44-af4d25a5ccad](https://mobbin.com/screens/4faff70d-3d2f-43fd-9b44-af4d25a5ccad)
- Lifesum "Steady (Recommended) · Lose 0.5 kg/week · 10 weeks". [mobbin.com/screens/194c1d07-655e-48ff-98e6-f0faf34f88f5](https://mobbin.com/screens/194c1d07-655e-48ff-98e6-f0faf34f88f5)

**Proposed redesign:**

*Layout:*
```
How fast do you want to progress?   ← Fraunces 700 32sp

                0.4                 ← Fraunces 700 56sp
           kg / week                ← Inter 400 15sp sage

[Gentle]  [Steady ★]  [Ambitious]   ← preset chips; ★ = "Recommended" pill
                                       terracotta active fill; ECEAE4 inactive

[slider ─────●────────────────────] ← thumb: circle

   ┌────────────────────────────────┐
   │ Daily target   1,650 kcal     │  ← Inter 600 14sp label / Fraunces 700 18sp number
   │ vs. your TDEE  −350 kcal/day  │  ← sage label / ink number
   │ Reach ~68 kg by  Sep 2026     │  ← NEW: terracotta label / ink date (additive)
   └────────────────────────────────┘

   — Methodology note —             ← Inter 400 12sp sage, always visible
   ~7,700 kcal ≈ 1 kg body mass.
   NHS/NIH guidance. Not medical advice.
```

*Escalating thumb — maps 1:1 to paceWarning tiers:*

| paceWarning level | Thumb colour | Track fill colour | Glyph on thumb |
|---|---|---|---|
| none (safe) | `#C2683E` terracotta | `#C2683E` | none |
| info (near_floor) | `#C2683E` | `#C2683E` | none (only banner fires) |
| warn (fast_loss) | `#C9892C` amber | `#C9892C` | `!` (small, white) |
| danger (below_floor) | `#D9463D` destructive | `#D9463D` | `‼` (small, white) |

*paceWarning banners (styling, copy unchanged in content — voice-refined):*

**info banner** — brand-tint background, terracotta border:
> "You're approaching the minimum recommended daily intake. This is fine, just worth knowing."

**warn banner** — amber background, amber border:
> "That pace is on the faster end. Rapid loss can be harder to sustain and may reduce muscle mass."

**danger banner** — destructive background, red border (existing legal copy, no changes to NHS/NIH sourcing):
> "This target is below the minimum recommended intake (NHS / NIH). We strongly recommend a slower pace. Prescribed VLCDs are an exception — consult your doctor."
> `[ ] I understand — I want to continue at this pace` — **required to advance** (keep exactly).

*Projected-outcome date (additive, new):*
```
Computed as: today + (abs(targetWeightKg - currentWeightKg) / paceKgPerWeek) weeks.
Display: "Reach ~[goalWeightKg] kg by [MMM YYYY]"
Only shown when: goal is lose/gain AND weightSkipped is false AND goalWeightKg is known.
Fallback when no goalWeightKg: show "at ~[paceReadout] kg/week" without a date.
```

Note: `goalWeightKg` is not currently collected in the onboarding state. Two options: (a) derive a heuristic goal weight from the pace + a 12-week forward projection ("at this pace, ~[today + 12wk target]"), or (b) add a goal-weight input. Option (a) is the correct scope-bounded path — compute "you'd reach approximately [today + 12 weeks of pace]" without requiring an extra step. Always qualify with "approximately" per the trust-posture rules. This is additive — if the number reads odd for the user's inputs, the fallback is to omit it cleanly. **This requires a small additive change to `reveal.tsx` and `pace.tsx` — tag as ENG-NNN in Linear before implementing.**

*Methodology note:* Keep exactly — 7700 kcal/kg constant, NIH/NHS sourcing, pregnancy/under-18/medical disclaimer.

*User benefit:* The escalating thumb gives an ambient caution signal that doesn't require the user to read the banner. The projected-date addition is the single most motivating number on this step, validated by five comparables.

---

### Step 10 — Diet + Allergens

**Current purpose:** 10 diet OptionCards (mutually exclusive "Anything goes") + 14 regulated allergen toggle pills. Optional; feeds seed filtering.

**Current weaknesses:** Diet cards have no food imagery. All cards render at identical visual weight. The "Anything goes" mutual-exclusion pattern works but is visually invisible.

**Best-in-class benchmark:**
- SideChef diet image-tiles + allergen pills on one screen with "We'll only show you recipes for your diet" rationale. [mobbin.com/screens/6e171e18-91eb-4849-980d-65206ccbedde](https://mobbin.com/screens/6e171e18-91eb-4849-980d-65206ccbedde)
- Zero "None of these" explicit mutual-exclusion pill. [mobbin.com/screens/27a9c79d-192d-4ebf-b416-da6a9961d8e7](https://mobbin.com/screens/27a9c79d-192d-4ebf-b416-da6a9961d8e7)
- Allset rounded diet chips. [mobbin.com/screens/9e5687c5-ef20-46ca-93d5-373d7b7573d8](https://mobbin.com/screens/9e5687c5-ef20-46ca-93d5-373d7b7573d8)

**Proposed redesign:**

*Layout:*
```
Any dietary needs?                  ← Fraunces 700 32sp

We'll filter your recipe suggestions.← Inter 400 15sp sage
Skip if it doesn't apply.

── Diet ────────────────────────────

[Anything goes]                     ← full-width card, terracotta active
                                       mutually exclusive — selecting clears others

┌──────────────┐  ┌──────────────┐
│ [dish thumb] │  │ [dish thumb] │  ← 2-col grid; 56px tall card
│ Vegetarian   │  │ Vegan        │
└──────────────┘  └──────────────┘
(... remaining 7 diet cards in 2-col grid ...)

── Allergies ───────────────────────

[Peanuts] [Tree nuts] [Milk] [Eggs]  ← pill grid, multi-select
[Fish] [Shellfish] [Soy] [Wheat]       terracotta active state
[Sesame] [Mustard] [Celery]            ECEAE4 inactive, hairline border
[Sulfites] [Lupin] [Gluten]
```

*Key changes from current:*
- Add small hyperreal dish thumbnails to each diet card — SideChef validated. The thumbnail must be meal photography (ceramic bowl, natural light) not an icon. Keep the card title as a label.
- "Anything goes" as a full-width card placed first, visually distinct (wider padding). Selecting it deselects all others. Selecting any other deselects "Anything goes." (Zero / Allset pattern — validated.)
- Allergen pills: unchanged logic, 14 regulated allergens, multi-select. Terracotta active fill + white label. Hairline border inactive. No images on allergen pills (too small; legibility wins).
- Rationale line "We'll filter your recipe suggestions." directly under the H1 — SideChef validates showing the filter consequence inline.
- Both sections on one screen (keep current structure — SideChef validates it).
- **Hard preserve:** all 14 regulated allergens. Never trim to match comparables (FIC/FSA compliance differentiator).

*States:*
- Default: "Anything goes" not pre-selected; allergen pills all inactive. (canAdvance: always true — step is optional.)
- Anything goes selected: all other diet cards dim slightly (0.4 opacity) to signal mutual exclusion.
- Diet card selected + anything-goes deselected: "Anything goes" dims.
- Allergen selected: terracotta pill, white label.

---

### Step 11 — Strategy / Macro style

**Current purpose:** 4 OptionCards (Balanced / High protein / High satisfaction / Low carb). Goal-derived "RECOMMENDED" badge. Sets protein g/kg model.

**Current weaknesses:** Selecting a card shows no live macro consequence. The choice feels abstract — a quiz, not a tuning moment.

**Best-in-class benchmark:**
- Alma "Choose your diet" with live macro-bubble cluster resizing as strategy is selected, "RECOMMENDED" badge, "Enter custom values" escape. [mobbin.com/screens/152a6910-e6e2-49fd-942d-8e17a2ab13aa](https://mobbin.com/screens/152a6910-e6e2-49fd-942d-8e17a2ab13aa)

**Proposed redesign:**

*Layout:*
```
How do you want to eat?             ← Fraunces 700 32sp

Your macros adjust to match.        ← Inter 400 15sp sage

┌──────────────────────────────────┐
│ ⭐ RECOMMENDED                   │ ← terracotta pill, Inter 600 10sp ALL CAPS
│ High protein                     │ ← Inter 600 15sp
│ ~2.2 g per kg bodyweight         │ ← Inter 400 13sp sage
│                                  │
│ P 165g  C 180g  F 58g            │ ← live preview row — Inter 600 12sp
│ (protein terracotta, carbs blue, │   macro token colours per brand-tokens.md
│  fats amber — per macro map)     │
└──────────────────────────────────┘
(... 3 more strategy cards, each with live P/C/F preview ...)

Macros are a starting point. Suppr  ← Inter 400 12sp sage (keep this line)
recalibrates from your actual logs.
```

*Key changes from current:*
- Add a live P/C/F gram preview row at the bottom of each strategy card — computed from the current `targets` for the selected stats. Alma validates surfacing macro consequences at the strategy step.
- Preview row uses macro token colours (protein colour, carbs colour, fat colour from `brand-tokens.md`). This is additive — the numbers come from `calculateMacros` already running at this point in state.
- Render the P/C/F values in Inter 600 12sp (data-label role — Inter wins over serif here; data density).
- RECOMMENDED badge: keep. Move to top-left corner of card as a pill (terracotta bg, white text, Inter 600 10sp ALL CAPS "RECOMMENDED") — Alma validates this placement.
- `null` strategy → uses goal default. Keep.
- Methodology note: keep exactly.

*Interaction:* Tapping a card shows its live macro preview. No auto-advance — user may want to compare cards. Continue button required.

*User benefit:* The user sees the macro consequence before they commit, which makes the strategy choice feel real rather than hypothetical. The P/C/F preview also reduces anxiety about the step ("I don't know what High Protein means for me" → "165g protein, that makes sense").

---

### Step 12 — Reveal / Your targets

**Current purpose:** The payoff moment. Count-up ring → H1 "Your plan is ready." → 3 macro tiles → BMR/TDEE summary → "Show the maths" expander → "What happens next" card → Adaptive TDEE promise.

**Current weaknesses:** Kcal numeral and macro-tile grams rendered in Inter. "Show the maths" is a flat text dump (BMR formula + TDEE + Target as three rows). No projected-outcome line.

**Best-in-class benchmark:**
- MacroFactor "How was your program designed?" numbered 1-2-3 expenditure story. [mobbin.com/screens/8a6e223d-86b1-4522-be23-293dc631274f](https://mobbin.com/screens/8a6e223d-86b1-4522-be23-293dc631274f)
- Cal AI 2×2 macro ring tiles with per-tile edit affordance. [mobbin.com/screens/7294b9e4-76ae-4d49-af18-bfb3d8a2566a](https://mobbin.com/screens/7294b9e4-76ae-4d49-af18-bfb3d8a2566a)
- Lifesum plan-ready with macro bars + "How to reach your goals" checklist. [mobbin.com/screens/60b8d8e9-2eca-48ce-afa9-744206f1f0d3](https://mobbin.com/screens/60b8d8e9-2eca-48ce-afa9-744206f1f0d3)
- Alma "recommended daily calories" with big circle + rationale attribution. [mobbin.com/screens/a0d33d78-4482-49d2-9bc2-d433916bfbbf](https://mobbin.com/screens/a0d33d78-4482-49d2-9bc2-d433916bfbbf)
- MFP "Congratulations + projected date + How we make recommendations". [mobbin.com/screens/cc3afa32-4262-4b9d-b3c2-f898b59ac935](https://mobbin.com/screens/cc3afa32-4262-4b9d-b3c2-f898b59ac935)

**Proposed redesign:**

*Layout:*
```
~700ms "Crunching your numbers…" beat
→ success haptic
→ 1200ms count-up (cubic ease-out)

Your plan is ready.                 ← Fraunces 700 32sp ink
Your daily target                   ← Inter 400 14sp sage (eyebrow)

           1,650                    ← Fraunces 700 72sp terracotta (count-up)
          kcal / day                ← Inter 400 15sp sage

[gradient ring, 220px, r=88, 75% complete arc]

On this plan, you'd reach           ← Inter 400 14sp sage (NEW — projected outcome)
approximately 68 kg by Sep 2026.    ← Inter 600 14sp ink
                                    ← (only shown when goal ≠ maintain and weight known)

─────────────────────────────────

┌────────────┐  ┌────────────┐  ┌────────────┐
│  165       │  │  180       │  │  58        │
│   g        │  │   g        │  │   g        │
│ Protein    │  │  Carbs     │  │   Fat      │
│ 40% ──░░░ │  │ 44% ──░░░ │  │ 32% ──░░░ │
└────────────┘  └────────────┘  └────────────┘
  ↑ Fraunces 700 24sp for the grams numeral; Inter 400 12sp for label

─────────────────────────────────

┌─────────────────────────────────────────────┐
│ Estimated BMR      1,385 kcal              │  ← Inter 600 13sp label / Fraunces 600 15sp num
│ Estimated TDEE     2,000 kcal              │
└─────────────────────────────────────────────┘

▼ How we got here                   ← accordion, Inter 600 14sp, chevron

  1. Your resting burn               ← Inter 600 13sp + number in Inter 600 13sp
     BMR: (10 × 72) + (6.25 × 175) − (5 × 28) + 5 = 1,732 kcal
  2. Active daily burn
     TDEE: 1,732 × 1.375 = 2,382 kcal (lightly active)
  3. Your target
     Target: 2,382 − 350 = 2,032 kcal  (−0.4 kg/week pace)
     ← MacroFactor "numbered expenditure story" pattern

─────────────────────────────────

What happens next                   ← Inter 700 16sp
  Log meals as you eat              ← Inter 400 14sp + Search/Barcode/Photo icons
  Watch the ring fill               ← Inter 400 14sp
  Adapt over the first ~2 weeks     ← Inter 400 14sp + adaptive-TDEE promise

Targets update as Suppr learns from ← Inter 400 12sp sage (keep)
your meals and weigh-ins.

[Continue]
```

*Key changes from current:*
- Kcal numeral: Fraunces 700 72sp (from Inter). Validated by Cal AI, Lifesum, Alma big-numeral reveals.
- Macro tile grams: Fraunces 700 24sp. Cal AI validates per-tile editorial numerals.
- Projected-outcome line (additive): Inter 400/600 14sp, only shown when goal ≠ maintain and weight is known. Computes as (targetWeightKg − currentWeightKg) / paceKgPerWeek weeks from today. Always prefixed "approximately". Validated by MFP, Cal AI, Lifesum, MacroFactor, BitePal.
- "Show the maths" expander → **"How we got here"** with 3 numbered steps (MacroFactor pattern). Content unchanged: BMR (Mifflin formula inline) → TDEE (BMR × multiplier inline) → Target (TDEE + kcalAdj inline). The numbered structure makes the same content scannable without obscuring any of the data.
- Macro tile % labels: keep (they exist currently behind `reveal-macro-tile-paired-pct` flag — this redesign makes the % always visible, rendered in Inter 400 12sp with a mini progress bar). Keep the flag stub for backwards compatibility during rollout.
- Per-tile edit affordance: not added here (Cal AI validates the concept, but the editing UX is data-bridges step functionality — redirect users to the manual-targets card on data-bridges rather than fragmenting the edit surface across two steps). This is a defended choice.

*weightSkipped / missing-stats fallback (keep exactly):*
```
[Scale glyph, terracotta, pulsing 2s in F6F5F2 circle]

We'll calibrate your              ← Fraunces 700 28sp
targets from your logs.

Suppr will set your daily target  ← Inter 400 15sp sage
after a couple of weeks of
meals and weigh-ins.

[Continue — always available]
```

*Loading state:* "Crunching your numbers…" in Inter 400 15sp sage, centred. Keep ~700ms beat.

*User benefit:* The numbered "How we got here" story makes Mifflin-St Jeor legible to a non-technical user without hiding the formula. The projected-outcome date converts an abstract kcal number into a personally meaningful milestone. The serif numerals elevate the payoff moment from a form result to an editorial reveal.

---

### Step 13 — Data-bridges / Bring your data

**Current purpose:** Terminal step. Manual targets, Apple Health, push notifications, MFP CSV import, Reel-import tease. Fires `handleComplete` / "Build my plan" CTA.

**Current weaknesses:** All bridge cards render at the same visual weight regardless of strategic value. No explicit visual hierarchy between "set your data up" bridges (HealthKit, notifications) and "already have data" bridges (manual targets, MFP CSV).

**Best-in-class benchmark:**
- MFP bundled opt-ins as checked rows post-reveal. [mobbin.com/screens/cc3afa32-4262-4b9d-b3c2-f898b59ac935](https://mobbin.com/screens/cc3afa32-4262-4b9d-b3c2-f898b59ac935)
- MacroFactor deferred-feature card pattern. [mobbin.com/screens/33d0ede5-d398-452b-b2ed-9b17cc0692dd](https://mobbin.com/screens/33d0ede5-d398-452b-b2ed-9b17cc0692dd)

**Proposed redesign:**

*Layout:*
```
Bring your data with you.           ← Fraunces 700 32sp
Skip any of these — or all of them. ← Inter 400 15sp sage

── Set up ──────────────────────────

[Apple Health card]                 ← F6F5F2 bg, ECEAE4 border, prominent
  Connect Apple Health              ← Inter 700 15sp ink
  Syncs today's active energy.      ← Inter 400 13sp sage
  [Connect]  /  [Connected ✓]       ← terracotta button / success badge
  (iOS only — no render on web)

[Notifications card]
  Get gentle reminders              ← Inter 700 15sp ink
  Evening nudge + Sunday recap.     ← Inter 400 13sp sage
  Two per week, max.
  [Turn on]  /  [On ✓]              ← terracotta button / success badge

── Already have data? ──────────────

[Manual targets card]
  I already know my targets         ← Inter 700 15sp ink
  Set your own kcal and macros.     ← Inter 400 13sp sage
  [Expand: kcal / P / C / F inputs] ← 4 numeric inputs; all-4-or-nothing rule
  (fine print: partial entries ignored)

[MFP CSV import card]               ← STRATEGIC MOAT — do not dim or defer
  Moving from MyFitnessPal?         ← Inter 700 15sp ink
  Import your log history.          ← Inter 400 13sp sage
  [Import CSV]

── Coming up ───────────────────────

[Recipe URL card — informational]
  Paste any recipe URL              ← Inter 700 15sp ink (muted, non-interactive)
  Instagram, TikTok, YouTube.       ← Inter 400 13sp sage
  Available after setup.            ← Inter 400 12sp sage caption

─────────────────────────────────

[Build my plan]                     ← terracotta filled button, 52px, full width
                                       Inter 600 16sp white; "Refresh my plan"
                                       on refresh flow
```

*Key changes from current:*
- Two-section structure ("Set up" / "Already have data?") with a "Coming up" tertiary section for the URL tease. This is additive information architecture — the card content is unchanged.
- Apple Health and notifications move to the "Set up" section — they are the highest-value connections and should be seen first.
- MFP CSV import is elevated to the "Already have data?" section and does not get visually demoted — it is the refugee-capture moat.
- "Connected" / "On" badges: success green `#5E7C5A` with `✓` — consistent with the brand success token.
- All bridge cards: F6F5F2 background, ECEAE4 hairline border, 12px radius. No pre-checked states (MFP's dark pattern — everything opt-in, unchecked by default).
- "Skip any of these — or all of them." framing kept (more honest than pre-checks; validated as better than MFP's pattern).
- Manual targets: all-4-or-nothing rule is preserved exactly. Partial entries ignored fine-print added as a caption below the inputs so users understand why a partial entry won't register.
- **Hard preserve:** `handleComplete` flow — auth guard → `persistOnboarding` → seed selection → plan build → events. No changes to this chain.

*States:*
- Default: all bridges unconfigured.
- Apple Health connected: card shows success badge, button becomes "Connected ✓" in success green.
- Notifications on: "On ✓" success badge.
- Manual targets: all 4 inputs filled → "Set ✓" badge; partial → no badge, fine print visible.
- MFP import complete: "Imported ✓" badge.
- "Build my plan" button: always enabled (canAdvance: true — keep). If no session at tap → auth guard fires, sends to signup.
- Refresh-plan flow: "Refresh my plan" CTA text; "Keep / Clear" logs prompt after completion (keep exactly).
- Plan-build failure: `plan_build=failed` param on navigate (keep — do not remove error surface).

---

## 4. Web-specific: narrative column

The web flow renders a `narrative.tsx` left column with eyebrow/head/body/extra text per step. This is web-only (intentional carve-out). The redesign requires updating the narrative copy to match the warm-coaching voice and the new H1 framing on each step.

**Per-step narrative updates (web only):**

| Step | Eyebrow | Head | Body | Extra |
|---|---|---|---|---|
| welcome | Your new food companion | Eat well, without *overthinking it.* | Import recipes from anywhere. We'll match them against real nutrition data. | — |
| signup | Step 1 of 1 | Your plan, saved. | Sign in to keep your targets, recipes, and progress — whatever happens. | — |
| goal | What matters to you | Tell us where you're headed. | We'll build your targets around your goal — not a one-size template. | — |
| sex | Metabolism baseline | A small but real difference. | Mifflin-St Jeor uses biological sex as one input. Suppr re-calibrates from your actual data. | — |
| age | Metabolism baseline | Your starting estimate. | Metabolic rate shifts slowly with age. Your real usage data matters more than this estimate. | — |
| height | Body stats | Height sets the baseline. | One of three inputs to your resting burn estimate. | — |
| weight | Body stats | The number that moves. | Your current weight is the most important input for pace and targets. | Privacy note: stored privately, never shared. |
| activity | Daily energy out | How much do you move? | Your activity multiplier is the second-largest lever in your target after your goal pace. | — |
| pace | Your rate of progress | Choose your pace. | Faster isn't always better. Suppr flags paces that put you below safe thresholds. | NIH/NHS sourcing note |
| diet | Your recipe filter | Cook what you love. | These filters apply to your recipe suggestions. Allergens are from the EU FIC regulated list. | — |
| strategy | Macro approach | How you want to fuel. | High protein, balanced, or fat-led — the right answer depends on your goal and lifestyle. | — |
| reveal | Your plan | The numbers are yours. | Based on Mifflin-St Jeor + your activity multiplier + pace. Suppr will update these from your real logs. | — |
| data-bridges | Optional upgrades | Bring what you already have. | These are all optional. Even an empty start works — the library fills up fast. | — |

---

## 5. Motion + interaction spec

| Event | Motion | Duration | Easing |
|---|---|---|---|
| Step transition (forward) | Slide left + fade | 280ms | `easeInOut` |
| Step transition (back) | Slide right + fade | 240ms | `easeOut` |
| OptionCard selection | Scale 0.97 → 1.0 + border flash | 120ms | spring stiffness 300 |
| Auto-advance (single-select) | 200ms delay → step transition | 200ms hold | n/a |
| Reveal count-up | Cubic ease-out, 0 → target | 1200ms | cubic-bezier(0.22, 0.61, 0.36, 1) |
| Reveal ring fill | Concurrent with count-up | 1200ms | cubic-bezier(0.22, 0.61, 0.36, 1) |
| Pace thumb colour shift (tier change) | Color interpolation | 200ms | `easeOut` |
| paceWarning banner appear | Slide down + fade in | 220ms | `easeOut` |
| paceWarning banner dismiss | Slide up + fade out | 160ms | `easeIn` |
| weightSkipped transition | Fade out numeral + ruler, fade in Scale glyph | 300ms | `easeInOut` |
| Data-bridges card connect | Badge fade in (Connected ✓) | 180ms | `easeOut` |
| Progress bar advance | Width expand | 260ms | `easeInOut` |
| Progressive text reveal (Welcome wordmark+tagline, Reveal "Your plan is ready.") | Per-word fade + 8px rise, staggered 70ms/token | 420ms/token | `cubic-bezier(0.22, 1, 0.36, 1)` |

**Progressive text reveal (ENG-720, flag `onboarding_progressive_text`, default-OFF):**

The two onboarding "moment" beats — the Welcome wordmark + italic tagline, and
the Reveal "Your plan is ready." heading — reveal word-by-word: each
whitespace-delimited token fades in and rises `PROGRESSIVE_TEXT_RISE_PX` (8px),
staggered by `PROGRESSIVE_TEXT_STAGGER_MS` (70ms) per token. Numbers live in
`src/lib/motion.ts` (`@suppr/shared/motion`) so web (CSS keyframe +
`animation-delay`) and mobile (Reanimated `withTiming` + `withDelay`) share one
cadence. Shared component: `ProgressiveText` — web
`src/app/components/onboarding/progressive-text.tsx`, mobile
`apps/mobile/components/onboarding/ProgressiveText.tsx`.

**Gating (instant fallback — zero visual change):** the reveal only runs when
the `onboarding_progressive_text` flag is ON **and** the user does not prefer
reduced motion (web `prefers-reduced-motion: reduce`; mobile
`useReduceMotion()` / iOS Reduce Motion). Flag-OFF or reduce-motion renders the
plain text instantly (single node, no per-token markup) — pixel-identical to the
pre-ENG-720 surface. The full phrase is always exposed to assistive tech
(`aria-label` / `accessibilityLabel`), so the staggered visual reveal never
changes what VoiceOver/screen readers announce.

**Haptics (iOS only):**
- Single-select card tap: light impact feedback (`.impactOccurred(.light)`)
- 200ms auto-advance: medium impact (`.impactOccurred(.medium)`)
- Reveal success: `notificationOccurred(.success)` — keep existing
- Danger-tier acknowledgement checkbox toggle: light impact
- "Build my plan" CTA tap: medium impact

---

## 6. Accessibility

- All OptionCards: `accessibilityRole="button"`, `accessibilityState={{ selected }}`, `accessibilityLabel="[Card title]. [Subtitle]."`. Selected state announced as "selected."
- RulerSlider: `accessibilityRole="adjustable"`, `accessibilityValue={{ now, min, max }}`, VoiceOver swipe-up/down changes value by one step.
- Progress bar: `accessibilityRole="progressbar"`, `accessibilityValue={{ now: stepIndex/totalSteps }}`.
- Danger-acknowledgement checkbox: `accessibilityRole="checkbox"`, label includes the full warning text (not just "I understand").
- paceWarning banners: `accessibilityLiveRegion="polite"` so VoiceOver announces tier changes.
- Reveal count-up: animated value must stop animating before focus reaches the numeral for VoiceOver users (use a ref to fire accessibility announcement after animation completes).
- All CTAs: minimum 44×44pt touch targets.
- Colour-only information: every state that uses colour also has a text or glyph signal (the escalating pace-thumb has the `!` / `‼` glyph; paceWarning banners have text; the connected badges have "✓").
- Continue button: `accessibilityLabel="Continue to next step"`.

---

## 7. Empty / loading / error states per step

| Step | Loading | Error | Empty / default |
|---|---|---|---|
| welcome | — | — | Hero photo + CTA |
| signup | Apple button loading indicator | Red banner + error message | Apple button + optional name field |
| goal | — | — | 4 cards, none selected |
| sex | — | — | 3 cards, none selected |
| age | — | — | Stepper at default 28 |
| height | — | — | Slider at default 170cm |
| weight | — | — | Slider at default 72kg / weightSkipped state |
| activity | — | — | 5 cards, none selected |
| pace | — | — | Default pace chip selected; slider at GOAL_DEFAULT_PACE |
| diet | — | — | Allergen pills all inactive; diet cards all unselected |
| strategy | — | — | Goal-default card highlighted "RECOMMENDED", pre-selected |
| reveal | Count-up animation | weightSkipped calibration state | Targets present after count-up |
| data-bridges | Per-card connection loading | Per-card error with "Try again" / "Open Settings" deep-link | All bridges in unconfigured default state |
| completion | "Building your plan…" spinner | Alert "Couldn't save your plan. Try again." | n/a |

---

## 8. Microcopy voice guide

All onboarding copy must pass this filter: **Would a calm, informed friend say this?**

| Anti-pattern | Preferred |
|---|---|
| "You're almost there!" | — (remove; bubbly) |
| "Unlock your full potential" | "Here's what the numbers say." |
| "Based on cutting-edge research" | "Based on Mifflin-St Jeor (NIH / NHS)." |
| "Your personalised journey begins" | "Your plan is ready." |
| "We'll help you hit your goals!" | "Suppr re-calibrates as you log." |
| "Lose weight fast!" | "At 0.4 kg/week, that's a sustainable pace." |
| "You're on track!" | "You're within 200 kcal of your target." |

The voice is: present-tense when showing live data, past-tense when referencing logged history, "estimated" before any calculated number, never a health claim.

---

## 9. Flag gating

All visual or structural changes from this redesign must ship behind a feature flag per the CLAUDE.md non-negotiable rule.

| Change | Flag name (proposed) | Default state | Notes |
|---|---|---|---|
| Welcome hero (editorial photo + Fraunces H1) | `onboarding-welcome-redesign` | OFF | Replace gradient hero |
| Goal/Sex/Activity terracotta glyph + active-fill | `onboarding-card-redesign` | OFF | Can bundle all card steps |
| Strategy live macro preview | `onboarding-strategy-live-macros` | OFF | Additive; requires targets computed before step 11 |
| Pace projected-outcome date | `onboarding-pace-projected-date` | OFF | Additive; `goalWeightKg` heuristic required |
| Pace escalating thumb | `onboarding-pace-caution-thumb` | OFF | Terracotta→amber→red thumb with tier glyph |
| Diet card food thumbnails | `onboarding-diet-thumbnails` | OFF | Editorial dish photos on diet cards |
| Reveal Fraunces numerals | `onboarding-reveal-serif-numerals` | OFF | Kcal + macro tile gram numerals |
| Reveal "How we got here" numbered story | `onboarding-reveal-numbered-story` | OFF | Replaces flat expander text |
| Reveal projected-outcome line | `onboarding-reveal-projected-date` | OFF | Additive; pairs with pace flag |
| Data-bridges section hierarchy | `onboarding-bridges-hierarchy` | OFF | Section header restructure |
| Italic-underline accent phrases | `onboarding-editorial-accent` | OFF | Newsreader italic + underline on H1 emotive phrase |
| Progressive text reveal on Welcome + Reveal beats (ENG-720) | `onboarding_progressive_text` | OFF | Word/clause-staggered fade+rise; registered in `KNOWN_DEFAULT_OFF_FLAGS` (web `src/lib/analytics/track.ts` + mobile `apps/mobile/lib/analytics.ts`). Also gates reduce-motion → instant text fallback (zero visual change). Component: `ProgressiveText` (§5). |

**PostHog ramp protocol:** each flag starts OFF. Target by email condition (Grace only) for initial validation. Verify in sim before any % ramp. Once stable at 100% for 2 weeks with no regression → cleanup PR to remove the gate.

**All `onboarding_*` event names and the `onboarding_v2` flag name are frozen.** The flags above are additive UI flags; they do not change any analytics instrumentation.

---

## 10. Platform parity

| Aspect | Mobile (iOS primary) | Web | Parity status |
|---|---|---|---|
| All 13 steps + logic | Yes | Yes | Parity |
| Narrative side column | No | Yes (`narrative.tsx`) | Intentional divergence |
| Apple Sign-In | Yes | No (email auth) | Intentional divergence |
| Apple Health card | Yes (data-bridges) | No | Intentional divergence |
| Step counter total | N/12 on refresh-plan | N/13 always | Intentional divergence |
| Haptics | Yes (all 5 points above) | No (platform-native) | Intentional divergence |
| Count-up animation | Yes | Yes | Parity |
| Auto-advance single-select | Yes | Verify during implementation | Likely parity |
| Refresh-plan mode (skip welcome/data-bridges) | Yes | Verify web-flow.tsx shell | Flag for explicit parity check |
| Editorial photo (welcome) | Yes | Yes (same image asset) | Parity |
| Fraunces numerals | Yes | Yes | Parity |
| Projected-outcome date (pace + reveal) | Yes | Yes | Parity |
| Escalating pace thumb | Yes | Yes | Parity |
| Strategy live macro preview | Yes | Yes | Parity |

**CLAUDE.md cross-platform rule:** any flag shipped on mobile must land on web in the same commit unless in the intentional-divergence list above.

---

## 11. Items explicitly NOT changed

The following are intentional choices that exceed the best-in-class bar or have been through a sign-off process. This redesign preserves them without modification:

| Item | Reason to keep |
|---|---|
| 200ms auto-advance on single-select | Speed advantage; no comparable has it |
| progress-bar-only counter (no "N/13") | Removes churn anchor; validated 2026-04-30 |
| weightSkipped path end-to-end | Diversity-inclusion sign-off; no comparable matches it |
| 14 regulated allergens | FIC/FSA compliance; every comparable shows fewer |
| 3-tier paceWarning + danger-acknowledgement checkbox | Legal sign-off; exceeds any comparable's safety posture |
| 7700 kcal/kg constant | Pinned by `onboardingTargets.test.ts` + parity tests; change both `targets.ts` and `adaptiveTdee.ts` together or not at all |
| Mifflin-St Jeor formula + activity multipliers + macro g/kg model | Parity-pinned; any formula change requires test re-pinning |
| manual-targets all-4-or-nothing override | Prevents partial overrides producing inconsistent nutrition state |
| session-gated Signup advance (ENG-672) | Prevents state loss on unauthenticated completion |
| `user_tier` never written from client | Tier-lockdown trigger safety; 2026-05-25 fix |
| seed + first-week activation contract (≥5 recipes) | North-star moment requires library to be non-empty |
| `onboarding_*` event names | Live PostHog dashboards; renaming would break historical data |
| `onboarding_v2` flag name (id 648164) | Live rollout data; keep indefinitely |
| `/onboarding-v2` thin redirect | Backwards compat; keep indefinitely |
| `persistOnboarding` result-checked | ENG-792 fix; never silently ignore |
| `canAdvance("signup")` gated on `hasSession` | ENG-672; session arrival owns advancement |
| Adaptive TDEE promise copy on reveal + other steps | Honest; sets correct expectations; re-calibration is real |

---

## 12. FUNCTIONALITY PRESERVED checklist

Every item in the complete functional inventory (Input A) is accounted for below.

### Routes and entry points
- [x] `/onboarding` canonical route (mobile + web)
- [x] `/onboarding-v2` thin redirect → `/onboarding` + `onboarding_v2_redirect_followed` event
- [x] Settings → "Refresh my plan" (AsyncStorage flag → refresh mode)
- [x] `isRefreshPlan` auto-skip of welcome + data-bridges; N/12 display on mobile
- [x] `GestureHandlerRootView` wrapper (mobile shell — not a visual change)

### 13 steps and auto-skip logic
- [x] Step 01 Welcome — auto-skipped when `isRefreshPlan` or authed
- [x] Step 02 Signup — auto-skipped when session exists; advance owned by session arrival
- [x] Step 03 Goal — 4 options, auto-advance 200ms
- [x] Step 04 Sex — 3 options + midpoint-estimate, auto-advance 200ms; expander + privacy footer
- [x] Step 05 Age — `MobileNumberStepper` range 14–100 default 28; expander
- [x] Step 06 Height — `RulerSlider` metric/imperial; unit segmented control
- [x] Step 07 Weight — `RulerSlider` metric/imperial; `weightSkipped` path with pulsing Scale
- [x] Step 08 Activity — 5 options + Mifflin multipliers; auto-advance 200ms
- [x] Step 09 Pace — auto-skipped for `goal==="maintain"` or `weightSkipped`; presets + slider + live projection card + 3-tier safety warning + danger-acknowledgement checkbox
- [x] Step 10 Diet — 10 diet cards (Anything goes mutual-exclusive) + 14 regulated allergens
- [x] Step 11 Strategy — 4 cards + goal-derived RECOMMENDED badge + methodology note
- [x] Step 12 Reveal — count-up ring + 3 macro tiles + BMR/TDEE + expander + "What happens next" + weightSkipped fallback
- [x] Step 13 Data-bridges — manual targets (all-4-or-nothing) + Apple Health (iOS) + notifications + Reel-import tease + MFP CSV import; "Build my plan" CTA; auth guard on completion

### Target calculation (all values pinned)
- [x] Mifflin-St Jeor BMR formula: `10·weight + 6.25·height − 5·age ± sex_constant`
- [x] Sex midpoint: average of male/female constants
- [x] Input clamps: weight 30–350kg, height 100–250cm, age 13–100
- [x] TDEE = `round(BMR × ACTIVITY_MULTIPLIERS[activity])` (1.2 / 1.375 / 1.55 / 1.725 / 1.9)
- [x] kcalAdj = `round(paceKgPerWeek × 7700 / 7)` — `KCAL_PER_KG = 7700`
- [x] Target = TDEE + kcalAdj
- [x] Macro models: high_protein / high_satisfaction / low_carb / balanced (all g/kg values, fat%, fiber formula preserved)
- [x] Goal → strategy default mapping: lose→high_satisfaction, recomp→high_protein, gain→high_protein, maintain→balanced
- [x] Returns null when `weightSkipped` or required inputs missing

### Pace safety floor (legal)
- [x] Floor values: male 1500, female 1200, unspecified 1350 kcal
- [x] danger tier (`below_floor`): red banner + NHS/NIH sources + danger-acknowledgement checkbox required
- [x] warn tier (`fast_loss`): weekly loss > 1% bodyweight → amber banner
- [x] info tier (`near_floor`): target within floor+200 → brand-tint banner
- [x] Soft-warn philosophy: NEVER hard-block on kcal alone (only danger-acknowledgement gates advance)

### Completion / persistence
- [x] Auth guard on `handleComplete` — unauthed → back to Signup, state intact
- [x] `persistOnboarding` result checked — `!ok` throws user-visible error
- [x] `buildProfileUpsertRow` — all mapping rules preserved (goal→cut/bulk/maintain, pace presets, `pace_kg_per_week`, `user_tier` NEVER written, `target_calories_source: "onboarding"`, `prefer_activity_adjusted_calories: true`)
- [x] `selectOnboardingSeeds` → default seeds (diet/allergen filtered) + `onboarding_default_seeds` kill-switch
- [x] Default 5 seeds: berry-overnight-oats, lemon-dill-salmon, mediterranean-chicken-bowl, chickpea-coconut-curry, mushroom-risotto
- [x] `resolveSeedsToRecipeIds` → `saveResolvedSeeds` → `buildFirstWeekFromSeeds` → `generateSmartPlan` → `save_meal_plan` RPC
- [x] `onboarding_completed` event with all properties: flow, weight_skipped, goal, recipes_picked, recipes_resolved, recipes_saved, plan_built, used_default_seeds, data_bridge_chosen, manual_targets_set
- [x] AsyncStorage clear + `suppr.reset-plan-pending-prompt` read
- [x] Refresh-plan "Keep my logs / Clear" alert
- [x] Navigate `/(tabs)?onboarding_complete=1` (+ `firstRun=1` / `refresh=1` / `plan_build=failed`)
- [x] `recordGoalHistory` baseline row (fire-and-forget, dedup)

### Data-bridges (all five)
- [x] Manual targets: 4 inputs (kcal/P/C/F), all-4-or-nothing, `dataBridgeChosen:"manual"`, `onboarding_data_bridge_chosen {option:"manual"}`
- [x] Apple Health (iOS only): `requestHealthPermissions` → `syncHealthData` → `healthGranted`, "Open Settings" deep-link
- [x] Notifications: `expo-notifications`, `registerExpoPushTokenForUser`, `markNotificationsPromptDismissed`, Expo-Go error path
- [x] Recipe URL: informational only, no interaction change
- [x] MFP CSV import: `MobileMfpCsvImportCard surface="onboarding"` — no logic change

### Analytics events (all frozen)
- [x] `onboarding_step_completed` on Welcome CTA
- [x] `user_signed_up {method:"apple", platform:"mobile"}`
- [x] `onboarding_v2_redirect_followed` (on thin redirect)
- [x] `onboarding_completed` (with all properties)
- [x] `onboarding_data_bridge_chosen {option:"manual"|"apple-health"}`
- [x] `onboarding_v2` PostHog flag (id 648164) — name frozen

### Behavioural mechanisms
- [x] Adaptive TDEE promise copy on Reveal + activity/age/sex/strategy steps
- [x] Seed library + first-week activation contract (≥5 recipes for north-star)
- [x] Reminders opt-in (2/week max, evening + Sunday)
- [x] Apple Health day-1 active-energy sync
- [x] AsyncStorage (mobile) / localStorage (web) state persistence — survives force-quit
- [x] No "AI" framing anywhere; deterministic formula language; "estimated" throughout

### Free vs Pro gating
- [x] No gate anywhere in the 13-step funnel — entire flow runs pre-tier
- [x] `user_tier` never written from client

### Web vs mobile parity
- [x] All intentional divergences documented and preserved (narrative column, auth rail, Apple Health card, step counter on refresh-plan, haptics)
- [x] All parity items (steps, logic, calculation, events) confirmed identical by construction (shared `src/lib/onboarding/`)

---

## 13. Open items (require Linear tickets before implementation)

The following are additive features noted in this spec that are not currently implemented and need Linear issues before any code work begins:

1. **Projected-outcome date on Pace step** — heuristic `goalWeightKg` from 12-week forward projection. Requires small additive change to `pace.tsx` state + `PACE_PRESETS` context. Tag: `onboarding-pace-projected-date` flag.
2. **Projected-outcome date on Reveal step** — same calculation, surfaces in Reveal. Requires change to `reveal.tsx`. Tag: `onboarding-reveal-projected-date` flag.
3. **Strategy live macro preview** — P/C/F gram preview row on each strategy card, computed from current `targets`. Requires `targets` to be available before step 11 (it is — `computeV2Targets` runs reactively on state change). Tag: `onboarding-strategy-live-macros` flag.
4. **Diet card food thumbnails** — requires editorial dish photography assets per diet type (10 images). Tag: `onboarding-diet-thumbnails` flag.
5. **Escalating pace thumb** — colour interpolation + glyph on thumb as paceWarning tier changes. Pure visual; no logic change. Tag: `onboarding-pace-caution-thumb` flag.
6. **Web refresh-plan parity audit** — verify `web-flow.tsx` shell handles `isRefreshPlan` identically to mobile (noted as medium-confidence in inventory). Needs a focused parity read.

None of these are blockers for the visual redesign flags (typography, card active states, reveal numerals). They can be sequenced independently.
