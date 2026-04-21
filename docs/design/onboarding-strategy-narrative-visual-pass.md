# Onboarding Strategy + Narrative visual pass — design brief (D2, Option 1)

Grace picked Option 1: keep both Strategy and Narrative. Both currently feel like live additions rather than prototype-native steps. This brief specs the visual delta to bring them up to the prototype's step aesthetic (`docs/ux/claude-design-bundles/onboarding/project/design/steps.jsx`).

## 1. Design intent

Strategy and Narrative should feel like they were always in the onboarding flow. The prototype's step language is: StepHeader overline + big title + soft subtitle + stack of OptionCards or a single hero block. No ornate frames, no "marketing" breadcrumbs, no duplicated progress indicators. This brief is about making these two steps disappear into that language.

## 2. Current state audit

### Strategy — `src/app/components/onboarding-v2/steps/strategy.tsx`

What already matches prototype:
- Uses `StepBody` + `StepHeader` with `useStepOverline` (good).
- Stack of `OptionCard` with icon + title + subtitle (good).
- "Recommended" inline badge on the goal-derived option (good — this is a live-only flourish but prototype-compatible).

What doesn't match:
- Subtitle copy is functional but longer than prototype norm. Prototype subtitles are ≤ 90 chars, single sentence, no em-dash action verbs.
- Subtitle microcopy: "We've highlighted the one that fits your goal — tap a different card to override." Reads instructional. Prototype language would be: "Pre-picked from your goal. Tap to override."
- "Recommended" pill uses `bg-primary/10` + `text-primary`. Prototype equivalent (see `steps.jsx` pace presets) uses `bg-primary/15` with a slightly tighter 10px uppercase letter-spacing 0.1em. Bring inline with that.
- Card subtitles are 2× em-dashed ("~2.2 g/kg — muscle-building leaning"). Prototype uses comma rhythm, not em-dashes, in option subtitles. Rewrite per §4.
- No `MethodologyNote` beneath. Prototype uses `MethodologyNote` whenever the step surfaces a computed number or a rule-of-thumb. Strategy chooses a macro split; one `MethodologyNote` explaining the split earns its place.

### Narrative — `src/app/components/onboarding-v2/narrative.tsx`

Narrative is not a step — it's the left-column eyebrow + headline + body content the web split layout reads per step. The "visual pass" here is about the tonal match of the narrative copy to the prototype voice.

What matches:
- Structure (eyebrow + head + body) is prototype-native.
- Eyebrow uses "Step NN · Topic" pattern (matches prototype StepHeader overline style).

What doesn't match:
- Step-number drift: prototype is 13 steps total; Narrative eyebrows currently number up to "Step 14 · Try it" (Import). Renumber to the prototype's canonical 13.
- Tone: several narrative bodies are longer than prototype norm (sex: 2 sentences + spec; pace: 2 long sentences). Prototype narrative on the reveal step is ~2 sentences max, rhythm over detail. Tighten per §4.
- `NarrativeStat` BMR/TDEE tiles on `reveal`: styled with `.text-2xl` + `tracking-tight` but don't match the prototype's `MacroTile` / BMR-TDEE tile pair (see `steps.jsx:914-927`). Specifically: prototype uses 10px uppercase label, 18px bold value with inline 11px muted unit, 14px padded card. Current web narrative uses 10px label (match) but 24px bold value without the inline unit rhythm. Align to prototype spec.

## 3. The delta (bucketed)

### Keep as-is
- Strategy: StepBody + StepHeader scaffold.
- Strategy: OptionCard stack with icons.
- Strategy: "Recommended" badge placement on the goal-derived row.
- Narrative: per-step eyebrow/head/body structure.
- Narrative: split-layout left-column placement.

### Adopt from prototype
- Strategy: add `MethodologyNote` below the option stack: "Macro ratios are a starting point. Suppr recalibrates protein and carbs as you log and weigh in." (matches tone of `steps.jsx:929-933`).
- Strategy: rewrite the "Recommended" pill to `bg-primary/15 text-[10px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded`.
- Narrative reveal extras: rewrite `NarrativeStat` to mirror `steps.jsx:920-926` — label 10px uppercase, value 18px bold with inline 11px `kcal` muted unit, 14px padded card, two-column grid with 14px gap. No `text-2xl`.

