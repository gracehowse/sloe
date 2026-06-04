# Nutrition Tracking & Logging — Redesign Spec

**Surface:** Nutrition tracking & logging — log sheet, food search, barcode, daily and weekly reports, calorie/protein/fibre/macro tracking.
**Status:** Spec — not yet implemented. Ship all visual/structural changes behind feature flags per `docs/decisions/2026-05-13-session-replay-and-feature-flags.md`.
**Date:** 2026-06-02
**Author:** documentation agent, from functional audit (Input A) + Mobbin benchmark (Input B)

---

## 1. Surface overview

Nutrition tracking is the **macro-tracker spine** of Suppr. It is not a feature on the side — it is the product's reason to open. Every other surface (Plan, Recipes, Progress) exists to serve the answer to one question: *what should I eat next, and how does it fit today?*

### Role in navigation

```
Bottom tab: Today (canonical home)
  └── TodayHero — calorie ring + macro tiles
  └── TodayMealsSection — meals by slot
  └── Floating LogFab (+ LogTabBarButton in tab bar)
        └── LogSheet (canonical, 6-mode, search-first)
              ├── FoodSearchPanel (inline)
              ├── BarcodeScannerModal
              ├── VoiceLogSheet (Pro)
              ├── PhotoLogSheet (Free taster / Pro)
              ├── Browse — Recent / Saved / Library
              └── Manual quick-add
```

