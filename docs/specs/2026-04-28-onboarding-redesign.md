# Onboarding v2 visual refit — design spec

**Phase 6 P1.** Cross-platform visual language for v2 onboarding (15 steps). Web v2 (`src/app/components/onboarding-v2/`) and the future mobile v2 port both inherit. Legacy `apps/mobile/app/onboarding.tsx` is **out of scope** — see `docs/planning/2026-04-28-onboarding-v2-mobile-port-plan.md`.
**Authority:** production design spec §1.2 (type), §1.3 (depth), §1.5 (icons), §1.7 (voice); strategic direction D-2026-04-27-12 (always-show TDEE), D-2026-04-27-14 (≥5 recipes seeded).
**Source:** visual-qa pixel-level audit finding #2.

---

## 1. Design intent

Onboarding is the user's first read of Suppr. It should feel like the rest of the product — calm, premium, fast, restrained — not like a separate flow stitched together. The drift documented (Ionicons, `fontWeight: "900"`, `borderWidth: 2` cards, invisible back button) is exactly the failure mode to design out: each one is a tell that onboarding hasn't been held to the same bar as Today / Recipes / Plan / You.

User is here to do one job — set their target — and end with a populated working artefact. Every screen should feel like one step of one well-paced conversation, not 15 disconnected forms.

---

## 2. Step shell — canonical layout every step inherits

### Mobile

```
┌─────────────────────────────────────────┐ ← safe-area top
│ [<-]                          [Skip]    │ 56pt nav bar
│ ━━━━━━━━━━━━━──────────                  │ 4pt progress rail
│                                          │
│ STEP 04 OF 15                            │ Type.label, text-tertiary
│ Tell us about you                        │ Type.title (24/28/700/-0.02em)
│ We'll use this to calculate your         │ Type.bodyMuted, 8pt below title
│ personal calorie budget.                 │
│                                          │ 24pt gap to input area
│ [ Primary input area ]                   │
│                                          │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────┐    │
│ │       Continue                   │    │ Sticky CTA, 56pt, --primary
│ └──────────────────────────────────┘    │
└─────────────────────────────────────────┘ ← safe-area bottom + 12pt
```

**Region rules:**
- **Nav bar 56pt** — Back button left (40×40 hit, 24pt glyph), Skip right (44pt hit, Type.body 500 text-tertiary). No title in nav bar.
- **Progress rail 4pt height, 99pt radius** — track `--border`, fill `--primary`, width tweens 350ms `--ease-pm`.
- **Eyebrow** Type.label "STEP N OF 15", 16pt below progress. Hidden on `welcome` and `reveal` (special layouts).
- **Title** Type.title (24/28/700/-0.02em), 8pt below eyebrow. Single sentence.
- **Body** Type.bodyMuted, 8pt below title. 1–2 lines max. Optional.
- **Input area** 24pt below body. Region-specific (§5).
- **Sticky CTA** bottom of viewport, padded by safe-area + 12pt. Full-width Primary, 56pt, Type.headline. Disabled state opacity 0.4. Auto-advance steps hide the CTA entirely.

### Desktop web ≥1024px

Same regions, recomposed:
- 560px column on `var(--background)` (NOT pure white)
- Top bar 64px (Back left, Suppr wordmark centred opacity 0.6, Skip right)
- Progress rail spans the column, 4px
- Title at 1.75rem (28px) per ladder
- CTA NOT sticky — sits 32px below input area
- **No card behind the form** (full-bleed Surface tier; wrapping in SupprCard adds depth that competes with inputs)

### Spacing rules (both)

4pt grid throughout. Block-to-block: 24pt. Within block: 8pt label→input, 12pt between same-tier inputs, 16pt between input groups. **No literal numbers.**

---

## 3. Title typography — replaces fontWeight: "900"

`fontWeight: "900"` doesn't exist on iOS as a system weight (SF Pro caps at 800/Heavy); fallback reads as visual heaviness rather than hierarchy.

**Replace with the Type ladder:**