### Swap in place
- Strategy subtitle: "Pre-picked from your goal. Tap to override." (was: "We've highlighted the one that fits your goal — tap a different card to override.")
- Strategy option subtitles (rewrite — no em-dashes, prototype comma rhythm):
  - Balanced: "Even split, flexible across cuisines."
  - High protein: "~2.2 g/kg, muscle-building leaning."
  - High satisfaction: "Filling meals, easier in a deficit."
  - Low carb: "Carbs minimised, fat-led."
- Narrative eyebrows: renumber to canonical 13-step count. If Strategy is in the final list at position 11, eyebrows become: signup 02, goal 03, sex 04, age 05, height 06, weight 07, activity 08, pace 09, diet 10, strategy 11, reveal 12, permissions 13. Drop "Step 14" for import (the prototype treats it as the reveal-after; verify with `journey-architect`).
- Narrative `sex.body` — tighten from 2 sentences to 1: "Male vs female shifts basal metabolic rate by ~166 kcal/day. Only affects calories."
- Narrative `pace.body` — tighten: "Now that we know your body, we can translate pace into a daily target. We'll flag anything below the safety floor — change pace anytime in Settings."

## 4. Visual spec

Spacing / type are already tokenised; no new tokens. Specifics:

- StepHeader title: 28px bold, `-0.025em` tracking, `text-wrap: balance`, `line-height: 1.15`. (matches `steps.jsx:18-23`.)
- StepHeader subtitle: 14px, 1.55 line-height, `text-muted-foreground`, `text-wrap: pretty`.
- OptionCard gap: 10px between cards (Strategy currently uses `gap-2.5` which is 10px — match).
- MethodologyNote: 12px padding, 12px border-radius, `bg-primary/6` (matches `steps.jsx:1243-1251`), 11px body, 1.55 line-height, inline `Sparkles` 13px primary icon at the head.
- NarrativeStat (reveal extras): 14px padded card, 10px uppercase label (0.1em tracking, muted), 18px bold value with `-0.02em` tracking and tabular-nums, inline 11px muted unit offset 4px left. Grid `grid-cols-2` gap-3 (12px).

## 5. States

Strategy:
- Loading — unchanged (context provides targets; step itself is instant).
- Empty selection — falls back to recommended (goal-derived). Card has a pre-selected visual even if `state.nutritionStrategy == null`.
- Error — N/A (client-only).

Narrative:
- Per-step narrative block absent → left column collapses to brand mark only (existing web-split behaviour).
- Reveal narrative when `targets == null` — omit the NarrativeStat extras block entirely (current behaviour, confirmed correct).

## 6. Cross-platform deviations

- Strategy: mobile and web both render the card. Mobile places `MethodologyNote` at the bottom inside StepBody; web renders it below the cards in the right column. No copy divergence.
- Narrative: web-only by design (mobile doesn't have the split-layout left column). No change here. Retain as web-only — not a parity break, an intentional surface asymmetry documented in `docs/decisions/`.

## 7. Acceptance criteria

1. Strategy subtitle and 4 option subtitles rewritten per §3.
2. "Recommended" pill updated to prototype spec (`bg-primary/15`, 10px bold uppercase, 0.1em tracking).
3. `MethodologyNote` added below the Strategy option stack with the §3 copy.
4. Narrative eyebrows renumbered to canonical 13-step count; `journey-architect` confirms the step map.
5. Narrative `sex.body` and `pace.body` tightened per §3.
6. Narrative `NarrativeStat` restyled to match prototype BMR/TDEE tile pair (18px value with inline unit, 14px padding, 10px uppercase label).
7. No new tokens introduced; no new components.
8. Strategy step passes a11y: "Recommended" pill is announced as part of the option title; OptionCard remains a single button per row.
9. Visual QA screenshot diff on `/onboarding/v2/strategy` and `/onboarding/v2/reveal` shows the updated tile/pill styling matches the prototype reference.

## 8. Open questions

- Narrative step count — is the canonical 13 still right post-Strategy keep? Route to `journey-architect` for the authoritative map.
- Should `MethodologyNote` on Strategy render on mobile (shorter screen)? Recommendation: yes — it's 2 lines, earns its keep; but verify on small devices.
- Does `product-memory` want the intentional web-only Narrative divergence captured as a decision doc? Recommend yes — mirrors the D1 Welcome divergence carve-out (`docs/decisions/2026-04-21-onboarding-welcome-copy-platform-divergence.md`).