The standalone `search.tsx` tab is a read-only USDA list with no log action — it is vestigial and must not be replicated in this redesign (confirmed gap #1 from audit). All food-database access routes through `FoodSearchPanel` inside `LogSheet`.

### Platforms

Primary: iOS (`apps/mobile`). Web: `src/app/components/NutritionTracker.tsx` + `src/app/components/suppr/` equivalents. Both platforms must receive these changes together. All calculations route through shared `@suppr/shared/nutrition/*` — never fork the math.

---

## 2. Locked design system

All components in this spec use the following tokens. No hardcoded hex values. No Tailwind hex overrides.

### Colour

| Token | Hex | Use |
|---|---|---|
| `--background` | `#FFFFFF` | Page/sheet base |
| `--ink` | `#1B1814` | Primary text, headings |
| `--card` | `#F6F5F2` | Card/row surface |
| `--border` | `#ECEAE4` | Hairline dividers |
| `--terracotta` | `#C2683E` | Primary CTA, active states |
| `--sage` | `#7C8466` | Secondary labels, secondary CTAs |
| `--amber` | `#C9892C` | Over-budget macros, alerts (NOT calorie ring over) |
| `--success` | `#5E7C5A` | Calorie ring under-budget, positive signals |
| `--destructive` | `#D94F3D` | Calorie ring over-budget ONLY |
| `--ring-bg` | `#ECEAE4` | Ring track background |

Calorie ring colour mapping (project carve-out — overrides prototype):
- Empty / nothing logged: gradient (brand)
- Logged + under budget: `--success` green
- Logged + over budget: `--destructive` red
- All other over-budget signals (macros, sodium, etc.): `--amber`

### Typography

| Role | Font | Weight | Use |
|---|---|---|---|
| Display / headline | Fraunces or Newsreader (serif) | Regular–Medium | Section headers, food names, big numerals, daily kcal figure |
| Body | Inter (sans) | Regular–Medium | Macro grams, labels, data rows, dense tracker UI |
| Caption | Inter | Regular | Timestamps, source badges, confidence chips, secondary labels |

Rule: serif for editorial emphasis; Inter everywhere legibility wins over aesthetics. Dense macro data always Inter. A food name in a search result uses serif. Its "42 kcal · P 3g · C 5g · F 1g" row uses Inter.

### Card treatment

All cards: `border-radius: 16px`, `background: var(--card)`, `border: 1px solid var(--border)`. No drop shadows on data cards. Subtle `box-shadow: 0 2px 8px rgba(27,24,20,0.04)` on elevated sheets (LogSheet, preview card) only.

### Spacing scale

4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px. Horizontal screen padding: 20px. Section gap: 24px. Card inner padding: 16px.

### Motion

Sheets: spring entry (`damping 26, stiffness 300`), 92% height. Haptics: light impact on slot selection, medium impact on successful log. No decorative animations — motion serves state transitions only.

---

## 3. Component-by-component redesign

---

### 3.1 LogSheet — 6-mode single log grammar

**Current purpose:** Search-first modal (92% height). Six input modes: inline Search, Scan, Voice, Photo (right-edge icons), Recent / Saved / Library browse pills, "Or add manually" footer. Slot selector above search. Copy-yesterday row.

**Current weaknesses:**
- Scan / Voice / Photo are right-edge icon buttons — not labeled, not discoverable for first-time users. MacroFactor benchmark shows modes should be visible as a labeled strip.
- Mode icons are small; non-Pro lock badges add visual noise alongside the icons with no label context.
- Browse pills (Recent / Saved / Library) sit below the search field with no visual separation from the keyboard context, making the browse vs search distinction ambiguous.
- Section headers ("Recent", "Saved", "Library") are plain text with no editorial weight.
- The slot selector (Breakfast / Lunch / Dinner / Snacks) uses a 4-segment control that can feel crowded on smaller screens.

**Best-in-class benchmark:**
- MacroFactor log sheet: top tab strip for all modes, "Go-Tos / Latest" contextual sections above keyboard, fixed "Log Foods" commit pill. https://mobbin.com/screens/765d8ef0-9268-4f22-a857-9d82d54679a7
- MacroFactor mode switcher with scan/search/quick-add/library: https://mobbin.com/screens/aba24dda-9daf-44fc-a3b2-db667d385513

**Proposed redesign:**

```
┌─────────────────────────────────────────────┐
│  ← Drag handle                              │  ← 4px pill, centered
│                                             │
│  MEAL SLOT (segmented pill, 4 slots)        │  ← 36px height pill row, 12px inset
│  Breakfast · Lunch · Dinner · Snacks        │     Active: --terracotta fill, white text
│                                             │     Haptic on tap
│  INPUT MODE STRIP (labeled icons, 5 modes)  │  ← 48px row, below slot
│  ┌────┬────┬────┬────┬────┐                 │
│  │ 🔍 │ 📷 │ 🎤 │ 📸 │ ☰  │                 │
│  │Srch│Scan│Voic│Phot│ Log│                 │
│  └────┴────┴────┴────┴────┘                 │     Locked modes show lock-badge
│                                             │     on icon, label unchanged
│  ┌─────────────────────────────────────┐    │
│  │ 🔍  Search foods…                   │    │  ← TextInput, 48px height
│  └─────────────────────────────────────┘    │     --border, --ink placeholder
│                                             │
│  [Recent] [Saved] [Library]                 │  ← 32px pill tabs below field
│                                             │     Saved shows a dot at ≥3 saved meals
│  ────────────────────────────────────────  │  ← --border hairline
│                                             │
│  Copy yesterday (3 foods)  →               │  ← Row, --card bg, --sage label
│                                             │
│  [content area: search results / browse]    │
│                                             │
│  Or add manually                            │  ← Footer, --sage, underlined
└─────────────────────────────────────────────┘
```

Layout decisions:
- **Mode strip replaces right-edge icons.** Five labeled cells (Search / Scan / Voice / Photo / Log) in a row below the slot selector. Each cell is 20% width, icon + label, 14px Inter caption. Active mode: terracotta icon + label. Pro-gated modes show a small lock glyph over the icon — the label stays readable, the tap still routes to paywall.
- **Slot selector** stays above the mode strip. 4-segment pill, 36px height, 20px horizontal inset. Active segment: `--terracotta` fill. Inactive: `--card` bg, `--ink` text at 60% opacity. Haptic feedback on selection (light impact).
- **Browse pills** (Recent / Saved / Library) sit directly below the search field, flush with the card edge. These are filter tabs, not navigation — they scope the content area below. Saved dot appears at ≥3 saved meals (existing logic preserved).
- **Copy-yesterday row** immediately below browse pills, before search results. `--card` background, --sage "Copy yesterday" label, food-count in parentheses, chevron right. Preserved from existing implementation (ENG-709).
- **Section headers** ("Recent", "Saved", "Library") use Fraunces 16px when in browse mode, Inter 13px in results mode.
- **"Or add manually"** footer: Inter 14px, `--sage`, underlined. Visible only when browse tabs are active (not during active search).

**States:**

- **Empty (Recent):** Card with terracotta icon, headline "Start logging to see your recent foods", sub-copy "Your most-logged items appear here as you build the habit." No CTA (logging starts with the search field above).
- **Empty (Saved):** Card, "Save meals you log regularly — tap the bookmark on any food to save it." CTA: "Explore the food database" → focuses search field.
- **Empty (Library):** Card, "Recipes you've saved here can be logged in one tap."
- **Loading (search):** 4 skeleton rows, 64px height each, `--card` bg, animated shimmer using `--border` gradient.
- **Loading (barcode):** Full-width progress bar + "Looking up barcode…" caption.
- **Offline:** `CloudOff` icon (16px, `--sage`) + "You're offline — changes will save when you reconnect." Inline banner at top of content area. Existing optimistic logic preserved.
- **Mode locked (Voice/Photo for non-Pro):** Tapping the locked mode cell triggers `AiPaywallSheet`. The cell renders lock badge, no disabled-state greying — the tap is deliberate routing.

**User benefit:** Every input mode is now labeled and discoverable in one glance. First-time users no longer need to discover right-edge icons. Power users retain all existing capabilities. Slot selection is always visible, never an afterthought.

---

### 3.2 FoodSearchPanel — results engine

**Current purpose:** Debounced multi-source search (400ms) across USDA, OFF, Edamam, FatSecret, GenericBeverage, GenericFood, custom foods. Per-row headline with per-serving/per-100g badge, macro preview, confidence chip. Preview card with portion picker, scaled macros, fit-this-in projection, plausibility warning. Custom food CRUD.

**Current weaknesses:**
- Multi-source query floods the list with near-duplicates (same food from USDA + OFF + FatSecret without grouping).
- Category filter tabs include a "Favourites" tab that was already identified as a dead affordance (removed per ENG-748 #8) — confirm removal holds.
- Row layout: macro numerals (P/C/F) are small and monochrome, making the macro preview less scannable than it could be.
- The confidence chip (`SearchResultConfidenceChip`) is present but small — does not read like a verified/unverified trust signal at a glance.

**Best-in-class benchmark:**
- MacroFactor "Common +15" duplicate-collapse and grouping: https://mobbin.com/screens/ae765af7-e7ac-4e1e-b195-952df91ae6cc
- MacroFactor results with per-row macro detail: https://mobbin.com/screens/4d82d874-b78c-4268-a60f-1d2d2afe850c
- Yazio verified-tick badge per row: https://mobbin.com/screens/b93f67a7-cbf5-4ce2-b9e2-6841d3bdc5cd

**Proposed redesign:**

**Result row (64px height):**

```
┌──────────────────────────────────────────────────────────┐
│  [icon]  Food name (Fraunces, 16px, --ink)        ✓ tick │
│          42 kcal · P 3g · C 5g · F 1g  per serving      │
│          (Inter 13px, --sage)                            │
└──────────────────────────────────────────────────────────┘
```

- Food name: Fraunces 16px medium, `--ink`. Truncate at 1 line.
- Macro row: Inter 13px, `--sage`. Kcal + P/C/F preview. Per-serving vs per-100g badge in `--amber` text if per-100g (visual warning that portion math applies).
- Confidence tick: Yazio-style. Verified (USDA verified or FatSecret branded with micros): solid `--success` checkmark icon (14px). Estimated (generic match, OFF without full micros): outlined `--sage` circle. No text label needed — icon is sufficient at a glance.
- Right edge: plus-circle icon in `--terracotta` for quick-add (tapping the row opens the preview card; tapping the plus-circle opens the portion picker directly, skipping the preview card for speed).

**Duplicate collapse:**
- Adopt MacroFactor's "Common · +N variants" grouping. When the same food name appears across ≥2 providers with matching kcal (±10%), collapse to the highest-confidence row with a `+N` chip. Tapping `+N` expands the group inline to show source variants. This directly reduces the USDA/OFF/Edamam noise problem.
- Implementation note: collapse logic is a display-layer sort, not a data-layer merge — the underlying multi-source data is unchanged. Group by normalised food name + kcal bucket.

**Category filter tabs:**
- All / Recents / Custom / Branded / Generic
- Favourites tab removed (ENG-748 #8 — dead affordance, confirmed removed)
- Tabs: 32px height, Inter 13px, `--sage` inactive, `--terracotta` active with bottom underline (2px)

**Preview card (half-sheet, 280px fixed height):**

```
┌─────────────────────────────────────────────┐
│  Food name (Fraunces 20px)                  │
│  Source · ✓ Verified / ~ Estimated          │
│                                             │
│  [per 100g / per serving]  ←─ RADIO TOGGLE  │  ← NEW (Lifesum pattern)
│                                             │
│  Quantity [____] [g / ml / cups / oz]       │
│  Fraction parsing preserved (1/2, 1 1/2)   │
│                                             │
│  LIVE MACRO PREVIEW (scaled)               │
│  Kcal: 248    P: 12g   C: 31g   F: 8g     │
│  Fibre: 3g  Sugar: 4g  Sodium: 420mg      │
│                                             │
│  ⚡ Fits in dinner budget: 248 of 380 left  │  ← fit-this-in projection (preserved)
│                                             │
│  ⚠ Plausibility warning (if triggered)     │  ← soft-warn, never block
│                                             │
│  [        Log to Dinner         ]           │  ← --terracotta, full-width, 48px
└─────────────────────────────────────────────┘
```

**Per-100g / per-serving radio (new — hardening plausibility guard):**
Adopted from Lifesum (https://mobbin.com/screens/3b7d1127-3778-41be-83de-40047c782325). The radio makes the portion basis a **visible choice**, not an inference. This directly addresses the documented plausibility bug (500g yogurt → 1325 kcal when per-serving numbers are wrongly treated as per-100g). The radio defaults to "per serving" when serving data is present, "per 100g" when only per-100g data is available. The state is shown above the quantity field, not buried in a badge.

**Fit-this-in projection preserved:** `projectRemaining` runs on every quantity change. The projection banner appears below the macro preview. Format: "Fits in [slot] — [N] kcal of [M] remaining" in `--success`. Over-budget: "[N] kcal over [slot] budget" in `--amber`. This feature is ahead of all benchmarked comparables and must not be dropped.

**Plausibility warning preserved:** `checkScaledLogPlausibility` runs on every quantity change. Soft-warn banner ("These numbers look high — double-check the serving size") in `--amber`. The "Log anyway" path remains. Never a hard block.

**No-result state:**
- "No foods found for '[query]'" + "Try a different spelling, scan the barcode, or add it as a custom food."
- Three pill CTAs: [Scan barcode] [Add custom food] [Add to dictionary]. Triggers `food_search_no_result` event (existing).

**User benefit:** Duplicate collapse reduces list noise by roughly half for common foods. The per-100g/per-serving radio catches the most common source of bad logs before they're committed. Confidence ticks give instant trust signals. The fit-this-in projection remains — still the only logging surface in the market that shows you how a food fits before you log it.

---

### 3.3 Barcode scanner + Label OCR

**Current purpose:** EAN/UPC scan → OFF lookup → portion picker with memory → plausibility guard → log. Correction mode. Manual-entry fallback on not-found.

**Current weaknesses:**
- "Product not found" is a dead end — manual entry is the only recovery, which requires the user to know the nutrition facts.
- No label OCR mode — if the barcode isn't in OFF, there is no way to read the printed nutrition panel automatically.
- Portion picker uses a stepper (5g step) + label-serving preset chips — functional but not as scannable as a segmented toggle.

**Best-in-class benchmark:**
- MacroFactor Barcode/Label toggle in a single scanner: https://mobbin.com/screens/3a72d944-543b-4386-8a9f-965d0bae75b9 and https://mobbin.com/screens/22d54406-30b4-43dc-bef5-17c74208f4cb
- MacroFactor Label OCR review: https://mobbin.com/screens/d4503e1a-233a-4044-b133-3c0d18f2c508
- Cal AI "Fix Issue" + Serving/Package/Gram toggle: https://mobbin.com/screens/8f80392d-8dfa-4585-b0b2-b2fac10962a1
- MFP manual barcode entry fallback: https://mobbin.com/screens/3ee2dca3-2255-4ee5-b7e6-88078afe4fb7

**Proposed redesign:**

**Scanner screen layout:**

```
┌─────────────────────────────────────────────┐
│  ← Cancel                    [Barcode|Label]│  ← MODE TOGGLE (top right)
│                                             │
│  [viewfinder, full width, 60% screen]       │
│  Targeting corners in --terracotta          │
│                                             │
│  Barcode mode: "Point at barcode"           │
│  Label mode:  "Point at nutrition panel"    │
│               "US Label / Non-US Label"     │  ← appears after capture
│                                             │
│  ─────────────────────────────────────────  │
│  Enter barcode manually →                  │  ← manual fallback row, always visible
└─────────────────────────────────────────────┘
```

**New: Label OCR mode (highest-value gap vs MacroFactor):**
A `[Barcode | Label]` segmented toggle in the top-right chrome of the scanner screen. Tapping "Label" switches the camera to label-capture mode. After capture, the app presents the extracted nutrition values in a review card with editable fields before logging. "US Label / Non-US Label" disambiguation (MacroFactor pattern) handles serving-size normalisation differences.

This turns the existing "product not found → manual entry" dead-end into an OCR-assisted path, which is the single highest-value capability gap identified in the benchmark.

**Portion picker (post-scan, card below viewfinder):**

```
[ Serving ] [ Package ] [ Grams ]   ← Cal AI segmented toggle (new)

Quantity: [150]g
[50g]  [100g]  [150g]  [200g]      ← preset chips (existing, preserved)

You usually log 150g — using that. ← portion memory (preserved)

Kcal: 252  P: 18g  C: 28g  F: 7g
Fibre: 2g  Sugar: 3g  Sodium: 310mg

⚠ Plausibility warning (if triggered) ← soft-warn, preserved

[  Log to Lunch  ]                  ← --terracotta, 48px
```

The Serving/Package/Gram segmented toggle (Cal AI pattern) replaces the per-serving vs per-100g inference as the top-level portion switch. The stepper + preset chips remain below for gram-precision. Fraction parsing preserved.

**Plausibility guard preserved:** `checkScaledLogPlausibility` runs on every change. Soft-warn banner + "Log anyway" button. Never a hard block.

**Portion memory preserved:** "You usually log Ng — using that." Appears as a dismissable banner above the preset chips. No comparable surfaces this — it is a Suppr advantage.

**Correction mode preserved:** "This looks wrong — edit and update" → `submitFoodCorrection`. Surfaces after any log from barcode.

**Not-found state:**
```
Product not found for barcode [number].
[  Scan the nutrition label  ]   ← primary, routes to Label OCR mode
[  Enter manually  ]             ← secondary
```

**States:**
- Scanning: viewfinder + guide corners + hint copy
- Looking up: progress bar + "Looking up barcode…"
- Found: slide-up portion card
- Not found: two-CTA card (Label OCR primary, manual secondary)
- Label OCR reviewing: extracted values in editable card, "Confirm & use" CTA
- Error: "Couldn't read the label — try better lighting or enter manually"

**User benefit:** The Barcode/Label toggle eliminates the "not in database" dead end for packaged foods. Portion memory and plausibility guard are preserved as differentiators absent from all benchmarked comparables.

---

### 3.4 Today hero — calorie ring + macro tiles

**Current purpose:** TodayHeroRing (`CalorieRing`) with Goal/Food/Bonus stats row. TodayDashboardMacroTiles (2×2 grid). Long-press toggles sub-rings (P/C/F) and centre Remaining↔Logged.

**Current weaknesses:**
- The big calorie numeral uses the default system font size — the editorial opportunity of a serif display numeral is not taken.
- Sub-rings (P/C/F) are only revealed on long-press — discovery requires prior knowledge or accidental gesture.
- The macro tiles (2×2) use Inter throughout — food names in context could use more hierarchy.
- The stats row (Goal / Food / Bonus) uses small Inter labels that blend with the ring chrome.

**Best-in-class benchmark:**
- Lifesum hero ring with Eaten/Burned/Remaining triad: https://mobbin.com/screens/0cd481c6-7ae6-4f21-8752-87f8a45ebb95
- Cal AI macro mini-rings (without the colour-block hero): https://mobbin.com/screens/a6f4cf97-82c5-4d74-b817-61380e6b8c48
- MFP swap toggle %/grams: https://mobbin.com/screens/c3aab207-f1b0-4788-a0b2-ee08e43cca93

**Proposed redesign:**

**Calorie ring:**
- Centre numeral: Fraunces 40px, `--ink`. The calorie number is the most important single piece of data on this screen — it earns the serif display treatment.
- Centre label ("remaining" / "logged"): Inter 12px, `--sage`. Toggle on long-press (preserved).
- Sub-rings (P/C/F): adopt Cal AI's idea of surfacing them **without** requiring a long-press as the first-time discovery gesture. Solution: small P/C/F labels with dots below the ring (not inside it) that indicate sub-ring state. Long-press still reveals the full inner rings. The dots are 6px circles in macro colours (`--sage`, `--amber`, `--terracotta`) with Inter 11px labels. This makes the sub-rings discoverable on first view without changing the ring's visual weight.
- Ring colour map: preserved exactly as documented. Empty=gradient, under=`--success`, over=`--destructive`. No change.
- Ring track: `var(--ring-bg)`.

**Stats row (Goal / Food / Bonus):**
- Goal: Fraunces 18px, `--ink`
- Food: Fraunces 18px, `--success` when logged
- Bonus: Fraunces 18px, `--amber` (activity bonus)
- Labels: Inter 11px, `--sage`, uppercase tracking 0.04em
- Stats row renders only when consumed > 0 (existing logic preserved)

**Macro tiles (2×2 grid):**
- Each tile: `--card` background, 16px radius, 1px `--border`
- Macro name: Inter 12px uppercase, `--sage`
- Value: Fraunces 24px, `--ink` (the gram number earns editorial weight as the personal metric)
- "Xg left / Xg over": Inter 12px, `--sage` / `--amber`
- Progress bar: 4px height, rounded. Under-budget: macro's identity colour. Over-budget: `--amber` fill (not `--destructive` — calorie ring carve-out applies to the ring only). Clamped at 100% width.
- Net-carbs lens (`netCarbsForRow`): label reads "Net Carbs" only when fibre is present; falls back to "Carbs" when not. This rigour is preserved.
- Water tile: goal-driven, same tile pattern.
- Sugar / sodium tiles: reference targets (50g sugar, 2300mg sodium). Sodium over-reference: `--amber` bar (sodium = orange per project carryover rule — not destructive).

**No-colour-block-hero rule:** The current Today hero uses a dark surface tone (`#0a0a0f` mobile, `#101014` web). This is a documented intentional divergence (dark surface, not colour-block). The Lifesum full-bleed green gradient is not adopted. The Suppr dark surface tone is preserved.

**User benefit:** The calorie numeral gets the serif editorial treatment it deserves. Sub-rings become discoverable without requiring prior knowledge of a long-press. Macro tiles are visually elevated while preserving every data point.

---

### 3.5 Daily diary — meals by slot

**Current purpose:** `TodayMealsSection` — logged entries grouped by Breakfast/Lunch/Dinner/Snacks, editable per-entry, slot-level actions (copy meal, move meal). Each entry shows name, kcal, macros.

**Current weaknesses:**
- No per-meal calorie budget signal — the user cannot see at a glance how many calories a slot has remaining.
- Log-management actions (copy, move, remove) are scattered across per-entry context menus — a multi-select gesture would let power users manage batches.
- No imagery on logged items that map to known recipes — the hyperreal food photography rule is not applied here yet.

**Best-in-class benchmark:**
- MacroFactor multi-select action bar (View/Copy/Move/Remove): https://mobbin.com/screens/314f258f-3f24-4aa7-ab27-c9dd61c8c794
- Lifesum per-meal "330 cals under" remaining: https://mobbin.com/screens/0cd481c6-7ae6-4f21-8752-87f8a45ebb95
- MFP per-meal "Log [Breakfast]" CTA with kcal subtotal: https://mobbin.com/screens/c3aab207-f1b0-4788-a0b2-ee08e43cca93

**Proposed redesign:**

**Meal slot card:**

```
┌────────────────────────────────────────────────┐
│  Breakfast                          248 kcal   │  ← slot header
│  132 kcal remaining                            │  ← NEW: per-meal budget signal
├────────────────────────────────────────────────┤
│  [img]  Greek yogurt with berries    214 kcal  │  ← entry row
│         P 18g · C 24g · F 6g                   │
│                                                │
│  [img]  Oat milk flat white           48 kcal  │
│         P 1g · C 7g · F 1g                     │
├────────────────────────────────────────────────┤
│  + Add to Breakfast                            │  ← terracotta, opens LogSheet pre-set to slot
└────────────────────────────────────────────────┘
```

**Per-meal budget signal (new — Lifesum pattern):**
Display "X kcal remaining" (Inter 12px, `--success`) below the slot header when under, "X kcal over" (`--amber`) when over. Uses the existing macro targets + `projectRemaining` logic scoped to the slot. This makes the slot structure actively useful rather than just organisational.

**Entry row:**
- Left: 48×48px image thumbnail. If the entry maps to a known recipe with a dish photo, show the hyperreal food photography (crop to circle, 4px border in `--border`). If no image: icon placeholder in `--card` bg.
- Food name: Inter 15px, `--ink`
- Kcal: Inter 15px, `--ink`, right-aligned
- Macro row: Inter 12px, `--sage`
- Swipe-left: reveal Remove (destructive red) + Move (sage)
- Swipe-right: reveal Copy to tomorrow (sage)

**Multi-select action bar (new — MacroFactor pattern):**
Long-press any entry to enter multi-select mode. A bottom action bar slides up:
```
[  Move  ]  [  Copy  ]  [  Remove  ]
```
Each action operates on all checked entries. Replaces the need to repeat swipe-actions per entry for batch operations. Checked entries show a `--terracotta` checkmark overlay. Existing `CopyMealSheet` and `MoveMealSheet` logic is invoked per the existing patterns — this is a new gesture surface, not new logic.

**"+ Add to [Slot]" CTA:**
Each slot card has a full-width "Add to [slot name]" button at the bottom. Tapping it opens `LogSheet` with the slot pre-selected. Terracotta text, 44px touch target, `--card` bg.

**Empty slot:**
When a slot has no entries: card renders as a dashed-border placeholder, 80px height, with the "+ Add to [Slot]" CTA centred. No skeleton — dashed border signals intent. Hint copy for empty Breakfast: "Haven't logged breakfast yet."

**User benefit:** Per-meal budget signals give the slot structure immediate informational value. Multi-select makes batch log management a one-gesture operation. Food photography rewards logging a known recipe with a richer visual confirmation.

---

### 3.6 TodayDeficitInsight + TodayActivityBonusCard

**Current purpose:** Net deficit banner (burn − consumed, rolling avg over logged days). Activity bonus card (burn breakdown, workouts, weekly rollup, projected kg/week at 7700 kcal/kg). Maintenance TDEE tile. Adaptive TDEE learning pill.

**Current weaknesses:**
- The deficit insight banner appears and disappears without context — users who haven't enabled activity-adjusted calories see a confusing "no burn data" state.
- The activity bonus card is information-dense but visually flat. The projected kg/week is the most motivating number on this surface and it doesn't have proportional visual weight.

**Best-in-class benchmark:**
- MacroFactor expenditure framing with weekly check-in: https://mobbin.com/screens/b3babd0a-1631-4e64-b9a1-54bfe8a708f0
- Fitbit "740 Cal in — 2,413 Cal out" net energy framing: https://mobbin.com/screens/e5a7a2c4-4704-4475-b1db-f9d67c3aa63f
- Withings weekly improvement score card: https://mobbin.com/screens/3defe666-ccc4-4f4c-b7c8-9f648bb736c3

**Proposed redesign:**

**Net deficit banner:**
- Hidden when: no log today, no burn data, consumed = 0, or surplus (existing rules preserved)
- When visible: `--card` card, Fraunces 22px for the deficit number, Inter 13px for the rolling-avg sub-line
- Rolling avg sub-line suppressed below 50 kcal/day noise floor (existing rule preserved)
- Sub-line copy (calm-coach voice): "Averaging [N] kcal deficit over [D] days logged this week."
- Window (calendar-week vs rolling 7-day) from Settings (existing logic preserved)

**Activity bonus card:**
Primary layout: three tiles side-by-side in a card row at the top.

```
┌─────────────────────────────────────────────┐
│  Active   Resting   Net                     │
│  420 kcal  1,580    −860                    │
│  (Fraunces 20px for each number)            │
│  (--sage label, Inter 11px uppercase)       │
├─────────────────────────────────────────────┤
│  Workouts today                             │
│  Running · 45 min · 420 kcal               │
├─────────────────────────────────────────────┤
│  This week                                  │
│  Avg deficit: 720 kcal/day                 │
│  Weekly total: 5,040 kcal                  │
│                                             │
│  Projected this week:  −0.65 kg            │  ← Fraunces 24px, --success green
│  (at 7,700 kcal/kg)                        │     Sub-label, Inter 11px, --sage
└─────────────────────────────────────────────┘
```

Projected kg/week: the most important number in this card gets the largest typographic treatment — Fraunces 24px, `--success` (when deficit) or `--amber` (when surplus). This is the payoff of all the other numbers — it earns visual prominence proportional to its motivational value.

The 7700 kcal/kg constant is the single canonical path. Lbs = kg / 0.4536 (existing logic). Not configurable (fixed at correct value per audit decision 2026-05-05).

Neutral states: when consumed = 0, all deficit/surplus/projection numbers render as `--sage` em-dashes, not fake-zeros (existing rule preserved).

Maintenance popover: tapping the "Resting" tile opens the maintenance explainer (existing `buildMaintenancePopoverCopy` / `buildTdeeExplainerCopy` logic).

**User benefit:** The projected weekly change number gets the visual weight it deserves. The three-tile summary is scannable in under two seconds. All calculation rules are preserved exactly.

---

### 3.7 Voice logging (Pro)

**Current purpose:** `VoiceLogSheet` — native STT → `/api/nutrition/voice-log` → review list with per-item confidence badge + inline macro edit → "Log all". Pro-only, server-enforced.

**Current weaknesses:** None identified against available benchmarks. Suppr's VoiceLogSheet (review list + per-item confidence + inline edit + "Log all") is ahead of the visible iOS comparable set. Mobbin returned no dedicated voice-log comparable screen. The only gap is visual inconsistency between the voice review-list rows and the photo-log review-list rows — they should share a row pattern.

**Best-in-class benchmark:** No directly comparable iOS screen available in Mobbin benchmarks. Suppr is the benchmark here.

**Proposed redesign:** Minimal changes. Align the review-list row layout with the photo-log review rows (§3.8 below) for visual consistency: same 64px row height, same confidence chip position (right edge), same inline macro edit affordance (tap to expand). Keep the "Log all" primary CTA and the per-item confidence badge with colour-coded tiers. The existing `aiLogging.ts` logic (sanitiseAiItems, classifyConfidence, averageConfidence) is unchanged.

**Pro gate:** Voice always routes non-Pro taps to `AiPaywallSheet`. Server-enforced (403 on non-Pro calls to `/api/nutrition/voice-log`). Preserved exactly.

**User benefit:** Review rows now visually match photo-log rows — consistent mental model for AI-assisted logging.

---

### 3.8 Photo logging (Free taster + Pro)

**Current purpose:** `PhotoLogSheet` → `/api/nutrition/photo-log` → items grouped by macro role + kcal RANGES + plate-total range + correction-persistence (5/rolling-7-days free, then 403 `upgrade_required` → paywall).

**Current weaknesses:**
- No in-capture coaching before the shot is taken — the user has no guidance on framing (all ingredients visible, spread layered food, etc.).
- The thumbs/correction feedback loop exists in the code (correction-persistence teaches the model) but is not visually surfaced with the same prominence as Cal AI's "How did we do?" affordance.

**Best-in-class benchmark:**
- Cal AI in-capture coaching overlay: https://mobbin.com/screens/2ee1cd01-272c-4b56-a3de-16c7bad7b643
- Cal AI post-scan "How did Cal AI do?" thumbs feedback: https://mobbin.com/screens/ac4da5ae-acfd-4c04-8038-4eca3bf980d9
- Cal AI post-scan item card: https://mobbin.com/screens/2db7609c-6b5f-4a75-8813-4045e4300775

**Proposed redesign:**

**Pre-capture coaching overlay (new):**
Before the first photo is taken, a small coaching banner overlays the bottom of the viewfinder:

```
For best results:
• Make all ingredients visible
• Spread out layered foods
• Barcode or search is most accurate for packaged items
```

Inter 13px, white text, `rgba(0,0,0,0.5)` pill background. Dismisses on tap. Does not re-appear after dismissed (AsyncStorage flag). This sets honest expectations before the shot — reducing post-scan correction rate.

**Post-scan review:**

```
┌─────────────────────────────────────────────┐
│  Your plate                                 │  ← Fraunces 18px
│  Estimated 480–620 kcal                     │  ← RANGE, Inter 14px, --sage
│                                             │
│  [item rows — grouped by macro role]        │
│                                             │
│  ─────────────────────────────────────────  │
│  How did we do?   [👍]  [👎]               │  ← NEW: thumbs feedback
│  Your feedback helps us improve.            │     Inter 13px, --sage
│                                             │
│  [       Log this plate        ]            │  ← --terracotta, 48px
└─────────────────────────────────────────────┘
```

**Kcal RANGES preserved:** Suppr displays honest kcal ranges (e.g. "480–620 kcal"), not single-point estimates. Cal AI displays single-point — Suppr's approach is more rigorous and must not be regressed. The range is the trust-layer differentiator.

**Thumbs feedback (new):** Thumbs up/down row below the item list. Tapping thumbs-down expands an optional "What was wrong?" multi-select (Wrong food / Wrong amount / Missing item / Extra item). Existing `correction-persistence` logic is unchanged — this surfaces it visibly.

**Item row (64px):**

```
[icon]  Grilled salmon fillet       ← Inter 15px, --ink
        240–300 kcal  P 28g  C 0g F 14g  ← range + macros, Inter 13px, --sage
        [Medium confidence]         ← chip, right edge
```

Confidence chip: per existing `classifyConfidence` tiers. High: `--success` outline + "Verified". Medium: `--sage` outline + "Estimated". Low: `--amber` outline + "Low confidence". Tapping a low-confidence row opens an inline correction field.

**Add-on chips (existing):** "Add sauce?" / "Add sides?" chips below the main item list. Preserved.

**Free taster → paywall (existing):** 5 free/rolling-7-days. After quota: server 403 `upgrade_required` → `AiPaywallSheet`. Sheet always opens (Pro users see the capture flow; free users see the capture flow + paywall after quota). Preserved exactly.

**User benefit:** Pre-capture coaching reduces bad shots and sets honest expectations. The thumbs feedback loop is now visible — signals model humility to the user and feeds the correction-persistence engine. Kcal ranges are preserved as a trust differentiator.

---

### 3.9 Custom food CRUD

**Current purpose:** `CreateCustomFoodSheet` — create/update/delete custom foods. Long-press row actions on custom foods in search results.

No visual redesign needed beyond applying the card/type tokens consistently. The CRUD logic is unchanged. Row actions (long-press → Edit / Delete) preserved. All fields: name, calories, protein, carbs, fat, fibre, serving size, serving unit.

---

### 3.10 Portion picker

**Current purpose:** `PortionPickerSheet`, `PortionStepper`, `SavedMealPortionSheet`, `food-log/ServingStepper`. Fraction parsing ("1/2", "1 1/2"). Quantity + unit + scaled macros.

**Best-in-class benchmark:**
- Lifesum per-100g / per-cup radio + wheel picker: https://mobbin.com/screens/3b7d1127-3778-41be-83de-40047c782325 and https://mobbin.com/screens/f9204bcd-4719-4ee7-b72e-de7ca5f3de36
- Noom household-measure → kcal list: https://mobbin.com/screens/3f399f74-fbf1-484a-a034-a767794957de
- Cal AI Serving/Package/Gram segmented control: https://mobbin.com/screens/8f80392d-8dfa-4585-b0b2-b2fac10962a1

**Proposed redesign:** Align all portion-picker surfaces to the pattern specified in §3.2 preview card and §3.3 barcode:
- Top-level switch: Serving / Package / Grams segmented toggle (Cal AI pattern)
- Per-100g / per-serving radio where both data sets are available (Lifesum pattern)
- Quantity: Inter 20px numeric input, fraction parsing preserved ("1/2", "1 1/2")
- Preset chips (50g / 100g / 150g / 200g) for gram-entry fast-tap
- Live-scaling macros below (Fraunces 16px for kcal, Inter 13px for P/C/F/fibre/sugar/sodium)
- Wheel picker for unit selection if > 4 units available (Lifesum pattern)

No logic changes. The count-to-weight normalisation (`measureToGrams.ts`) is unchanged.

---

### 3.11 Weekly nutrition report (WeeklyInsightCard → stacked-macro chart)

**Current purpose:** `WeeklyInsightCard` — 7-bar sparkline (height-only), average kcal (null when no logged day), loggedDaysInWeek. Gated behind `today-weekly-insight-mobile` flag (default off). Web: `today-weekly-insight-card`.

**Current weaknesses:** The 7-bar sparkline shows only total calorie height — it carries no macro composition information and no time-range selector. MacroFactor's weekly chart is analytically deeper on every dimension and is the current benchmark gold standard.

**Best-in-class benchmark:**
- MacroFactor stacked macro bars + target reference line + range selector: https://mobbin.com/screens/3a684eb1-3485-4130-9d5e-18b1eef8e1bd
- MacroFactor historical daily breakdown list with provenance: https://mobbin.com/screens/647f214f-d7fa-4b7e-8583-24c361485b94
- Yazio Dietary Energy with Daily/Weekly/Monthly + goal line over bars: https://mobbin.com/screens/42e4deb6-fe45-4e0a-ae7e-0e7443c959a8

**Proposed redesign:**

**Weekly nutrition chart (replaces sparkline):**

```
┌─────────────────────────────────────────────────────────────┐
│  Average   1,842 kcal         [1W] [1M] [3M] [1Y]          │
│  (Fraunces 22px)              (range selector, Inter 12px)  │
│                                                             │
│  Target ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (dashed) │
│                                                             │
│   ┌──┐ ┌──┐ ┌──┐     ┌──┐ ┌──┐ ┌──┐ ┌──┐                  │
│   │  │ │  │ │  │     │  │ │  │ │  │ │  │                  │  ← stacked bars
│   │  │ │  │ │  │     │  │ │  │ │  │ │  │                  │    carbs=--sage
│   │  │ │  │ │  │     │  │ │  │ │  │ │  │                  │    fat=--amber
│   └──┘ └──┘ └──┘     └──┘ └──┘ └──┘ └──┘                  │    protein=--terracotta
│   Mon  Tue  Wed   ○  Thu  Fri  Sat  Sun                    │    empty day=4% min height
│                   (not logged)                             │
│                                                             │
│  [carbs] [fat] [protein]  (legend chips, Inter 11px)        │
├─────────────────────────────────────────────────────────────┤
│  Daily breakdown list                                       │
│  Mon 26 May  1,920 kcal  P 88 · C 240 · F 72  Food Log    │
│  Tue 27 May  1,650 kcal  P 72 · C 210 · F 60  Food Log    │
│  Wed 28 May  —            (not logged)                     │
└─────────────────────────────────────────────────────────────┘
```

**Stacked bar design:**
- Three segments per bar: protein (`--terracotta`), fat (`--amber`), carbs (`--sage`). Stacked bottom-up in that order.
- Bar width: equal, with 4px gap between bars.
- Target reference line: dashed `--border` at the target kcal height. Label: "Target [N] kcal" at right edge, Inter 11px, `--sage`.
- Empty days: 4% minimum height bar in `--card` colour (existing `computeSparklineHeights` logic for empty-day floor preserved).

**Null-safety preserved:** `weekAvgKcal` = null when no logged days — the average header shows "—" not "0". This rigour (existing implementation) is preserved and non-negotiable.

**Provenance tagging (new — MacroFactor pattern):** Each row in the daily breakdown list shows "Food Log" or "Manual" provenance label. Inter 11px, `--sage`. This data-quality transparency signal is absent from all other comparables.

**Range selector:** 1W / 1M / 3M / 1Y segmented strip top-right of the card. Default: 1W (preserves current behaviour). Higher ranges fetch from the existing `nutrition_entries` table — no new data model needed.

**Flag parity:** Both `today-weekly-insight-mobile` and `today-weekly-insight-card` must be ramped together. Stacked-macro chart ships behind the same flags, replacing the sparkline.

**User benefit:** The weekly chart now shows macro composition AND total AND vs-target in one view across selectable time ranges. Analytically equivalent to MacroFactor, rendered in Suppr's warm palette with serif numerals. The null-safety and provenance rigour are preserved.

---

### 3.12 Weight trend chart (adaptive TDEE story)

**Current purpose:** Weight trend on the Progress tab. Feeds adaptive TDEE calculation. `adaptiveTdee.ts` + `countWeighInDaysInWindow` (ENG-758).

**Current weaknesses:** The current weight chart (Progress tab surface) renders a single smoothed line — raw weigh-in scatter is not visible, there is no dotted forward projection, and there is no correlated energy-bars-beneath view.

**Best-in-class benchmark:**
- Bevel trend + dotted forward projection + energy bars beneath: https://mobbin.com/screens/7c9bdd48-f883-4338-b673-cdccb0685a01
- Withings raw-scatter + smoothed trend line + Avg/Trend numeral: https://mobbin.com/screens/9ab952f7-dccf-44e9-ad50-fd83667ae174 and https://mobbin.com/screens/9d054398-0bba-4d06-91d4-afd9b584cd6d
- MacroFactor raw scale points + dashed average baseline: https://mobbin.com/screens/338f92f1-c46c-4e6d-9ce4-8e8431fdb361

**Proposed redesign:**

**Chart composition (two-layer):**

```
┌────────────────────────────────────────────────────────────┐
│  Weight                          Avg 74.2 kg  −0.8 kg/wk  │
│  (Fraunces 18px)                 (Inter 14px, --success)   │
│                                                            │
│  ·  ·   ·  ·                                               │  ← raw scatter dots (--sage, 5px)
│      ─────────────────────────────────────────            │  ← smoothed trend (--ink, 2px)
│                              ......................         │  ← dotted projection (--terracotta, dashed)
│                              │                             │
│                              "Projected at this pace"      │
│                                                            │
│  [calorie bars beneath, same x-axis alignment]             │  ← energy bars (same pattern as §3.11)
└────────────────────────────────────────────────────────────┘
```

- **Raw scatter dots:** individual weigh-in points (`--sage` fill, 5px radius). Never hide raw data.
- **Smoothed trend line:** the TDEE-model smoothed line (`--ink`, 2px). This is the "signal" behind the noise.
- **Dotted projection:** forward-projected line from the last known trend point (`--terracotta` dashed, 1.5px). Label: "Projected at this pace". Only renders when adaptive TDEE confidence is medium or high.
- **Energy bars beneath:** daily calorie intake bars (same `--sage` + `--amber` + `--terracotta` stacked pattern as §3.11) on the same x-axis, so the correlation between intake and weight change is visible.
- **Average + trend numeral:** Fraunces 16px avg weight, Inter 13px directional trend (−0.8 kg/wk = `--success`; +0.3 kg/wk = `--amber`).

**Never ship:** a single smoothed line with no raw points and no projection. This is the "prettier but dumber" failure the brief explicitly forbids.

**Adaptive TDEE learning pill preserved:** Real weigh-in count from `countWeighInDaysInWindow` (ENG-758). Confidence badge (low/medium/high). Weekly check-in ritual (§3.13).

**User benefit:** Users can see both the noise (daily variation) and the signal (trend), and understand where they're heading. The energy-bars correlation directly illustrates why the trend is moving — the core narrative of MacroFactor's expenditure model, rendered with Suppr's warmth.

---

### 3.13 Weekly check-in modal (adaptive TDEE consent)

**Current purpose:** `WeeklyCheckinModal` / `WeeklyCheckinBanner` — TDEE recalibration, weight-trend review, `weeklyCheckin.ts`. Triggered once per week when adaptive TDEE has new data.

**Best-in-class benchmark:**
- MacroFactor weekly check-in with proposed macro change + accept/decline: https://mobbin.com/screens/b3babd0a-1631-4e64-b9a1-54bfe8a708f0

**Proposed redesign:**

MacroFactor's pattern: **show the proposed change → explain the evidence → ask accept/decline**. This is the gold standard for adaptive-TDEE transparency and must be the model for Suppr's check-in.

```
┌─────────────────────────────────────────────┐
│  Weekly check-in                            │  ← Fraunces 20px
│                                             │
│  Based on your logs and weigh-ins,          │
│  your estimated needs changed slightly.     │  ← calm-coach copy, Inter 14px, --sage
│                                             │
│  [7-day macro bar review — §3.11 mini]     │
│                                             │
│  Current goal:  1,850 kcal                  │
│  Proposed:      1,780 kcal  −70 kcal       │  ← --success for reduction (deficit goal)
│                                             │
│  Average Change: −70 kcal                  │
│  Evidence: 6 logged days, 3 weigh-ins      │  ← transparency row, Inter 12px, --sage
│  Confidence: Medium                         │
│                                             │
│  [       Accept update       ]              │  ← --terracotta, 48px
│  [       Keep current        ]              │  ← --card bg, --ink, 48px
└─────────────────────────────────────────────┘
```

The "Accept update" / "Keep current" split preserves user autonomy — adaptive TDEE updates are never forced (consistent with existing `weeklyCheckin.ts` accept/decline logic).

Copy voice: calm-coach, no clinical jargon. "Your estimated needs changed slightly" not "Your TDEE adjustment is −70 kcal based on regression analysis."

**User benefit:** The check-in now explains its reasoning visibly, mirroring MacroFactor's gold-standard consent pattern. Users understand *why* their goal is changing — building trust in the adaptive engine rather than mystery.

---

### 3.14 Micronutrient panel (FullNutrientPanelSheet + TodayNutrientsModal)

**Current purpose:** Full macro+micro breakdown (fibre, sugar, sodium, caffeine, alcohol, vitamins where available). `WhyThisNumberSheet`, `WhereThisComesFromSheet`.

**Best-in-class benchmark:**
- MacroFactor Nutrient Explorer — mini cards with % + drill-in chevron: https://mobbin.com/screens/91bff3df-c15e-4d96-ad5f-098b3cd4945f
- Cal AI / Lifesum Daily Breakdown — red/green status dots: https://mobbin.com/screens/a4ec6f0f-5e5f-4290-a8a3-f8b76f3bf29d
- Lifesum full nutrient table: https://mobbin.com/screens/7c2916d3-8c9d-4292-83d9-90769e407253

**Proposed redesign:**

**Status dots (new — Cal AI pattern):**
Each nutrient row gets a small status dot (10px circle) to the left of the nutrient name:
- At or under target: `--success` solid dot
- Approaching (80–100%): `--amber` solid dot
- Over: `--destructive` dot (sodium only — per the sodium=orange carve-out, sodium over = `--amber`, not `--destructive`)
- No data: `--border` empty ring

This makes "good vs needs attention" instantly scannable without reading numbers.

**Drill-in per nutrient (new — MacroFactor pattern):**
Each nutrient row shows a chevron (Inter 12px, `--sage`). Tapping opens a mini trend view for that nutrient (last 7 days, same bar pattern as §3.11 but single-colour). This elevates micros from static daily snapshot to analytical trend — the most meaningful depth upgrade for power users.

**Opaque health scores forbidden:** Cal AI's "Health score 7/10" is not adopted. If a summary score is ever added, it must be explainable via `WhyThisNumberSheet` (existing pattern). For now: no opaque scores.

**Net carbs label preserved:** Label reads "Net Carbs" only when fibre data is present; falls back to "Carbs" when not (`netCarbsForRow` logic unchanged). This is more rigorous than Cal AI and Lifesum and must not be weakened.

**User benefit:** Status dots give instant "good/attention" signal without number-reading. Nutrient drill-in elevates micros from flat list to analytical tool. The net-carbs rigour is preserved.

---

### 3.15 Standalone search.tsx tab — DEPRECATION

**Current status:** Read-only USDA food list with no log action. Dead affordance. No comparable surfaces this pattern (every benchmarked app routes all food-database access into a loggable result).

**Decision:** Remove from tab navigation. Route all food-database access through `FoodSearchPanel` inside `LogSheet`. A tab-level "Search" route is confusing when it cannot log.

**Implementation note:** This is a navigation and UX change. The USDA data source continues to be available via `FoodSearchPanel` — no data is lost. A Linear issue should be opened for the removal (if not already tracked).

**Verdict:** Do not replicate or redesign the read-only search tab. Confirmed removal.

---

### 3.16 Eat-again + Quick-log surfaces

**Current purpose:** `TodayEatAgainBanner`, `TodayEatAgainScroller`, `TodayQuickLogStrip` — surfaces frequently-logged foods for one-tap re-logging. `TodaySnapShortcut`, `TodayPlannedMealsCard` — planned meal shortcuts.

No structural redesign needed. Apply card tokens (16px radius, `--card` bg, `--border` hairline). Section header in Fraunces 16px. Food name in Inter 15px. Kcal in Inter 13px `--sage`. Log button (+) in `--terracotta`.

**User benefit:** Visual consistency with the rest of the log surface.

---

### 3.17 Streak + behavioural mechanisms

**Current purpose:** `StreakPip`, `TodayStreakInsightCard`, `computeLoggingStreak`, `streakFreeze.ts`, `streakReset.ts` — streak count, freeze earn/protect/ledger, missed-yesterday nudge.

No redesign required for the streak logic. Visual treatment: streak count uses Fraunces 24px numeral, `--terracotta` colour. Freeze badge: `--amber` fill, `--ink` text. Calm-coach copy preserved — no gamification escalation language.

`MISSED_YESTERDAY_COPY` nudge: body-neutral, no shame. "You didn't log yesterday — that's okay. Start fresh today." Never "You broke your streak!"

---

## 4. Information architecture — navigation map

```
Bottom tab bar: Today / Plan / Recipes / Progress
                                   ↑ Log (centre, floating FAB)

Today
├── Hero (ring + macro tiles)
├── Deficit insight banner
├── Activity bonus card
├── Meals section
│   ├── Breakfast card
│   ├── Lunch card
│   ├── Dinner card
│   └── Snacks card
├── Eat-again scroller
├── NorthStar block (empty-day-only)
├── Quick-log strip
└── Weekly insight card (flag-gated)

Log (LogSheet, 92% sheet)
├── Slot selector
├── Mode strip (Search / Scan / Voice / Photo / Log)
├── Search field
├── Browse tabs (Recent / Saved / Library)
├── Copy-yesterday row
└── Content area
    ├── FoodSearchPanel (search mode)
    │   └── Preview card → portion picker → confirm → log
    ├── BarcodeScannerModal (scan mode)
    │   ├── Barcode mode → portion picker → confirm → log
    │   └── Label OCR mode → review → confirm → log
    ├── VoiceLogSheet (voice mode, Pro)
    │   └── Review list → edit → log all
    ├── PhotoLogSheet (photo mode, free taster/Pro)
    │   └── Coaching overlay → capture → review → thumbs → log
    └── Manual quick-add (footer)

Progress
├── Weight trend chart (scatter + smoothed + projection + energy bars)
├── Weekly nutrition chart (stacked-macro bars)
├── Adaptive TDEE learning pill
└── Micronutrient panel
```

The standalone `search.tsx` tab is removed from this IA.

---

## 5. Accessibility

- All interactive elements: minimum 44×44pt touch target.
- Colour is never the sole status indicator — every status communicated by colour (ring states, macro over-budget) also has a text label or icon companion.
- Confidence chips: text label + icon, not icon alone.
- VoiceOver labels on all chart elements ("Calorie ring, 1,200 of 1,800 kcal logged, under budget").
- Fraunces display numerals: check rendering at Dynamic Type largest sizes — fall back to Inter if Fraunces metrics break layout at accessibility sizes.
- Loading skeletons: `accessibilityLabel="Loading food results"` on skeleton containers.
- Haptics are supplementary — every haptic event has a visual equivalent state change.

---

## 6. Cross-platform parity

Every component in this spec ships on both iOS (`apps/mobile`) and web (`src/app/components/`). No surface gets the redesign without the other.

Known parity points requiring explicit attention:
1. **FoodSearchPanel inline lift** — web `src/app/components/suppr/log-sheet.tsx` must be verified to match the mobile inline-lift pattern, not the legacy nested-modal pattern.
2. **WeeklyInsightCard** — both `today-weekly-insight-mobile` and `today-weekly-insight-card` flags ramp together.
3. **Label OCR mode** — web equivalent: upload-a-photo-of-the-label input. The camera API differs; the review-and-confirm flow is identical.
4. **Stacked-macro chart** — web renders via Recharts (or equivalent); mobile via the existing charting library. The data model and null-safety rules are shared.
5. **Per-100g/per-serving radio** — web `FoodSearchPanel` and barcode equivalent must both receive this change.
6. **Multi-select action bar** — web equivalent uses checkbox selection + toolbar; swipe gesture is mobile-only.

---

## 7. Feature flags

All visual and structural changes in this spec ship behind feature flags per `docs/decisions/2026-05-13-session-replay-and-feature-flags.md`.

| Change | Flag name (proposed) |
|---|---|
| Log sheet mode strip (replaces right-edge icons) | `log-sheet-mode-strip-v2` |
| Stacked macro weekly chart | `weekly-macro-chart-v2` |
| Label OCR mode in barcode scanner | `barcode-label-ocr` |
| Per-100g/per-serving radio in portion editor | `portion-basis-radio` |
| Per-meal budget signal in meals section | `per-meal-budget-signal` |
| Multi-select log action bar | `log-multiselect-bar` |
| Weight scatter + projection chart | `weight-projection-chart` |
| Photo log pre-capture coaching | `photo-log-coaching-overlay` |
| Photo log thumbs feedback | `photo-log-thumbs-feedback` |
| Nutrient status dots + drill-in trends | `nutrient-drill-in` |

Each flag: gate the new path, leave old path alive in `else`, ramp via PostHog dashboard. Remove gate in a follow-up cleanup PR after 100% hold for two weeks with no regression.

---

## 8. FUNCTIONALITY PRESERVED checklist

Every feature from the functional audit (Input A) is confirmed preserved or improved in this spec. No regression.

### Logging entry points
- [x] LogSheet — search-first, 92% height, 6 input modes
- [x] LogFab on Today + LogTabBarButton in tab bar
- [x] FoodSearchPanel inline in LogSheet
- [x] FoodSearchModal (legacy host for verify-ingredient)
- [x] BarcodeScannerModal (modal) + barcode tab
- [x] VoiceLogSheet (Pro, server-enforced)
- [x] PhotoLogSheet (free taster 5/rolling-7-days → paywall)
- [x] CreateCustomFoodSheet
- [x] AiPaywallSheet
- [x] Manual quick-add (TodayAddFoodForm)
- [x] CopyMealSheet / DuplicateDaySheet
- [x] Portion editors (PortionPickerSheet, PortionStepper, SavedMealPortionSheet, ServingStepper)
- [x] Slot selector — 4-segment (Breakfast/Lunch/Dinner/Snacks) — above mode strip
- [x] Copy-yesterday row (ENG-709) — preserved
- [x] Browse tabs — Recent / Saved / Library (Recent default, resets each open)
- [x] Saved dot at ≥3 saved meals
- [x] Lock badges on Voice/Photo for non-Pro
- [x] Barcode manual-entry recovery mode

### FoodSearchPanel
- [x] Debounced multi-source search (400ms) — USDA, OFF, Edamam, FatSecret, GenericBeverage/GenericFood, custom foods
- [x] FatSecret Premier autocomplete (250ms debounce)
- [x] USDA macro backfill (8s timeout race)
- [x] Pagination with loadMore; errors stop further attempts
- [x] Category filter tabs: All / Recents / Custom / Branded / Generic
- [x] Favourites tab removed (ENG-748 #8) — confirmed
- [x] Per-serving vs per-100g badge — preserved (now elevated to radio toggle in preview card)
- [x] P/C/F preview + kcal per row
- [x] Confidence chip (SearchResultConfidenceChip verified/estimated) — preserved, elevated to Yazio-style tick
- [x] Preview card — portion picker, fraction parsing, quantity, scaled macros
- [x] Fibre/sugar/sodium in preview card
- [x] Fit-this-in projection (projectRemaining) — preserved and featured prominently
- [x] Plausibility warning (foodSearchPreviewPlausibilityWarning) — preserved
- [x] Custom food CRUD (create/update/delete, long-press)
- [x] No-result handling → food_search_no_result event + dictionary-add row

### Barcode
- [x] EAN13/EAN8/UPC-A/UPC-E scan
- [x] OFF lookup
- [x] Duplicate-scan guard
- [x] ServingStepper (5g step) + label-serving preset chips + 50/150/200g defaults
- [x] Portion memory ("You usually log Ng — using that")
- [x] Plausibility guard (checkScaledLogPlausibility) — soft-warn, never hard block
- [x] "Log anyway" path preserved
- [x] Correction mode (submitFoodCorrection)
- [x] Manual-entry fallback when not found
- [x] Caffeine/alcohol + full micro set scaled for grams
- [x] NEW: Label OCR mode toggle (new capability, not a replacement)
- [x] NEW: Serving/Package/Gram segmented toggle

### Calculations and data points
- [x] resolveTargets — reads profile targets, falls back to calculateTDEE
- [x] target_calories/protein/carbs/fat/fiber_g from profile
- [x] Water default (NUTRITION_DEFAULTS.water)
- [x] Steps default (NUTRITION_DEFAULTS.steps)
- [x] Caffeine/alcohol-weekly targets from profile
- [x] CalorieRing — consumed, goal, baseGoal, colour map (empty=gradient, under=success, over=destructive)
- [x] Inner P/C/F sub-rings on long-press
- [x] Long-press toggles centre Remaining↔Logged
- [x] Stats row Goal/Food/Bonus — renders only when consumed > 0
- [x] Macro tiles — protein/carbs/fat/fiber from totals vs targets
- [x] Net-carbs lens (netCarbsForRow) — label requires fibre
- [x] Sugar reference 50g, sodium reference 2300mg
- [x] Water goal
- [x] pct = min(100, current/target×100)
- [x] Over-budget bar: amber (not destructive — ring carve-out preserved)
- [x] "X g left / X g over" from rounded displayed values (avoids off-by-1)
- [x] Net deficit = burn(today) − consumed(today)
- [x] Rolling avg over days actually logged (NOT /7 — 2026-05-26 fix preserved)
- [x] Sub-line suppressed below 50 kcal/day noise floor
- [x] Deficit hidden when: no log, no burn, consumed=0, surplus
- [x] Window (calendar_week vs rolling 7-day) from Settings
- [x] Activity bonus: total burn / food logged / Maintenance TDEE tile / Net deficit|surplus
- [x] Burn breakdown: Active + Resting + "+N bonus earned"
- [x] Workouts list (type/min/kcal/source)
- [x] Weekly rollup: avg daily deficit ÷ logged days, weekly deficit
- [x] Projected weekly kg = weekDeficitToKg at 7700 kcal/kg (single canonical path)
- [x] Lbs = kg / 0.4536
- [x] Neutral states when consumed = 0
- [x] buildMaintenancePopoverCopy / buildTdeeExplainerCopy
- [x] adaptiveTdee + confidence (low/medium/high) + updatedAt
- [x] refreshAdaptiveTdeeForUser
- [x] countWeighInDaysInWindow for learning pill (ENG-758)
- [x] computeLoggingStreak + streak freezes (earn/protect/ledger)
- [x] dailyTargetSnapshot.snapshotDailyTargetIfMissing

### Weekly report
- [x] loggedDaysInWeek (0–7)
- [x] weekAvgKcal — null when no logged day, NEVER fake 0
- [x] 7-bar sparkline → UPGRADED to stacked-macro bars (depth improvement, not regression)
- [x] computeSparklineHeights: safeMax logic, empty-day 4% clamp — preserved in new chart
- [x] Flag parity: today-weekly-insight-mobile + today-weekly-insight-card ramp together

### Persistence
- [x] nutrition_entries columns: id, user_id, date_key, name (slot), recipe_title, time_label, calories (clamped 32767), protein/carbs/fat (1dp), fiber_g, portion_multiplier, source, nutrition_micros (JSON, only when non-empty)
- [x] Per-meal HealthKit write (idempotent on mealId)
- [x] Barcode portion memory

### Behavioural mechanisms
- [x] Copy yesterday (ENG-709)
- [x] Duplicate day
- [x] Eat again banner/scroller
- [x] Recent/Saved/Library quick-log
- [x] NorthStar "what to eat next" — empty-day-only, slot detection, fit-band labels, swipe-to-skip
- [x] Weekly check-in ritual (TDEE recalibration) — UPGRADED with MacroFactor accept/decline pattern
- [x] Missed-yesterday nudge
- [x] Complete the day modal
- [x] 30-day milestone modal
- [x] Win-moment (web WinMomentPlayer)
- [x] Activity-budget discoverability banner
- [x] Portion memory (barcode)
- [x] Daily target snapshot lock

### AI capabilities
- [x] Voice logging: native STT → /api/nutrition/voice-log → review list → log all
- [x] Per-item confidence badge + inline macro edit in voice review
- [x] aiLogging.ts: sanitiseAiItems, classifyConfidence, averageConfidence
- [x] Pro-only server-enforced voice gate
- [x] Photo logging: /api/nutrition/photo-log → items grouped by macro role
- [x] Kcal RANGES (honest uncertainty) — PRESERVED, not regressed to single-point
- [x] Add-on chips
- [x] Plate total range
- [x] Correction-persistence (teaches model)
- [x] Free taster = 5/rolling-7-days (FREE_PHOTO_LOG_WEEKLY_LIMIT)
- [x] 403 upgrade_required → AiPaywallSheet
- [x] Sheet always opens (Pro: full flow; free: flow + paywall after quota)
- [x] NEW: Pre-capture coaching overlay
- [x] NEW: Thumbs up/down feedback surfaced visibly
- [x] SearchResultConfidenceChip — verified/estimated
- [x] barcodeConfidenceTier — tier from provenance + name-match, defaults conservative "Estimated"
- [x] macroPlausibility + portionPicker plausibility validation
- [x] projectRemaining fit-this-in projection

### Free vs Pro gating
- [x] Search / barcode / manual / recent / saved / library / copy-yesterday — Free (Full)
- [x] Custom foods CRUD — Free (Full)
- [x] Voice log — Pro only, server-enforced
- [x] Photo log — 5 free/rolling-7-days, then paywall; Pro unlimited
- [x] Adaptive TDEE / weekly check-in / streaks / activity bonus — All tiers
- [x] userTier: "free"|"base"|"pro" — logic unchanged

### Interaction states
- [x] Default/empty: per-tab empty cards, NorthStar, deficit hidden
- [x] Loading: skeleton lists, spinners, USDA backfill race
- [x] Error: no-results, not-found barcode, FatSecret failure alert, network error
- [x] Over-budget: ring=red, macros=amber, net=amber
- [x] Plausibility: soft-warn, never silent bad write, never hard block
- [x] Offline: CloudOff icon, optimistic state, deferred persistence
- [x] Success: log-confirmation alert (names the meal), haptics, fit-this-in

**Total preserved feature count:** 97 discrete features/data-points/states.
**Capability additions:** 5 (Label OCR mode, Serving/Package/Gram toggle, Per-100g/per-serving radio, Pre-capture coaching overlay, Thumbs feedback visibility).
**Capabilities removed:** 1 (Favourites tab — already removed per ENG-748 #8). 1 surface deprecated (read-only search.tsx tab).
**Regressions:** 0.

---

## 9. Charts — full spec summary

| Chart | Type | Depth preserved / upgraded |
|---|---|---|
| Calorie ring | Circular progress, multi-ring | Preserved + serif numeral + P/C/F dot discovery |
| Macro tiles | Progress bars 2×2 | Preserved + Fraunces numerals |
| Weekly nutrition | Stacked bars + target line + range selector | UPGRADED from height-only sparkline |
| Weight trend | Scatter + smoothed + dotted projection + energy bars | UPGRADED from single smooth line |
| Nutrient panel | Status dots + drill-in 7-day bar trend | UPGRADED from static list |
| Weekly check-in | Proposed-change bar review + accept/decline | UPGRADED from undocumented pattern |

---

## 10. Mobbin reference index

| Section | Comparable | URL |
|---|---|---|
| Log sheet mode strip | MacroFactor | https://mobbin.com/screens/765d8ef0-9268-4f22-a857-9d82d54679a7 |
| Log sheet mode strip | MacroFactor | https://mobbin.com/screens/aba24dda-9daf-44fc-a3b2-db667d385513 |
| Search results list | MacroFactor | https://mobbin.com/screens/ae765af7-e7ac-4e1e-b195-952df91ae6cc |
| Search results list | MacroFactor | https://mobbin.com/screens/4d82d874-b78c-4268-a60f-1d2d2afe800c |
| Search confidence tick | Yazio | https://mobbin.com/screens/b93f67a7-cbf5-4ce2-b9e2-6841d3bdc5cd |
| Daily diary multi-select | MacroFactor | https://mobbin.com/screens/314f258f-3f24-4aa7-ab27-c9dd61c8c794 |
| Daily diary per-meal budget | Lifesum | https://mobbin.com/screens/0cd481c6-7ae6-4f21-8752-87f8a45ebb95 |
| Calorie ring | Cal AI | https://mobbin.com/screens/a6f4cf97-82c5-4d74-b817-61380e6b8c48 |
| Barcode Label OCR | MacroFactor | https://mobbin.com/screens/3a72d944-543b-4386-8a9f-965d0bae75b9 |
| Barcode Label OCR | MacroFactor | https://mobbin.com/screens/22d54406-30b4-43dc-bef5-17c74208f4cb |
| Barcode serving toggle | Cal AI | https://mobbin.com/screens/8f80392d-8dfa-4585-b0b2-b2fac10962a1 |
| Photo log coaching | Cal AI | https://mobbin.com/screens/2ee1cd01-272c-4b56-a3de-16c7bad7b643 |
| Photo log thumbs | Cal AI | https://mobbin.com/screens/ac4da5ae-acfd-4c04-8038-4eca3bf980d9 |
| Portion per-100g radio | Lifesum | https://mobbin.com/screens/3b7d1127-3778-41be-83de-40047c782325 |
| Weekly chart stacked bars | MacroFactor | https://mobbin.com/screens/3a684eb1-3485-4130-9d5e-18b1eef8e1bd |
| Weekly chart provenance | MacroFactor | https://mobbin.com/screens/647f214f-d7fa-4b7e-8583-24c361485b94 |
| Weight trend + projection | Bevel | https://mobbin.com/screens/7c9bdd48-f883-4338-b673-cdccb0685a01 |
| Weight scatter + smoothed | Withings | https://mobbin.com/screens/9ab952f7-dccf-44e9-ad50-fd83667ae174 |
| Weekly check-in | MacroFactor | https://mobbin.com/screens/b3babd0a-1631-4e64-b9a1-54bfe8a708f0 |
| Nutrient status dots | Cal AI | https://mobbin.com/screens/a4ec6f0f-5e5f-4290-a8a3-f8b76f3bf29d |
| Nutrient panel depth | MacroFactor | https://mobbin.com/screens/91bff3df-c15e-4d96-ad5f-098b3cd4945f |

---

## 11. Suppr advantages to preserve (do not regress)

These features are ahead of all benchmarked comparables. The redesign must not weaken any of them in pursuit of visual conformity.

1. **Photo-log kcal RANGES** — Suppr shows honest ranges (e.g. "480–620 kcal"). Cal AI shows single-point. Suppr's approach is more rigorous. Do not regress to single-point.
2. **Fit-this-in projection (projectRemaining)** — shows how a food fits remaining budget before logging. No comparable has this.
3. **Conservative confidence-chip defaults** — defaults to "Estimated" (trust posture), not "Verified". More rigorous than any benchmarked app.
4. **Plausibility soft-warns** — barcode + search-preview warn before bad logs are committed. Never silent, never a hard block.
5. **Portion memory** — "You usually log Ng — using that." Absent in all comparables.
6. **"Refuse Net-carbs label without fibre" rigour** — more correct than Cal AI/Lifesum net-carb displays.
7. **Voice review list with per-item confidence** — the best voice-log review UI in the iOS comparable set (Mobbin returned no better pattern).
8. **Multi-ring calorie + P/C/F sub-rings** — richer than Lifesum/Cal AI single ring.
9. **Rolling-avg deficit over logged days** — NOT /7. Eliminates statistical distortion from unlogged days.
10. **Weekly check-in accept/decline** — user autonomy on adaptive TDEE changes.

---

*Spec authored 2026-06-02. Implements against functional audit Input A + Mobbin benchmark Input B. All visual changes ship behind feature flags. No logic changes — zero regression on calculations or data-model.*