| Role | Token | Mobile | Web | Use |
|---|---|---|---|---|
| Step title | `Type.title` | 24/28/700/-0.5 | `1.75rem`/1.2/700/-0.02em | Question/imperative each step |
| Step body | `Type.bodyMuted` | 14/20/400/0 | `0.9375rem`/1.5/400/0 | Explanatory paragraph |
| Eyebrow | `Type.label` | 11/14/700/+0.88 | `0.6875rem`/1.3/700/0.08em uppercase | "STEP 04 OF 15", "★ LAST STEP" |
| Caption | `Type.caption` | 11/14/500/0 | `0.6875rem`/1.4/500/0 | Helper, hint, "Optional" |
| Reveal hero (mobile) | `Type.ringValue` | 36/36/700/-0.7 + tabular-nums | clamp(48px, 6vw, 72px)/1.05/700/-0.02em + tnum | Step 12 reveal — "2,100" kcal |
| Reveal hero (desktop) | `Type.ringValueLg` | 56/56/700/-1.2 + tabular-nums | `4.5rem`/1/700/-0.02em + tnum | Reveal step desktop only |

**Ladder rationale.** Step title earns weight via spacing and tracking, NOT weight inflation. `Type.title` 24/700/-0.02em is the same token Today and Recipes use — onboarding feels like the same product.

**Lint sweep:** zero matches in onboarding-v2 trees for `fontSize: 26`, `fontSize: 28`, `fontSize: 48`, `fontWeight: "900"`, `fontWeight: "800"` (except reveal hero).

---

## 4. Card depth — replaces borderWidth: 2

Three border weights for three near-identical surface tiers — heaviness goes UP on the most important card, the wrong gradient (heavier border = cheaper, not more important).

**Replace with elevation system:**

| Element | Tier | Border |
|---|---|---|
| Page background | Surface | none |
| Single-select cards (goal, sex, activity, pace, strategy) | Card | 1px `cardBorder` (NOT 2px, NOT 1.5px) |
| Single-select — **selected** | Card-selected | 1.5px `Accent.primary` + bg `rgba(76,108,224,0.08)` (new `--primary-soft` token) |
| Multi-select chips (diet) | Card-flat | 1px `cardBorder`, no shadow |
| Multi-select — **selected** | Card-flat-selected | 1px primary + bg `--primary-soft` + label 700 |
| Text input | Card-input | bg `inputBg`, no border |
| Text input — **focused** | Card-input-focused | 1.5px primary outset ring (mobile) / 2px ring outline (web) |
| Recipe-picker tile (Surface F) | Card | 1px |
| Recipe-picker — **selected** | Card-selected + `Check` 12pt overlay on thumb | 1.5px primary |

**No `borderWidth: 2` anywhere in onboarding.** Selected-state weight comes from bg tint + 1.5px primary border, not thicker line. Shadow is the depth signal.

### Selected-card anatomy (single-select)

Unselected: 16pt radius, 16pt internal padding, bg `colors.card`, 1px `cardBorder`, shadow `Elevation.card`, label Type.body 500.

Selected: same radius/padding, bg `--primary-soft`, 1.5px `--primary`, shadow `Elevation.card` (no `floatPrimary` — bg + border is enough), label Type.body 600 `--primary`. `Check` 16pt fades in top-right over 200ms `--ease-pm`. `selection` haptic.

Disabled: opacity 0.5, no shadow, no haptic.

---

## 5. Back button — visible, accessible, global

Legacy: `backBtn` is a chevron with no bg, no border, no fill — invisible at arm's length.

**Global Back affordance — used here and everywhere else in app:**

| Property | Mobile | Web |
|---|---|---|
| Hit area | 40×40pt | 40×40px (44 coarse-pointer) |
| Visible shape | 40×40 circle, bg `rgba(0,0,0,0.04)` light / `rgba(255,255,255,0.06)` dark (new `--nav-button-bg` token) | same |
| Glyph | lucide `ChevronLeft` 20pt (`IconSize.xl`), `colors.text` | lucide `ChevronLeft` 20px, `var(--foreground)` |
| Hover (web) | n/a | bg → `rgba(0,0,0,0.08)`/`rgba(255,255,255,0.10)` over 120ms |
| Focus (web) | n/a | `outline: 2px solid var(--ring); outline-offset: 2px` |
| Press (mobile) | scale 1 → 0.95 over 100ms | n/a |
| Disabled (step 0) | opacity 0.4, no tap | same |
| a11y label | "Back" / `aria-label="Go back to previous step"` | same |

This becomes the canonical `<NavBackButton>` primitive — retires per-screen back-button reimplementations app-wide (also fixes Recipe detail's hardcoded white floating buttons documented by visual-qa).

**Skip button** sits next to it. Ghost button, no bg, Type.body 500 `text-secondary`. Tapping Skip from non-trivial step (`weight`, `pace`, `strategy`) → confirm sheet "Skip and use defaults? You can change everything later in You → Targets." On `welcome`, `signup`, `goal`, `sex`, `age`, `height` Skip is hidden.

---

## 6. Per-step layout patterns (7 canonical)

### 6.1 Welcome (step 01)

Special — no eyebrow, no progress rail. Suppr wordmark top-centre. Hero block centred: lucide `Sparkles` 32pt `--primary` above Display-tier title. **Mobile copy "Plan, cook, hit your macros."** / **Web "Join the Suppr Club"** (intentional divergence per `project_onboarding_welcome_divergence.md`). Type.body sub-line: "Two minutes to set up. You'll end with a working week, not just a target." Primary CTA: "Set my targets". Secondary text-button: "I have an account →".

### 6.2 Single-select cards (7 of 15 steps)

Stacked column of Card-tier options, 12pt gap. Mobile full-width; web 560px column. Each card: label (Type.body 500) + description (Type.caption text-secondary), left-aligned. Optional leading IconBox 32×32 with lucide glyph 16pt.

**Auto-advance on selection** — no Continue CTA. Selection haptic + 350ms transition.

Pace card adds sub-affordance: on select, branded-slider reveals below (200ms slide-down). Pace is the only step where auto-advance is held — user taps Continue after adjusting slider.

### 6.3 Multi-select chips (diet step 10)

Wrap-grid of chip primitives, 8pt gap. Mobile 36pt height / web 32px. Unselected: bg `card`, 1px `cardBorder`, label Type.body 500. Selected: bg `--primary-soft`, 1px `--primary`, label Type.body 600 `--primary`, optional `Check` 12pt leading. Selection haptic on every tap. No auto-advance.

### 6.4 Slider (pace, when revealed by 6.2)

Track 6pt height, Radius.full, bg `border`. Fill `--primary`. Thumb 28pt circle bg `--primary`, white inner dot 12pt, `Elevation.float`.

Range labels above track at min/current/max — Type.caption tabular-nums "0.25 kg/wk" etc.

Live preview card below: Type.body 500 "≈ 2,100 kcal/day · reach goal by 12 Aug 2026", updates real-time.

**Pace safety floor warning** — when below floor, inline `<TrustChip>` `estimated`-styled warning chip "We'd recommend a slower pace. Continue if you've discussed with a clinician." 200ms fade-in. **Non-blocking** (state.ts contract).

### 6.5 Number stepper (age, weight, height)

Single primary input, very large. Mobile 60pt / web 56px height. Type.title text in `inputBg`-tinted bg, no border, centre-aligned, tabular-nums. Unit suffix Type.body text-secondary.

Unit toggle above: SegmentedControl (the existing primitive — kg/lb/st, cm/ft).

Inline validation: under input, Type.caption red `--destructive` "Enter a value over 30 kg" if invalid (on blur, not every keystroke).

### 6.6 Recipe picker grid (step 15 — Surface F)

Eyebrow `Type.label` + lucide `Sparkles` 12pt `--primary` "★ LAST STEP". Title `Type.title` "Pick 5 recipes you'd actually cook." Body `Type.bodyMuted` "We'll seed your library and build your first weekly plan from these. Change everything later."

Grid: mobile 2-col gap 8pt / web 3-col gap 12px. Each tile is Card-tier (no border weight inflation): 12pt radius, image-bleed top, 8pt H pad. Title Type.body 500 1-line truncate, kcal Type.caption tabular-nums.

Selected: Card-selected treatment + `Check` 16pt overlay (white-circle 24pt bg + `--primary` glyph) top-right of thumb.

Counter pinned above CTA: Type.caption tabular-nums "4 of 5 picked". When `n >= 5`, colour swaps to `--success`.

Primary CTA "Build my first week" — disabled until ≥5. Tap → success haptic + 600ms loader "Building your week…" → router.replace to Today.

### 6.7 Permissions (step 13)

Two cards stacked. Each: leading IconBox 32×32 (lucide `Bell`/`Camera`), title Type.body 600, description Type.caption text-secondary, trailing primary "Allow" button (40pt, ghost). On grant: → `Check` + "Allowed" Type.caption `--success`. On deny: → "Skipped" Type.caption text-tertiary.

**Web variant:** explainer-only with auto-advance after 2s ("Notifications come from the mobile app — you'll set them up there.").

### 6.8 Reveal (step 12 — "the aha moment")

Hero step. No eyebrow. Top-spaced lucide `Sparkles` 24pt `--primary` centred. Type.label "YOUR DAILY TARGET". Hero number Display-tier (mobile 32/36/800/-0.02em + tabular-nums; web clamp(48px, 8vw, 72px)) e.g. "**2,100**". Below: Type.body 500 "kilocalories per day".

`<ConfidenceChip>` "medium confidence" (neutral — D-2026-04-27-12 always-on, confidence is metadata not gating).

Macro split breakdown 24pt below: 4 cells in flex-row, each Type.caption label + Type.body tabular-nums value + 4pt fill bar in macro colour.

Engine commentary Type.bodyMuted text-secondary "We've based this on your weight, height, age, and activity. Adjust later in You → Targets."

Primary CTA "Looks right →".

Motion: hero number eases in over 350ms `--ease-spring-soft` from scale 0.92 → 1; macro cells stagger fade-in 80ms each (P → C → F → Fibre).

---

## 7. Iconography — lucide replacements

Spec §1.5 mandates lucide. Sweep:

| Ionicon | Lucide | Size |
|---|---|---|
| `chevron-back` | `ChevronLeft` | 20pt |
| `chevron-forward` | `ChevronRight` | 16pt |
| `time-outline` / `time` | `Clock` | 16pt or 24pt (hero) |
| `checkmark-circle` | `CheckCircle2` | 24pt |
| `flame` | `Flame` | 16pt |
| `restaurant` | `UtensilsCrossed` | 16pt |
| `sparkles` | `Sparkles` | 24pt (hero) |
| `bell` | `Bell` | 16pt |
| `camera` | `Camera` | 16pt |
| `mail-outline` | `Mail` | 16pt |
| `body` (anatomy) | `User2` | 24pt |
| `barbell` | `Dumbbell` | 16pt |
| `walk` | `Footprints` | 16pt |
| `bicycle` | `Bike` | 16pt |
| `car-sport` | `Armchair` | 16pt |

Pick from `IconSize` (xs=10, sm=12, md=14, base=16, lg=18, xl=20, hero=24). No off-grid.

**Colour rule:** icons inherit `currentColor` on web; on mobile pass `colors.text`/`colors.textSecondary`/`Accent.primary` explicitly — never literal hex.

---

## 8. New tokens

### Mobile theme.ts

```ts
Colors.light: {
  primarySoft: 'rgba(76, 108, 224, 0.08)',     // selected card bg, chip selected bg
  primaryStrong: 'rgba(76, 108, 224, 0.16)',   // hover on web; press on mobile
  navButtonBg: 'rgba(0, 0, 0, 0.04)',          // 40×40 circle Back/Close button
  navButtonBgHover: 'rgba(0, 0, 0, 0.08)',     // web only
}
Colors.dark: {
  primarySoft: 'rgba(108, 140, 255, 0.12)',
  primaryStrong: 'rgba(108, 140, 255, 0.20)',
  navButtonBg: 'rgba(255, 255, 255, 0.06)',
  navButtonBgHover: 'rgba(255, 255, 255, 0.10)',
}
```

### Web theme.css

```css
--primary-soft: rgba(76, 108, 224, 0.08);
--primary-strong: rgba(76, 108, 224, 0.16);
--nav-button-bg: rgba(0, 0, 0, 0.04);
--nav-button-bg-hover: rgba(0, 0, 0, 0.08);
.dark { --primary-soft: rgba(108, 140, 255, 0.12); ... }
```

### New components

- `<NavBackButton>` — `src/app/components/ui/NavBackButton.tsx` + `apps/mobile/components/ui/NavBackButton.tsx`. Consolidates per-screen back buttons app-wide.
- `<OnboardingShell>` — `src/app/components/onboarding-v2/OnboardingShell.tsx` + mobile equivalent. Wraps every step in canonical shell.
- `<RecipePickerTile>` — image-bleed tile + selected overlay.

### Components to retire from onboarding

- Legacy `OptionButton` (`borderWidth: 1.5`) → spec'd Card-tier single-select card
- Legacy plan card (`borderWidth: 2`) → same
- Every `Ionicons` import → lucide
- Hardcoded `"#fff"` → `colors.primaryForeground` / `var(--primary-foreground)`
- `fontWeight: "900"` on `budgetNumber` → `Type.ringValue` (mobile) / clamp() (web)
- `fontWeight: "800"` on `heading`, `planTitle`, `projDate` → `Type.title` (700)

---

## 9. Acceptance criteria

1. **Zero Ionicons imports** in `apps/mobile/app/onboarding-v2/**` and `src/app/components/onboarding-v2/**`. Grep returns empty.
2. **Zero `fontWeight: "900"`** in onboarding-v2.
3. **Zero `fontWeight: "800"`** outside reveal hero number (one match allowed; documented).
4. **Zero `borderWidth: 2`** in onboarding-v2 styles.
5. **Zero hardcoded `"#fff"` / `"#ffffff"`** in onboarding-v2.
6. **Zero ad-hoc `fontSize:` literals** outside Type ladder values (11/14/15/17/24/28/32/36/56). Lint enforced.
7. **Back button visible at first paint** — bg `--nav-button-bg`, 40×40 hit, 20pt lucide `ChevronLeft`.
8. **Back button has accessible label** "Back" or "Go back to previous step".
9. **Every step renders the canonical shell** — Back + Skip in nav bar, progress rail, eyebrow + title + (optional body), input area, sticky/inline CTA.
10. **Selected state on cards uses 1.5px primary border + bg `--primary-soft`** — never thicker.
11. **Welcome step copy diverges intentionally** — mobile vs web — sync-enforcer carve-out documented.
12. **Reveal hero number renders with tabular-nums** — verified.
13. **Reduce-motion path tested** — every transition has instant fallback.
14. **Touch targets ≥44pt mobile / 36px web** on every interactive element.
15. **Focus-visible ring on web** on every interactive element.
16. **Pace safety floor warning is non-blocking** — `canAdvance("pace", state)` returns true; only chip renders.
17. **All seven states designed and rendered** for recipe picker / slider / multi-select / number stepper / reveal — visual-qa pass with each state forced.
18. **Mobile parity for future v2 port** consumes the same `<OnboardingShell>` / `<NavBackButton>` patterns.
19. **Sync-enforcer green** on parity except documented carve-outs (welcome copy, permissions step rendering, sticky vs inline CTA).
20. **Visual-qa pixel-level pass** — no Ionicons, no `borderWidth: 2`, no `fontWeight: "900"`, visible Back, lucide-only iconography, Type ladder honoured.

---

## 10. Open questions

- **O-1.** Welcome Display-tier title size on mobile — 32pt vs 28pt at 6.1" iPhone. Visual-qa A/B test.
- **O-2.** Skip-confirm sheet on `pace` step — overkill? Default this spec assumes yes.
- **O-3.** Permissions on web — auto-advance vs skip the step entirely. customer-lens / journey-architect to call.
- **O-4.** Reveal macro breakdown — needed or noise? Test post B3.3 cohort expansion.
- **O-5.** Recipe-picker minimum count — D-2026-04-27-14 has flag-driven 5 vs 3 vs 1-with-apologetic-copy. nutrition-engine to confirm before build.
- **O-6.** `Type.title` 24pt vs 26pt (legacy ships 26). Holding to 24pt per ladder; visual-qa to verify doesn't read undersized.

---

## Routing

- **executor** — implement against this spec.
- **legal-reviewer** — review safety-floor warning copy + pace-confirm sheet copy.
- **nutrition-engine** — confirm O-5 + engine commentary line in §6.8.
- **sync-enforcer** — log new carve-outs (permissions step rendering, sticky vs inline CTA).
- **qa-lead** — define tests for state matrix + acceptance criteria.
- **analytics-engineer** — add `onboarding_back_pressed` and `onboarding_skip_confirmed` events.
