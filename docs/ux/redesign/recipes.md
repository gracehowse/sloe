# Recipes / Cookbook Surface — Best-in-Class Redesign Spec

**Version:** 2026-06-02  
**Status:** Design specification — awaiting HTML prototype + flag-gated implementation  
**Surfaces covered:** Library, Recipe Detail, Cook Mode, Shopping List, Verify, Import/Create  
**Platforms:** iOS (primary), Web (parity)  
**Functionality gate:** Every audited feature, data point, rule, and gating must survive this redesign. See §10 for the exhaustive FUNCTIONALITY PRESERVED checklist.

---

## 0. Locked design system (this surface)

All token references in this spec use the warm-coaching direction locked for the redesign. Implementation must map these to the nearest canonical token in `apps/mobile/constants/theme.ts` and `src/styles/theme.css`.

| Role | Hex | Usage on this surface |
|---|---|---|
| Page base | `#FFFFFF` | Screen background — no warm wash |
| Ink / near-black | `#1B1814` | All body text, labels, step text |
| Card surface | `#F6F5F2` | Recipe cards, ingredient rows, tab content areas |
| Hairline border | `#ECEAE4` | Dividers, card outlines, separator lines |
| Terracotta (primary CTA) | `#C2683E` | Save/bookmark active, Log button, Start Cooking CTA, pills active state |
| Muted sage (secondary) | `#7C8466` | Secondary actions, descriptive labels, progress bar fill at comfortable levels |
| Amber (over-budget / alert) | `#C9892C` | "Fits your day" warning + destructive verdict tones; over-budget macro bars |
| Success green | `#5E7C5A` | "Fits your day" success chip, saved bookmark, under-target macro bars |
| Macro colours | Per `brand-tokens.md` `MacroColors` | Protein/carbs/fat/fiber/sugar/sodium dots and bars — unchanged |

**Type roles:**

| Role | Font | Weight | Size (mobile) | Use |
|---|---|---|---|---|
| `display` | Fraunces / Newsreader (serif) | 700 | 28–32pt | Recipe titles, Library header, Cook Mode step headline |
| `title` | Fraunces (serif) | 600 | 20–22pt | Section titles, card titles |
| `headline` | Fraunces (serif) | 600 | 17pt | Kcal headline, sub-section headers |
| `body` | Inter (sans) | 400 | 15pt | Ingredient names, step body text, labels |
| `label` | Inter (sans) | 500 | 13pt | Macro labels, chip copy, filter pills |
| `caption` | Inter (sans) | 400 | 12pt | Disclaimers, "of {target}", provenance lines |
| `mono-data` | Inter (tabular-nums, ss01) | 500 | 15–17pt | Kcal/macro values, stepper counts |

**Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48pt.  
**Radius:** cards 12pt, chips 6pt, images 8pt (inner) / 12pt (outer card clip), bottom sheets 20pt.  
**Imagery rule (hard gate):** ingredient single-subjects = stylised-photoreal on white (keep exactly). Meal/finished-dish photography = hyperrealistic editorial (natural/moody light, ceramic, linen, shallow DOF — `@thelittleplantation` / `@_foodstories_` aesthetic). Never flat stock. Never loose watercolour.

---

## 1. Surface overview

The Recipes surface is the **creative + viral spine** of Suppr. It is where users:

1. Build and browse a personal cookbook (Library).
2. Inspect, verify, and trust the nutritional content of a recipe (Detail).
3. Cook with guided step-by-step support (Cook Mode).
4. Plan grocery runs from their meal plan (Shopping List, under Plan tab).
5. Bring new recipes in via URL, social Reel, photo, or manual entry (Import/Create).

Within the four-tab navigation (Today / Plan / Recipes / Progress), the Recipes tab is the **retention + viral hook** — users who import a Reel and see their macros computed are the activation moment that drives TikTok/IG sharing (the lead viral bet). The redesign must make this moment feel earned, warm, and premium — not clinical.

The surface is **not** a discovery feed. It is a personal library of verified, trusted recipes that fit the user's goals.

---

## 2. Current design audit (weaknesses per surface)

### 2.1 Library

**Weaknesses:**
- Count line ("{N} recipes · {saved} saved") is rendered in sans body — undersells the editorial register.
- Filter pill row overflows invisibly without a "Filter" affordance; plan-import dynamic pills appear without warning.
- Sort cycle (recent → calories → protein) has no visible label between presses — the user doesn't know the current sort.
- Card macro row (`MacroIconRow`) is dense but visually unaccented — all values render at equal weight; protein (the most scanned macro) gets no visual emphasis.
- "Go public" button is a flat inline text row with no visual differentiation from a card action.
- The Discover-redirect-on-empty is correct product behaviour but transitions abruptly — no transitional state.
- Draft badge and bookmark dot use inconsistent positioning (top-left vs top-right) across form factors.
- Hero image placeholder is a grey neutral; not brand-warm.

### 2.2 Recipe Detail

**Weaknesses:**
- Action affordances (Start Cooking, Log, Verify) are scattered vertically — no consolidated verb row.
- "Fits your day" chip renders below the fold on longer headers; users miss the permission signal.
- Gluten trust chip and allergen callout are visually at the same weight as decorative copy — could be missed as a legal surface.
- Servings stepper is bare −/number/+ without a boxed container; looks like a form field, not a deliberate stepper.
- Hero image broken-image fallback (gradient) looks like a loading state, not an intentional fallback.
- Subtitle row (author + meal slot) is clipped on long source hostnames.
- The tab bar (Ingredients / Steps / Nutrition) uses full-width equal-weight tabs — "Ingredients" (the most important tab) gets no visual priority.
- "Calories not yet computed" state does not communicate waiting vs error.
- The sticky footer ("Log all · {kcal} kcal") competes visually with the "Start Cooking" button in a two-CTA race at the bottom of the screen.
- FatSecret attribution badge is a raw text label; not styled as a trust signal.
- Description card and notes card are visually identical to ingredient rows — no hierarchy difference.

### 2.3 Cook Mode

**Weaknesses:**
- Timer is a single suggested pill — no named, multi-timer support when a step contains multiple durations.
- No persistent "Ingredients" quick-access bar during cooking — user must exit to check ingredients.
- The inline-overlay Cook Mode (inside `recipe/[id].tsx`) and the standalone `cook.tsx` are separate implementations with diverging capabilities; the inline version is weaker.
- "Last time" card (cook history) appears before step 1 with no visual separation from the first step.
- Scale presets (0.5/1/1.5/2/4) are a segmented control that takes full width — too prominent for a secondary control.
- Step transition is a flat scroll — no page-turn or slide feel that signals "you're moving forward."
- Completion card mixes rating + note + three action buttons on one screen without clear visual hierarchy.
- "Watch original" pill is bottom-anchored but not always visible when the step text is short.

### 2.4 Shopping List

**Weaknesses:**
- Recipe provenance is inline text ("from {recipe}") with no thumbnail — hard to scan when multiple recipes contribute.
- Ingredient icons are absent — rows are text-only.
- The household banner ("Shared with Sarah & Tom") is a small caption line — undersells the collaborative value.
- Progress card bar is thin and uses a generic neutral colour.
- "Clear all" and "Remove N checked" live in the same overflow menu with no visual priority distinction.
- Export copy has no aisle grouping preview — users don't know what they're sharing.

### 2.5 Verify screen

**Weaknesses:**
- Confidence tier label ("Verified / Partial match / Estimated / Unverified") is text-only — no colour dot or icon reinforces the tier hierarchy.
- The 4-tier system is correct and must be preserved, but the current visual makes all tiers read at equal weight.
- Barcode / Voice / Photo / Add entry points are a flat bottom action row without visual grouping.
- "Edit" button to reach the verify screen from detail is a low-emphasis inline CTA — undersells the importance of verification.

### 2.6 Import / Create

**Createrecipeactionsheet weaknesses:**
- Options (Paste a link / Photo / Manual / Cookbook PDF) are a plain action sheet — no visual affordance for which sources work best.
- No social-platform import guide ("Follow steps on Instagram / TikTok") — the key Reel-import conversion gap.
- Clipboard auto-detect "Paste {host}…" quick action is well-implemented but visually buried.

---

## 3. Per-screen redesign: detailed specification

---

### 3.1 Library

#### Purpose
The user's personal cookbook. Browse, filter, sort, launch detail, create or import. First screen seen on the Recipes tab; must load with editorial warmth to signal "this is your collection, not a database."

#### Information architecture
```
Library screen
├── Header row
│   ├── Serif display title "Your Recipes"        [Fraunces 28pt, #1B1814]
│   ├── Count chip "{N} recipes"                  [Inter label, hairline border, #F6F5F2 bg]
│   └── [Create +] terracotta button
├── Search field                                   [full-width, 12pt radius, #F6F5F2 bg]
├── Filter + Sort row
│   ├── Quick pills (All · Saved · Created · Imported · High-Protein · Quick · Vegetarian)
│   └── "Sort: Recent ▾" explicit label button    [shows current sort; tap cycles + relabels]
├── Dynamic plan-import pills                      [only rendered when plan-import sources exist]
└── Recipe card list (FlatList)
    └── RecipeCard (per item)
```

#### Recipe card redesign

```
┌─────────────────────────────────────────────────────┐
│  [Hero image 116pt full-width, 12pt radius top]     │
│  [Draft badge — top-left: terracotta pill "Draft"]  │
│  [Bookmark dot — top-right: terracotta filled]      │
├─────────────────────────────────────────────────────┤
│  [Title — Fraunces 17pt bold, 2 lines, #1B1814]     │
│  [Creator · meal slot — Inter 13pt, #7C8466]        │
├─────────────────────────────────────────────────────┤
│  MacroIconRow                                        │
│  ● {kcal} kcal  ● {protein}g protein [larger/bold] │
│  ● {carbs}g carbs  ● {fat}g fat  ● {time} min       │
├─────────────────────────────────────────────────────┤
│  [Go Public button — only when applicable]          │
│  [Overflow ··· — top-right of card]                 │
└─────────────────────────────────────────────────────┘
```

**Card visual spec:**
- Background: `#FFFFFF`, border: `1px solid #ECEAE4`, radius: 12pt, shadow: `0 1px 2px rgba(0,0,0,0.04)` (matches `--elev-card`).
- Hero image: `object-fit: cover`, 116pt height on mobile (128pt on web), rounded top corners only.
- Placeholder: warm cream gradient from `#F6F5F2` to `#ECEAE4` (not neutral grey) with a small pan/pot icon in sage `#7C8466`.
- Protein value: rendered at `Inter 500 15pt` with the protein macro colour dot — one visual emphasis per card signals "this is a tracker, not just a recipe app."
- Draft badge: `#C2683E` background, white text "Draft", 4pt radius, 8pt padding horizontal.
- Bookmark (saved state): solid terracotta bookmark icon, top-right 8pt inset; empty state is hairline outline.
- Overflow `···`: top-right corner of card, 32pt hit target, `#1B1814` at 60% opacity.
- "Go public" row: sage `#7C8466` text label + arrow, only rendered when `kind === "created" && !isPublished`; 36pt height, hairline top border.

**MacroIconRow protein emphasis rule:** protein value uses `Type.label` weight 600 and a slightly larger dot (8pt vs 6pt for others). This communicates "this is a fitness-aware recipe app" without adding a separate line.

**Filter pill row redesign:**
- Pills: `#F6F5F2` bg + `#ECEAE4` border when inactive; `#C2683E` bg + white text when active.
- "All ({N})" and "Saved ({N})" show counts inline in the pill.
- Add an explicit **"Filter ▾"** chip at the left of the row that opens a bottom sheet with all facets (entry-kind + nutrition + plan-import). Quick pills remain for the most common 4 (All / Saved / High-Protein / Quick). Plan-import pills only appear in the Filter sheet, not the quick row.
- Sort: replace the invisible cycle with a **"Sort: {label} ▾"** chip that shows the current sort label and opens a 3-option action sheet. Current sort is always visible.

**States:**

| State | Treatment |
|---|---|
| Loading | SkeletonCard rows (3), card shape with animated shimmer, `#F6F5F2` base |
| Zero saved → Discover redirect | Before redirect: 400ms fade showing "Let's find your first recipe →" then cross-fade to Discover. No hard cut. |
| Search no-results | Magnifier icon (sage), "No recipes match "{query}"", "Clear search" link |
| Empty (fallback) | BookOpen icon (sage), 3 CTAs stacked: "Add from a link", "Try the Discover tab", "Enter a recipe manually" — terracotta primary / hairline secondary |
| Pull-to-refresh | System refresh indicator, terracotta tint |

**Interactions:**
- Tap card → push to Recipe Detail (standard push transition).
- Long-press card → haptic (medium) + action sheet (View / Remove from library / Cancel).
- Overflow `···` tap → same action sheet.
- Swipe-to-delete (trailing) — medium haptic, "Remove" label in destructive red, same `confirmRemove` two-step.

**Microcopy (calm-warm-coach voice):**
- Header: "Your Recipes" (not "Cookbook", not "Library" — personal possessive).
- Empty state CTA 1: "Add from a link" (not "Import recipe URL").
- Remove confirm: "Remove from your library? You can always re-save it." (not "Delete").
- Sort options: "Recent", "Most calories", "Most protein".

**Accessibility:**
- Filter pills: `accessibilityRole="button"`, `accessibilityState={{ selected: isActive }}`.
- Card overflow: `accessibilityLabel="{recipe title} options"`.
- Protein value: `accessibilityHint="protein content"` (don't read the dot colour).
- Reduced motion: shimmer skeleton collapses to static `#F6F5F2` fill.

---

### 3.2 Recipe Detail

#### Purpose
The deep recipe + nutrition-verification surface. It must earn trust (verified macros), provide permission ("this fits your day"), and be the launch point for cooking and logging. Every data point from the audit survives here; the redesign reorganises hierarchy without removing depth.

#### Information architecture (top to bottom)

```
Recipe Detail screen
├── Navigation bar (sticky)
│   ├── Back chevron (useSafeBack → Discover)
│   ├── Centred title (normalised, de-CAPS)
│   ├── Bookmark toggle (terracotta when saved)
│   ├── Share icon
│   └── Owner overflow ··· (edit / go public / unpublish / delete — owner only)
├── Hero image (280pt, fallback ladder)
├── Header block
│   ├── Recipe title [Fraunces 28pt, display]
│   ├── Gluten chip + persistent disclaimer caption
│   ├── Subtitle row (author byline + meal slot — tappable)
│   ├── Stats row: time-rings (Prep / Cook) + "Ready by {clock time}"
│   └── Servings stepper (boxed)
├── VERB ACTION ROW (new — primary CTAs consolidated)
│   ├── [Start Cooking] — terracotta filled pill
│   ├── [Log to today] — hairline pill
│   └── [Verify] — sage pill (only when needsReview or low-confidence)
├── FITS-YOUR-DAY VERDICT CHIP (elevated position — below action row)
├── Macro tiles grid (4-up, 2 rows for 5–6 macros)
│   └── Per tile: dot, value, "of {target}", progress bar
├── Kcal headline + "per portion" label
├── Net-carbs lens (when fibre known)
├── Description card (when present)
├── Allergen callout (always rendered — bold ingredient names)
├── Tab bar: Ingredients / Steps / Nutrition
│   ├── Ingredients tab (per-row: confidence dot, name, kcal, amount, tier label, Verify CTA, SourceDot, FatSecret badge)
│   ├── Steps tab (numbered, normalised)
│   └── Nutrition tab (2×2 grid + micronutrients with progress bars)
├── Log to journal card (portion stepper + presets + live kcal + Log button)
├── Recipe Notes card
└── Source attribution card
Sticky footer: "Log all · {kcal} kcal" (hidden in cook mode)
```

#### Hero

- **Image:** 280pt height, `object-fit: cover`, `border-radius: 0` at top of screen (edge-to-edge), subtle 20pt bottom fade overlay to ease transition to content.
- **Fallback ladder:** `image_url` → YouTube thumbnail (maxresdefault → hqdefault) → warm gradient fallback (sage-to-cream), no broken image visible ever.
- **Broken signed-URL detection:** when `heroImageBroken` fires, immediately replace with gradient fallback + a small "Original image unavailable" caption in the source attribution card (not on the hero itself).
- **Overlay:** a 4pt terracotta pill at bottom-left of hero shows the top-matching meal slot ("Dinner", "Lunch") when `source_name` maps to a slot.

#### Header block

**Recipe title:** Fraunces 28pt bold, `#1B1814`, 2–3 lines. `normaliseRecipeDisplayTitle` + `decodeEntities` applied. Runs below the hero image with 16pt top padding.

**Gluten chip + disclaimer:**
- Chip: `#F6F5F2` bg, hairline border, small wheat icon (sage), label from `classifyRecipeGluten`.
- Disclaimer caption (`caption` role, `#7C8466`, 11pt): "Estimated from ingredient names — not a guarantee of gluten content." Always visible directly beneath the chip, never collapsible. This is a legal surface (ENG-748).

**Subtitle row:** author name (tappable, terracotta underline) + meal slot (sage pill). Ellipsis on hostnames > 32 chars.

**Stats row (time-rings, new):**  
Inspired by Kitchen Stories' three-ring pattern. Render up to 2 rings (Prep, Cook). Each ring: a small circular arc in sage `#7C8466` (proportional to duration relative to a 60-min max), with the value below in `mono-data` and a label in `caption`. Greys out when duration unknown (matching `shouldRenderTimeStats` logic). To the right of the rings: **"Ready by {clock time}"** (computed as `now + prep + cook`, formatted as "Ready by 7:45 pm") — a CREME-validated high-utility stat, shown only when both prep and cook are known.

**Servings stepper (boxed, new):**  
Inspired by Kitchen Stories' boxed stepper. Layout:

```
Servings   [−]  [  2  ]  [+]
           ↑ boxed container: #F6F5F2 bg, hairline border, 8pt radius
```

- The current count is inside a `#F6F5F2` rounded box (32pt × 32pt on mobile) — visually signals "this is a stepper, not a text field."
- Owner pencil icon (sage) to the right of the stepper row → yield-edit modal (unchanged).
- Secondary line below: "{total} kcal total for {N} portions" — italic `caption`, only when scaled from base yield.
- Deep-link `?portion=N` seeds correctly (unchanged).

#### Verb action row (new, consolidated)

This is the single biggest hierarchy improvement. Current: actions scattered across the screen. New: a horizontal pill bar below the stats/servings block.

```
┌──────────────────┐ ┌────────────────┐ ┌──────────────┐
│  Start Cooking   │ │  Log to today  │ │    Verify    │
│  (terracotta)    │ │  (hairline)    │ │  (sage)      │
└──────────────────┘ └────────────────┘ └──────────────┘
```

- "Start Cooking" → `setCookMode(true)` (inline cook overlay) OR pushes to standalone `cook.tsx` once the inline/standalone duplication is resolved (see §9 structural note).
- "Log to today" → scrolls to the log card below (same screen) OR triggers the sticky footer log. Which is canonical must be decided before implementation; log card below is the fuller UX (portion stepper + presets).
- "Verify" → only rendered when `ingredientShouldShowVerifyCta` or `needsReview` is true. Renders in sage to signal "helpful but not urgent." When all ingredients are verified, this slot is empty (no phantom "Verify" on a clean recipe).
- All three pills: `Fraunces 15pt medium`, height 44pt, `PressableScale` spring (0.96 scale on press).
- On web: same row, rendered as `<button>` elements with cursor:pointer, hover state `#F6F5F2 → #ECEAE4`.

#### Fits-your-day verdict chip (elevated position)

Moved from below the macro tiles to **immediately below the verb action row** — this is the "permission signal" and must be the first thing a goal-conscious user sees after the CTAs.

Three states, all rendered as a wide tinted chip (full-width minus 32pt margins):

| State | Background | Icon | Label | Logic |
|---|---|---|---|---|
| Success | `#5E7C5A` at 12% alpha, `#5E7C5A` border | CheckCircle (success green) | "Fits your day — uses {X}% of your remaining calories" | kcal ≤50% of day target |
| Warning | `#C9892C` at 12% alpha, `#C9892C` border | AlertCircle (amber) | "Takes up {X}% of today's remaining calories" | 51–99% |
| Over | `#C9892C` at 20% alpha, `#C9892C` border | AlertTriangle (amber) | "This would take you over your daily target" | ≥100% |

**Framing toggle (new, MacroFactor-validated):** A small toggle inside the chip: "Remaining ↔ Total day". In "Remaining" mode (default) the % is vs remaining kcal today. In "Total day" mode the % is vs the full day target. This is the MacroFactor consumed/remaining framing applied to the recipe context. Toggle state is local (not persisted). The 3-tone logic applies to both modes. "Calories not yet computed" state: chip renders in neutral `#F6F5F2` with an hourglass icon and "Computing nutrition…" — never shows a zero-kcal verdict.

#### Macro tiles grid

Keep the current 4-up flex grid with 2 rows for 5–6 macros. Visual spec upgrade:

- Each tile: `#F6F5F2` background, `#ECEAE4` 1pt border, 8pt radius, 12pt padding.
- Macro dot: 8pt circle, macro colour from `MacroColors`.
- Value: `mono-data` 20pt, `#1B1814`.
- "of {target}g" caption: `caption` 11pt, `#7C8466`.
- Progress bar: 4pt height, `#ECEAE4` track, macro colour fill, `border-radius: 2pt`. Over-target: amber `#C9892C` fill (not destructive red — per brand rules; calorie ring is the exception, macros use amber).
- Net-carbs: only when fibre is known. Label switches from "Carbs" to "Net carbs" with a small info `ⓘ` icon that explains the calculation on tap. Never renders if fibre is unknown (existing `netCarbsForRow` logic unchanged).
- Sugar ref target 50g, sodium 2300mg — unchanged.

#### Kcal headline

Moves to below the macro tiles (not above them). Layout: `{kcal} kcal` in Fraunces 22pt, `· per portion` in Inter caption inline. Hidden when ≤0 (unchanged).

#### Allergen callout redesign

Inspired by HelloFresh's bold-allergen-name pattern:

- Card: `#F6F5F2` bg, `#ECEAE4` border, 12pt radius.
- Header: "Contains" in `label` Inter 13pt sage. Allergen names: **bold** `#1B1814` inline. Example: "Contains **Gluten** · **Dairy** · **Eggs**".
- When no allergens tagged: "Not tagged for allergens — add tags to ingredient rows" in caption style.
- Never paywalled (hard gate — T12/DI-P0-01 unchanged).

#### Tab bar: Ingredients / Steps / Nutrition

- Make "Ingredients" visually primary: bold `label` text, terracotta underline when active. "Steps" and "Nutrition" are regular weight.
- Active tab: terracotta `#C2683E` 2pt underline, full label in `#1B1814`.
- Inactive tabs: `#7C8466` labels.

**Ingredients tab rows (visual upgrade):**
- Row layout: [confidence dot 8pt] [name, body] [kcal, caption right-aligned] [amount/unit, caption] [tier label + Verify CTA].
- Confidence dot colour: success green = Verified, sage = Partial, amber = Estimated, neutral grey = Unverified. The 4-tier system is preserved exactly.
- Tier label: a small `caption` chip (`#F6F5F2` bg, hairline border) to the right of the name: "Verified", "Partial match", "Estimated", "Unverified". Colour matches dot.
- "Verify →" CTA: terracotta text link, only rendered per `ingredientShouldShowVerifyCta` (unchanged).
- SourceDot: 6pt circle using `--source-*` tokens, right edge.
- FatSecret badge: styled as a small trust chip with the FatSecret logo + "FatSecret" text, `#F6F5F2` bg, hairline border — not a raw text label.
- Kcal suppressed at 0 (unchanged — F4, never display confident-zero).

**Nutrition tab micronutrients (visual upgrade):**
- Fiber / Sugar / Sodium rows: each gets a colour-matched progress bar (fiber = `#4a7878`, sugar = `#E8721E`, sodium = `#F78A32`).
- Row hidden when value is 0 (unchanged).
- FatSecret badge appears at the bottom of the tab (not inline on each row).

#### Log to journal card

- Card: `#F6F5F2` bg, 12pt radius, 16pt padding.
- Portion stepper: same boxed design as servings stepper above.
- Presets: {0.5×, 1×, 1.5×, 2×} as hairline pill row.
- Live kcal: `mono-data` 20pt centre-aligned, updates on stepper change.
- **Log** button: terracotta, full-width, 50pt height, Fraunces 15pt. Success haptic + "Logged" → check animation (spring, 150ms, `--ease-spring-soft`).
- Coercion guard (`wouldCoerceMacros`): when triggered, the Log button becomes disabled and a warning chip appears: "Nutrition needs review before logging" with a "Verify now →" terracotta link. Never routes to a silent log.

#### Recipe Notes card

- `RecipeNotesCard.tsx` visual update only: card bg `#F6F5F2`, star rating uses terracotta filled/outline stars (not yellow), note textarea has `#ECEAE4` border.
- 5-star rating: terracotta filled for rated stars, sage outline for unrated. Rating preserved on mount.

#### Source attribution card

- Three modes (name+url / url-only / name-only) unchanged.
- Visual: caption-weight text, sage colour, external link icon. Never synthesises URL.

#### Sticky footer

- "Log all · {kcal} kcal": dark background `#1B1814`, white Fraunces 15pt text, 56pt height, full-width.
- Hidden during cook mode (unchanged).
- When `wouldCoerceMacros` is true, footer becomes disabled + shows "Review nutrition first".

#### States

| State | Treatment |
|---|---|
| Loading | Header + hero skeleton: shimmer rectangles in `#F6F5F2` / `#ECEAE4` |
| Hero image broken | Warm gradient fallback (sage→cream); "Original image unavailable" in source attribution |
| All macros zero | Macro tiles show `—` values, fits-verdict chip shows "Computing nutrition…" with hourglass |
| Coercion guard triggered | Log button + footer disabled; warning chip with "Verify now →" |
| needsReview nudge | One Alert on mount: "Some ingredients have low confidence — verify for accuracy." "Verify" + "Skip" actions. At most one per recipe per mount (unchanged). |
| Not found | `app/recipe/[id]/not-found.tsx` preserved |

#### Accessibility

- Servings stepper: `accessibilityRole="adjustable"`, `accessibilityValue={{ now: viewServings, min: 1, max: 99 }}`.
- Confidence tier: `accessibilityHint` describes tier in words ("Verified by USDA" etc.), numeric % never read aloud.
- Macro progress bars: `accessibilityValue={{ now: value, max: target }}`, `accessibilityLabel="{macro}: {value}g of {target}g target"`.
- Fits-your-day chip: live region so VoiceOver re-reads when servings change.
- Log button: `accessibilityLabel="Log {scaledForLog.calories} kcal to today's journal"`.

---

### 3.3 Cook Mode

#### Purpose

Hands-busy guided cooking. Must keep the screen on (`useKeepAwake`), handle multiple concurrent timers, provide mid-cook ingredient reference, and capture a post-cook reflection (rating + note + regulars). The standalone `cook.tsx` is canonical (see §9 — resolve inline/standalone duplication before redesigning).

#### Information architecture

```
Cook Mode (full-screen, standalone cook.tsx)
├── Navigation: "← {recipe title}" (Fraunces 15pt) + scale control (compact, top-right)
├── Progress bar (thin, terracotta, top of screen)
├── "Last time" card (first visit only, collapsible)
├── Step region (primary — fills viewport)
│   ├── Step number [caption, sage]
│   ├── Step text [rescaled: scaleAmountText applied] [body, 18pt, #1B1814]
│   └── Highlighted amounts (terracotta bold inline)
├── Timer row
│   ├── Named timer pills (one per parsed duration in step — multi-timer)
│   └── Manual stopwatch pill (count-up, always available)
├── Bottom utility bar (persistent, new)
│   ├── [◀ Prev] — sage icon, disabled on step 1
│   ├── [Ingredients] — opens Ingredients bottom sheet
│   ├── [▶ Next] — terracotta, disabled on last step
│   └── [Watch ↗] — only when sourceUrl set (opens video)
└── Completion card (last step → tap Next)
    ├── "You did it" headline [Fraunces 28pt, display]
    ├── "Took you {N}m {S}s" + "You usually cook this in {N} min" [mono-data + caption]
    ├── 5-star rating row [terracotta stars]
    ├── Cook note textarea [500-char cap]
    ├── [Save this cook] — terracotta, primary
    ├── [Add to my regulars] — hairline secondary
    ├── [Log this meal] — hairline secondary
    └── [Skip] — caption link
```

#### Scale control

Move the scale segmented control from full-width to a **compact popover pill** in the top-right nav area: "1× ▾". Tap → a 5-option popover (0.5× / 1× / 1.5× / 2× / 4×). Current scale shown inline. Persisted per (userId, recipeId) via `cookScaleStorageKey` (unchanged). This frees vertical space for the step text.

#### Step region

- Step text: Inter body 18pt (larger than current for hands-busy legibility), `#1B1814`, leading 1.5.
- `scaleAmountText` highlights scaled amounts inline in **terracotta bold** — so "200g" becomes visually prominent when the user is looking at ingredients mid-cook.
- Step number: sage caption "Step 3 of 8" — top of region, left-aligned.
- Step transition: page-slide animation (0.25s, `--ease-decel`) — left-to-right on Next, right-to-left on Prev. Respects `prefers-reduced-motion` (falls back to cross-fade).

#### Named multi-timer tray (new — HelloFresh-validated)

Each step can contain multiple durations parsed by `parseTimersInStep`. Current: single suggested pill. New:

- Each parsed duration becomes a **named timer pill**: "[⏱ Boil pasta — 9:00]" where the label is the noun phrase preceding the duration in the step text.
- Active timer pill: terracotta bg, white countdown, pulsing border ring.
- Multiple timers run concurrently: pills stack in a horizontal scroll row.
- Timer done: success haptic + "Step done?" Alert ("Restart / Next step") — unchanged behaviour.
- Manual stopwatch pill: always present, sage bg, counts up from 00:00.
- "Recipe timers" summary: when ≥2 timers active, a small chevron-down pill shows all active timers in a bottom sheet tray.

#### "Last time" card

- Only shown at the start of a session (pre-step-1).
- Card: `#F6F5F2` bg, hairline border. Shows last 3 cooks from `listRecentCookHistory` with date + duration.
- "Dismiss" tap collapses with spring animation and doesn't show again this session.

#### Persistent bottom utility bar (new — CREME-validated)

Always visible, regardless of step position. Four tappable zones:

| Zone | Icon | Action |
|---|---|---|
| Prev | ChevronLeft (sage) | Go to previous step; disabled + 40% opacity on step 1 |
| Ingredients | UtensilsCrossed (sage) | Opens Ingredients bottom sheet (list from detail screen's ingredient tab) |
| Next | ChevronRight (terracotta) | Go to next step; on last step → triggers completion card |
| Watch original | ExternalLink (sage) | Opens `sourceUrl` / `sourceVideoUrl`; only rendered when URL exists |

- Bar bg: `#FFFFFF`, 1pt hairline top border `#ECEAE4`, 52pt height, safe-area-bottom padding.
- "Ingredients" sheet: a bottom sheet with the full ingredient list (same render as Ingredients tab), scaled to current cook scale, read-only.

#### Voice handsfree shell

`COOK_HANDSFREE_FEATURE_ENABLED` remains gated OFF. The toggle renders with honest copy: "Hands-free voice coming soon — we don't record audio yet." Keep-awake banner and toggle persist. No behaviour change — shell is intentionally explicit, not fake. (`docs/decisions/2026-05-01-cook-voice-handsfree.md` remains canonical.)

#### Completion card

- "You did it" in Fraunces 28pt. Sub-line: "Took you {N}m {S}s · You usually cook this in {N} min" in mono-data + sage caption.
- 5-star row: terracotta filled/outline stars, 32pt hit target each.
- Note textarea: `#F6F5F2` bg, hairline border, placeholder "How did it turn out?", 500-char cap `COOK_NOTE_MAX_LEN`.
- "Save this cook": terracotta, full-width, `insertCookHistory` (Supabase + AsyncStorage fallback, idempotent — unchanged).
- "Add to my regulars": hairline pill, `createSavedMeal` at cook scale, slot via `pickDefaultRegularsSlot` — unchanged.
- "Log this meal": hairline pill, pushes to `/recipe/{id}?autoLog=1&portion={scale}` — unchanged.
- "Skip": caption link, sage.

#### Analytics events preserved

`cook_mode_opened`, `recipe_timer_started`, `recipe_timer_completed`, `recipe_scale_changed`, `cook_history_saved`, `saved_meal_created`, `cook_handsfree_toggle`, `cook_handsfree_enabled`, `cook_mode_log_tapped`, `cook_watch_original_tapped` — all unchanged.

#### States

| State | Treatment |
|---|---|
| Steps fail-safe parse error | Fall back to step array ["Add steps to this recipe"]; CM1 unchanged |
| Single step | No Prev/Next; utility bar shows only Ingredients + Watch |
| No sourceUrl | Watch pill hidden |
| All macros zero on completion log | Same coercion guard as detail; "Log" in completion card disabled + "Verify first" copy |

---

### 3.4 Shopping List

> Note: Shopping List lives under the Plan tab chrome (`PlanTabChrome`), not the Recipes tab. It is documented here because it is part of the Recipes surface scope.

#### Purpose

Aggregate planned-meal ingredients, grouped by supermarket aisle, with household realtime sync and per-item check attribution. The provenance story (which recipe each ingredient comes from) must be immediately scannable.

#### Information architecture

```
Shopping List
├── Header: "Shopping" [Fraunces 28pt] + scope indicator (solo / household name)
├── Household banner (when household active): "Shared with {names}" + action verb "Manage →"
├── Recipe provenance strip (horizontal scroll — new)
│   └── Recipe thumbnail pills (each: 36pt square image + recipe title, truncated)
├── Progress card: "{N} of {total} checked" + terracotta progress bar
├── Aisle sections (sorted by supermarket aisle order — sortShoppingCategories)
│   └── Per aisle: section header [Fraunces 15pt bold] + item count chip
│       └── Per item row:
│           ├── Ingredient icon (small food category glyph, sage)
│           ├── Name [body, #1B1814]
│           ├── Amount / unit [caption, right-aligned]
│           ├── "Used in {N} recipes" or "from {recipe}" [caption, sage]
│           └── Check state: tap = toggle; household check = member initial chip
├── Checked items section (collapsible — "Checked · {N}")
│   └── Checked rows (greyed out: #7C8466 name, strikethrough)
└── Footer row: [Clear checked] + [Export ↗]
```

#### Recipe provenance strip (new — Recime-validated)

A horizontally-scrollable strip of recipe thumbnails at the top of the list, above the aisle sections:

- Each pill: 44pt × 44pt rounded image + recipe title truncated to 1 line, separated by 8pt gaps.
- Tapping a pill filters the list to only ingredients from that recipe (tap again to clear).
- "All recipes" pill at the left (selected by default).
- This replaces the invisible inline "from {recipe}" text for multi-recipe lists.

#### Per-item ingredient icon

A small food-category icon (24pt, sage `#7C8466`) at the left of each row. Category inferred from the aisle assignment. Sourced from `lucide-react-native`: Beef → Drumstick, Dairy → Milk, Produce → Leaf, Pantry → Package, Bakery → WheatSlash, etc. When no category matches: a neutral Circle icon.

#### Household check attribution

Member initial chip: `#F6F5F2` bg, hairline border, member initials in 11pt, member accent colour dot. "{Initial} checked" caption below. Unchanged logic — visual upgrade only.

#### Progress bar

Terracotta `#C2683E` fill on `#ECEAE4` track, 6pt height, 4pt radius. "5 of 12 checked" in mono-data + caption inline.

#### Checked section

Collapsible section at the bottom: "Checked · {N}" header with ChevronDown/Up, collapsed by default once ≥1 item checked. Checked rows: `#7C8466` text, strikethrough, 80% opacity image. "Clear all checked" destructive text at bottom of section.

#### Export

"Export ↗" button opens native share with text formatted as:
```
Shopping list from Suppr

🥬 Produce
- Baby spinach, 200g (Salmon & Spinach Bowl)
- Cherry tomatoes, 150g (2 recipes)

🥛 Dairy
- Greek yoghurt, 250g (Overnight Oats)
```
Emoji per aisle, provenance in parentheses. No fake price total (no price data available — not fabricated per trust posture).

#### Realtime sync

Supabase channel `postgres_changes` unchanged. Stale reconciliation (`shoppingItemsTiedToCurrentPlan`) unchanged. JSON fallback (`shoppingJsonFallback`) unchanged.

#### States

| State | Treatment |
|---|---|
| Empty | Cart icon (sage), "Plan your meals to build a shopping list", "Go to plan →" terracotta link |
| Loading | 3 section skeleton rows, shimmer |
| Household sync banner | "Shared with {names} — they can see and check items in real time" |
| All items checked | Progress card shows "All done — ready to cook!" with CheckCircle (success green) |

---

### 3.5 Import / Create

#### Purpose

Bring new recipes into the library. The **viral activation surface** — a user who imports a Reel and sees macros computed is the north-star moment for TikTok/IG growth. The redesign must make the import flow feel instant and trustworthy.

#### Source picker (CreateRecipeActionSheet redesign — Julienne-validated)

Replace the plain action sheet with a **4-tile serif source picker** bottom sheet:

```
┌────────────────────────────────────────────────────────┐
│  Add a recipe                                           │
│  [Fraunces 22pt, display]                               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │              │  │              │                    │
│  │  🔗          │  │  📹          │                    │
│  │  From a link │  │  From video  │                    │
│  └──────────────┘  └──────────────┘                    │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │              │  │              │                    │
│  │  📷          │  │  ✏️          │                    │
│  │  From photo  │  │  Write it in │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                         │
│  [Paste {host}… quick action — when clipboard detected] │
└────────────────────────────────────────────────────────┘
```

- Tiles: `#F6F5F2` bg, `#ECEAE4` border, 12pt radius, 64pt height each. Icon (lucide, 24pt, `#1B1814`) top-left, label (Fraunces 15pt) bottom-left.
- "From video" is a new explicit tile (Video is the Reel-import path). Tapping → same `import-shared` route but with `sourceHint=video` query param for import error copy and UI guidance.
- "Cookbook PDF" tile is **not shown** (flag-gated off, ENG-742). The tile can be added to the sheet when the flag turns on — don't break the sheet layout by leaving a 3-tile asymmetry. When flag off, render as 4 tiles (link, video, photo, manual).
- Clipboard auto-detect: "Paste {host}…" renders as a full-width terracotta pill above the tiles when a recipe URL is on the clipboard. Most common import path for link users — keep prominent.

#### Per-platform import guide (new — Recime-validated)

When the user taps "From a link" or "From video" and the clipboard does not have a matching URL, show a **platform guide bottom sheet** before the URL input:

```
How to import from Instagram

1. Find the Reel you want
2. Tap the Share button (↗)
3. Tap "Copy link"
4. Come back to Suppr — we'll detect it automatically

[Or paste a link →]

─────────────────────────────
  Also works with:
  [TikTok] [YouTube] [Safari] [Chrome]
```

- Platform options: Instagram / TikTok / YouTube / Safari / Chrome (each with a small platform icon).
- Copy is warm-coach: "Find the Reel you want" not "Step 1: Locate URL."
- This guide is the Reel-import conversion unlock — without it, users don't know how to get the share link.
- "Or paste a link →" goes straight to the URL input (for power users).

#### Import loading / processing state

When import is in progress, show a **dedicated processing screen** (not a spinner over a blank page):

- Suppr wordmark centre-top.
- Animated ingredient icons drifting upward (subtle, reduced-motion-safe).
- Rotating copy: "Reading the recipe…", "Matching ingredients…", "Computing your macros…"
- This is the moment of magic — the warm animation earns the trust before the verify step.

#### Error states

`IMPORT_ERROR_COPY` preserved exactly. Errors render in the warm-coach voice, never as raw technical messages.

#### Cookbook PDF

Flag `cookbook_import_enabled` gated OFF (ENG-742). Route `apps/mobile/app/cookbook-import.tsx` preserved. 4MB client cap preserved. Free save cap preserved. No UI change until flag turns on.

---

### 3.6 Verify screen

#### Purpose

Per-ingredient verification editor. The trust spine of the product — this is where fabricated macros are refused and real ones are confirmed. The redesign elevates the visual clarity of confidence tiers without simplifying the 4-tier system.

#### Information architecture

```
Verify screen
├── Header: "Verify ingredients" [Fraunces 22pt] + "{N} of {M} verified" progress
├── Caption-nutrition claim panel (when `extractCaptionNutrition` finds claims)
├── Ingredient list
│   └── Per ingredient:
│       ├── [Confidence dot + tier chip]
│       ├── [Ingredient name, body]
│       ├── [Macro ring — calories/protein/carbs/fat micro-ring]
│       ├── [Amount, unit, grams — inline editable]
│       └── [Action icons: Search / Barcode / Voice / Photo]
├── Add ingredient row [+ Add an ingredient]
└── Footer: [Save verified] terracotta | [Skip for now] caption link
```

#### Ingredient row redesign (Bevel-validated)

Each ingredient is a card (not a flat row):

- Card: `#FFFFFF` bg, `#ECEAE4` border, 8pt radius, 12pt padding.
- Left: confidence dot (8pt, colour matches tier) + tier chip (`#F6F5F2` bg, hairline border, tier label — 4 tiers preserved: Verified / Partial match / Estimated / Unverified).
- Centre-left: ingredient name `body`, amount/unit `caption`.
- Centre-right: **macro ring** (small 32pt donut chart showing P/C/F split from ingredient macros) + kcal value in `mono-data` 13pt.
- Right: chevron into ingredient detail (Bevel pattern).
- Tap row → ingredient detail sheet: macro ring (larger, 64pt), per-100g amount stepper, Remove / Edit actions (Bevel pattern). This replaces the current Alert-tap-row behaviour with a richer sheet.

**Action icons row (below ingredient list):** Search food / Scan barcode / Voice log / Photo log — rendered as 4 equal icon+label tiles in `#F6F5F2` cards (same 4-tile pattern as source picker).

**Caption-nutrition reconciliation panel:** when `extractCaptionNutrition` finds claims from the source caption, render a card at the top: "Source claims: {N} kcal · {P}g protein" with a `nutritionDelta` comparison to the computed values. "Matches" = success green chip; "Differs by {X}%" = amber chip. This panel is informational — it does not block save.

**Confidence tier visual (hard gate):** the 4-tier system (Verified / Partial match / Estimated / Unverified) is NOT collapsed to a binary check/cross. Bevel's binary tick is a worse model than Suppr's 4-tier trust system. Borrow Bevel's visual (dot + card + chevron), keep Suppr's tiers.

**FatSecret attribution:** preserved per ToS. Rendered as a trust chip at the foot of the screen: "Nutrition data from FatSecret" + FatSecret logo.

**Coercion guard:** `saveVerifiedIngredients` checks `wouldCoerceMacros` before saving. If triggered, "Save verified" is disabled + "Macros don't add up — check the values above" warning chip. Never saves fabricated macros.

**Standard units table:** g / oz / tbsp / tsp / cup / ml — all preserved. Unit picker in ingredient detail sheet.

---

## 4. Web parity specification

Web is a required parallel surface. All visual changes above apply to web equivalents. Specific parity notes:

| Feature | Mobile | Web | Parity action |
|---|---|---|---|
| Verb action row | `recipe/[id].tsx` | `RecipeDetail.tsx` | Add verb action row to web detail, same 3-pill layout |
| Boxed servings stepper | `recipe/[id].tsx` | `RecipeDetail.tsx` | Apply boxed container styling to web stepper |
| Fits-your-day framing toggle | New | New | Ship on both simultaneously |
| Named multi-timer tray | `cook.tsx` | `CookMode.tsx` | Web cook mode needs timer tray (currently simpler) |
| Cook completion card (rating+notes+regulars) | `cook.tsx` | `CookMode.tsx` | Web cook mode has simpler completion — parity required |
| Recipe provenance strip (Shopping) | `shopping.tsx` | `ShoppingList.tsx` | Add to web shopping list |
| 4-tile source picker | `CreateRecipeActionSheet.tsx` | `RecipeUpload.tsx` | Web upload modal should adopt 4-tile layout |
| Per-platform import guide | `import-shared.tsx` | Web import flow | Add guide to web import |
| Recipe Go Public | `library.tsx` + detail | `Library.tsx` + detail | Converging (ENG-700) — parity in this redesign |
| Apple HealthKit meal write | Mobile-only | No equivalent | Documented native carve-out — not a parity gap |
| Voice handsfree shell | Mobile-only | Not in web cook | Documented mobile-only shell — not a parity gap |

**Web-specific layout notes:**
- Library: 3-column grid on desktop (not 1-column mobile list). Cards same visual spec; hero image 160px height on desktop.
- Recipe Detail: two-column layout on desktop — hero + header + verb row + verdict chip left; tabs + log card right (sticky).
- Cook Mode: centred single-column on desktop, max-width 640px.
- Shopping List: two-column on desktop — aisle sections left, recipe provenance strip + progress card right.

---

## 5. Motion + interaction spec

| Interaction | Motion | Timing | Reduced-motion fallback |
|---|---|---|---|
| Card press | PressableScale 0.97 | 100ms | None (no scale) |
| Log button confirm | Scale 0.96 → 1.0 + checkmark swap | 150ms spring `--ease-spring-soft` | Instant state swap |
| Cook step transition | Page slide (horizontal) | 250ms `--ease-decel` | Cross-fade 200ms |
| Timer pill start | Border ring pulse | 1.5s loop | Static terracotta border |
| Timer done | Success haptic + Alert | Immediate | Same (haptic is native) |
| Fits-verdict chip framing toggle | Cross-fade text | 150ms | Instant |
| Bookmark save | Scale pop 1.0 → 1.2 → 1.0 | 300ms spring | Instant |
| Import processing icons | Slow drift upward | 3s ease-in-out loop | Static icon |
| Bottom sheet present | Spring up from bottom | 350ms `--ease-spring-soft` | Slide up 250ms |

---

## 6. Microcopy reference (calm-warm-coach voice)

| Current copy | Redesigned copy | Rationale |
|---|---|---|
| "Remove from library" | "Remove from your library" | Possessive = warmer |
| "Delete recipe" | "Delete this recipe" | Softer, specific |
| "Calories not yet computed" | "Computing nutrition…" | Active vs passive |
| "No results for {q}" | "Nothing matched "{q}" — try a different word" | Friendly, actionable |
| "Estimated from ingredient names" | "Estimated from ingredient names — not a guarantee of gluten content" | Already good; keep exactly |
| "Verify →" | "Check nutrition →" | More human for non-expert users |
| "Add to my regulars" | "Add to my regulars" | Keep — personal, direct |
| "Watch original" | "Watch original recipe" | Clearer |
| "Skip" (cook completion) | "Skip for now" | Less abrupt |
| "You usually cook this in N min" | "You usually cook this in about N min" | Softer qualifier |
| "Shared with Sarah & Tom" | "Shared with Sarah & Tom — they can check items too" | Action context |
| "Paste a link" | "From a link" | Consistent with tile labels |

All copy: past-day actions in past tense, live data in present tense. No diet culture language. No "amazing", "incredible", "powerful." Warm but grounded.

---

## 7. Free vs Pro gating (preserved)

All gating logic is **unchanged**. Visual redesign does not move gate positions.

| Gate | Preserved |
|---|---|
| Free save limit 10 recipes (`FREE_SAVE_LIMIT`) | Yes — client + DB trigger |
| Over-cap saves preserved | Yes |
| Voice logging Pro-only server-enforced | Yes — `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md` |
| Shopping-list tier gating decision | Yes — verify exact gate; not currently enforced in `shopping.tsx` |
| Cook mode, detail, verify, allergen, gluten chip | Not paywalled — preserved |
| Cookbook PDF free save cap | Yes — `COOKBOOK_IMPORT_FREE_SAVE_CAP`, flag-gated off |

---

## 8. Implementation notes (for executor)

1. **Structural blocker — resolve before coding Cook Mode:** The inline cook overlay (Modal inside `recipe/[id].tsx`) and the standalone `cook.tsx` are two separate implementations. **Pick `cook.tsx` as canonical.** The inline overlay should be a thin navigation shim that immediately pushes to `cook.tsx` rather than rendering a separate Cook Mode. This eliminates the risk of the named-timer tray + rating/regulars logic existing only in the standalone version.

2. **Feature flag required:** All visual changes in this spec ship behind `isFeatureEnabled("recipes_redesign_v1")`. Old path stays alive in the `else` branch. Ramp via PostHog after HTML prototype sign-off.

3. **Screen file size:** `recipe/[id].tsx` is 3,429 lines — massively over the 400-line cap. The redesign is the right moment to extract: `useRecipeDetail()` hook for all state/data/logic; `RecipeHeaderBlock`, `VerbActionRow`, `FitsYourDayChip`, `MacroTilesGrid`, `RecipeTabBar` as separate component files. The screen file becomes a thin composition shell. Same for `cook.tsx` (1,675 lines) → `useCookMode()` hook + `CookStepRegion`, `CookTimerRow`, `CookUtilityBar`, `CookCompletionCard` components.

4. **HTML prototype required before coding:** per `feedback_html_prototypes_before_coding.md`, a static HTML prototype (iPhone frame) of the verb action row + fits-verdict chip + macro tiles must be approved by Grace before production code lands. Use the existing prototype infrastructure at `docs/prototypes/`.

5. **Web cook mode parity:** `src/app/components/CookMode.tsx` needs the named-timer tray + completion card parity before this spec is considered shipped. Track as a separate Linear issue; mark this spec blocked on that parity.

6. **Calorie ring colour override applies to calorie ring only.** On the recipe detail macro tiles, over-budget uses amber `#C9892C` — not destructive red. The fits-verdict chip amber-over-budget maps to `Accent.warning`, not `Accent.destructive`. Only the calorie ring on Today uses destructive red for over-budget.

---

## 9. Structural decision required (pre-implementation gate)

**Before any implementation begins:** decide whether `cook.tsx` (standalone) or the inline Modal in `recipe/[id].tsx` is canonical.

- Recommendation: `cook.tsx` is canonical. The inline Modal should push to it. This is the only way to guarantee the named-timer tray, cook-history, completion card, rating, and "add to regulars" are always available regardless of entry point.
- This decision must be recorded in `docs/decisions/` before implementation.
- Until it is resolved, Cook Mode cannot be safely redesigned.

---

## 10. FUNCTIONALITY PRESERVED checklist

Every feature, data point, rule, state, and gate from the functional inventory (Input A) is listed below with its preservation verdict.

### Library screen

- [x] Recipe count line ("{N} recipes · {savedCount} saved") — preserved, upgraded to serif display
- [x] Sort cycle: recent → calories → protein (`cycleSort`, `SortKey`) — preserved, now with visible label
- [x] Create button → `CreateRecipeActionSheet` — preserved, now 4-tile bottom sheet
- [x] Search input, persisted via `useLibrarySearchStore` — preserved (unchanged)
- [x] Filter pills: All / Saved / Created / Imported / High-Protein / Quick / Vegetarian — preserved, reorganised into quick strip + Filter sheet
- [x] Dynamic plan-import pills from `sourceName` — preserved, moved to Filter sheet to avoid overflow
- [x] "All" and "Saved" counts in pills — preserved
- [x] `classifyLibraryEntry` (saves win over authorship — GW-01 fix) — preserved (logic unchanged)
- [x] `matchesNutritionPill`, `planImportFilterLabels`, `matchesPlanImportPill` — preserved
- [x] Hero image 128pt, `RecipeCardImage`, fallback to `pickDefaultImage` — preserved, placeholder colour upgraded
- [x] Draft badge — preserved, restyled
- [x] Bookmark dot (terracotta filled when saved) — preserved
- [x] Overflow `···` → action sheet: View / Remove (two-step) / Cancel — preserved
- [x] Title (2 lines), creator name — preserved
- [x] `MacroIconRow` — preserved, protein value given visual emphasis
- [x] "Go public" button (owner only) — preserved, visual upgrade
- [x] Tap → `/recipe/{id}`, long-press → `confirmRemove` — preserved
- [x] Empty (zero saved) → Discover redirect on focus (ENG-100) — preserved, transition improved
- [x] Loading spinner → skeleton — upgraded to shimmer skeleton
- [x] Search no-results state — preserved
- [x] Empty fallback: 3 CTAs — preserved
- [x] Pull-to-refresh — preserved
- [x] `useSavedLibraryRecipes`, `useSavedRecipes` — preserved (data layer unchanged)

### Recipe Detail

- [x] Back chevron (`useSafeBack`) — preserved
- [x] Centred title (`normaliseRecipeDisplayTitle` + `decodeEntities`) — preserved
- [x] Save/bookmark toggle (`toggleSave`) — preserved
- [x] Share (`webRecipeDeepLink`) — preserved
- [x] Owner overflow: Edit / Go public ↔ Unpublish / Delete (two-step, cascade) — preserved
- [x] Hero 280pt with fallback ladder (`pickHeroImageUrl`) — preserved, broken-image feedback improved
- [x] Gluten trust chip (`classifyRecipeGluten`) — preserved
- [x] Persistent gluten disclaimer caption (ENG-748, legal P0) — preserved (never collapsible)
- [x] "Gluten-free" regulated label NOT rendered — preserved (hard legal gate)
- [x] Kcal headline per portion — preserved
- [x] Subtitle row (author byline + meal slot, tappable) — preserved
- [x] `composeSubtitleParts`, `instagramHandleFromPostUrl`, `tiktokHandleFromPostUrl` — preserved
- [x] Time stats (`formatMinutes`, `shouldRenderTimeStats`) — preserved, upgraded to ring visual
- [x] "Ready by {clock time}" — new addition (no feature loss)
- [x] Servings stepper (`recipeViewScale.ts`, 1–99, debounced 200ms) — preserved, boxed visual
- [x] `?portion=N` deep-link seeding — preserved
- [x] `viewMultiplier` scaling of ingredient grams — preserved
- [x] Owner pencil → yield-edit modal — preserved
- [x] Secondary line total kcal when scaled from base — preserved
- [x] Macro tiles (flex-1, 4-up, `trackedMacros` from profile) — preserved, visual upgrade
- [x] `RECIPE_TRACKABLE_MACRO_KEYS` (protein/carbs/fat/fiber/sugar/sodium) — preserved
- [x] Per-tile: colour dot, value, "of {target}", progress bar — preserved
- [x] Net-carbs lens (`carbsLabel`, `netCarbsForRow`, refuses label when fibre unknown) — preserved
- [x] Sugar ref 50g, sodium 2300mg — preserved
- [x] "Fits your day" verdict (`computeFitsYourDayVerdict`) — preserved, elevated in hierarchy + framing toggle added
- [x] Three tones: success/warning/destructive — preserved, mapped to success green / amber / amber (not red — amber for macros)
- [x] "Calories not yet computed" state — preserved, copy improved to "Computing nutrition…"
- [x] Description card (`sanitizeRecipeDescription`) — preserved
- [x] Allergen callout (`normaliseAllergenIds`, `formatContainsLine`, always rendered) — preserved, bold allergen names added
- [x] Allergen callout never paywalled (T12/DI-P0-01) — hard gate preserved
- [x] Tab bar: Ingredients / Steps / Nutrition — preserved, "Ingredients" given visual priority
- [x] Ingredient rows: confidence dot, name, kcal (suppressed at 0), scaled amount, tier label, Verify CTA, SourceDot — preserved
- [x] `deriveIngredientVerificationTier` (4 tiers) — preserved (hard gate — not collapsed to binary)
- [x] Numeric % confidence hidden inline, in a11y hint only (F-120) — preserved
- [x] `mapMealSourceToDot` — preserved
- [x] `ingredientShouldShowVerifyCta` — preserved
- [x] "Edit" → verify screen — preserved
- [x] FatSecret attribution badge (ToS) — preserved, upgraded to trust chip visual
- [x] Tap ingredient row → explainer Alert — replaced with ingredient detail sheet (improvement, no feature loss)
- [x] Steps tab (`normaliseInstructions`) — preserved
- [x] Nutrition tab: 2×2 grid, micronutrients with progress bars — preserved
- [x] Fiber/Sugar/Sodium hidden when value 0 (F4) — preserved
- [x] Log to journal card: portion stepper (0.25 steps, 0.125–24), presets {0.5, 1, 1.5, 2}, live kcal — preserved
- [x] Log button, confirm haptic — preserved
- [x] `wouldCoerceMacros` coercion guard (P0-3) — preserved, visualised as disabled Log + warning chip
- [x] `addRecipeToTodayJournal` — preserved
- [x] Start Cooking → cook mode — preserved, now in verb action row
- [x] `RecipeNotesCard` — preserved
- [x] Source attribution card (3 modes, never synthesises URL) — preserved
- [x] Sticky footer "Log all · {kcal} kcal", hidden in cook mode — preserved
- [x] Auto-verify on load (`/api/nutrition/verify-recipe`, T19 Path B) — preserved (logic unchanged)
- [x] `needsReview` nudge (one Alert per recipe per mount) — preserved
- [x] `writeMealToHealthKitIfEnabled` — preserved (mobile-only, not a parity gap)
- [x] `FREE_SAVE_LIMIT = 10` save gating — preserved

### Cook Mode

- [x] `useKeepAwake()` — preserved
- [x] Steps from JSON query param (fail-safe parse, CM1) — preserved
- [x] `COOK_SCALE_PRESETS` (0.5/1/1.5/2/4), persisted per (userId, recipeId) — preserved, control moved to compact popover
- [x] `scaleAmountText` (units/counts only, never times/temps) — preserved
- [x] Progress bar — preserved
- [x] `parseTimersInStep` — preserved, now drives named multi-timer tray
- [x] Suggested-timer pill (count-down) — preserved as named pill
- [x] Manual stopwatch (count-up) — preserved
- [x] Timer-done → success haptic + "Step done?" Alert (Restart/Next) — preserved
- [x] Prev/Next nav with selection haptics — preserved
- [x] "Last time" card (`listRecentCookHistory`, latest 3) — preserved
- [x] Completion card: cook duration, "you usually cook this in N min", 5-star rating, per-cook note (500-char), Save this cook (`insertCookHistory`), Add to regulars (`createSavedMeal`), Log this meal, Skip — all preserved
- [x] `medianCookDuration` — preserved
- [x] "Watch original" pill (`cook_watch_original_tapped`) — preserved, moved to utility bar
- [x] Voice handsfree shell (`COOK_HANDSFREE_FEATURE_ENABLED` off, honest copy) — preserved
- [x] `writeHandsfreeEnabled` persistence — preserved
- [x] `docs/decisions/2026-05-01-cook-voice-handsfree.md` canonical — preserved
- [x] All analytics events (cook_mode_opened, timer_started/completed, scale_changed, history_saved, saved_meal_created, handsfree_*, log_tapped) — preserved

### Shopping List

- [x] Household sync banner — preserved, copy improved
- [x] Progress card (`checkedGroupCount / totalGroupCount`) — preserved, visual upgrade
- [x] Supermarket aisle sort (`sortShoppingCategories`) — preserved
- [x] Per-section count — preserved
- [x] Items grouped by ingredient name (`groupShoppingItemsByIngredientName`) — preserved
- [x] Dedupe label (`dedupeShoppingLabel`) — preserved
- [x] "from {recipe}" provenance — preserved, upgraded to thumbnail provenance strip
- [x] Per-row check attribution (household initials + accent colour) — preserved
- [x] Swipe-to-delete (Swipeable, medium haptic) + long-press remove — preserved
- [x] Tap = toggle group — preserved
- [x] Clear all / Remove N checked — preserved
- [x] Export (clipboard / Share, aisle grouping + emoji) — preserved, format spec added
- [x] Realtime Supabase channel — preserved
- [x] Stale reconciliation (`shoppingItemsTiedToCurrentPlan`, 28s/18s timeouts) — preserved
- [x] JSON fallback (`shoppingJsonFallback`, solo only) — preserved
- [x] Empty state (cart + Plan link) — preserved
- [x] Scope-aware: solo vs household (`shoppingScopeFor`) — preserved
- [x] No fake price total — preserved (trust posture hard gate)

### Verify screen

- [x] `fetchIngredientsForVerification` — preserved
- [x] Food search (`FoodSearchModal`) — preserved
- [x] Barcode (`BarcodeScannerModal`) — preserved
- [x] Voice (`VoiceLogSheet`) — preserved
- [x] Photo (`PhotoLogSheet`) — preserved
- [x] Add ingredient (`AddIngredientSheet`) — preserved
- [x] Per-ingredient override (`OverrideIngredientSheet`) — preserved
- [x] Caption-nutrition claim reconciliation (`extractCaptionNutrition`, `nutritionDelta`) — preserved, visualised in panel
- [x] `saveVerifiedIngredients`, `scaleMacrosByGrams` — preserved
- [x] Load-error retry path (F-114) — preserved
- [x] Standard units table (g/oz/tbsp/tsp/cup/ml) — preserved
- [x] 4-tier confidence system (hard gate — not binary) — preserved
- [x] FatSecret attribution — preserved
- [x] Coercion guard before save — preserved

### Import / Create

- [x] CreateRecipeActionSheet: link / photo / manual / PDF (flag-gated off) — preserved, 4-tile sheet
- [x] Clipboard auto-detect `Paste {host}…` quick action — preserved, elevated position
- [x] `import-shared`: URL/social import, barcode, override, meal-type picker — preserved
- [x] `IMPORT_ERROR_COPY` — preserved
- [x] `saveImportedRecipe` — preserved
- [x] `cookbook-import`: PDF parse, 4MB cap, `COOKBOOK_IMPORT_FREE_SAVE_CAP`, review pagination — preserved (flag-gated off, ENG-742)
- [x] Cookbook PDF flag-gated OFF — preserved

### Business rules and data

- [x] Per-serving macros: ingredient sum ÷ servings — preserved
- [x] `totalMacros` (ingredient sum / per-serving × servings) — preserved
- [x] `scaledForLog` (macros × logPortion, 1-dec rounding) — preserved
- [x] Coercion guard (`wouldCoerceMacros`, P0-3) — hard gate preserved
- [x] Verification tier (`deriveIngredientVerificationTier`) — preserved
- [x] `needsReview` nudge (`ingredientVerifyNeedsReview`) — preserved
- [x] Fit verdict % (`computeFitsYourDayVerdict`) thresholds (≤50% / 51–99% / ≥100%) — preserved
- [x] `saveRecipeYield` recompute — preserved
- [x] Net carbs (`netCarbsForRow`) — preserved
- [x] Cook duration capture (`Date.now() - sessionStartRef`) — preserved
- [x] Cook median (`medianCookDuration`) — preserved
- [x] Shopping progress (group-based) — preserved
- [x] `FREE_SAVE_LIMIT = 10` (client + DB trigger) — preserved
- [x] Voice logging Pro-only server-enforced — preserved
- [x] "Gluten-free" regulated label NOT used — legal hard gate preserved
- [x] Trust posture: "Estimated", disclaimers, no health claims — preserved throughout

**Total preserved features: 118**  
**Charts / data visualisations:** macro progress bars (6 macros), fits-your-day verdict chip, cook completion cook-time display, shopping progress bar — all 4 preserved and upgraded. No chart removed or simplified.

---

## 11. Related files

- `/Users/graceturner/Suppr-1/apps/mobile/app/(tabs)/library.tsx` — Library (mobile)
- `/Users/graceturner/Suppr-1/apps/mobile/app/recipe/[id].tsx` — Recipe Detail (mobile, 3,429 lines)
- `/Users/graceturner/Suppr-1/apps/mobile/app/cook.tsx` — Cook Mode standalone (mobile, 1,675 lines)
- `/Users/graceturner/Suppr-1/apps/mobile/app/shopping.tsx` — Shopping List (mobile)
- `/Users/graceturner/Suppr-1/apps/mobile/app/recipe/verify.tsx` — Verify screen (mobile)
- `/Users/graceturner/Suppr-1/apps/mobile/app/import-shared.tsx` — URL/social import (mobile)
- `/Users/graceturner/Suppr-1/apps/mobile/components/recipe/CreateRecipeActionSheet.tsx` — Source picker (mobile)
- `/Users/graceturner/Suppr-1/src/app/components/RecipeDetail.tsx` — Recipe Detail (web)
- `/Users/graceturner/Suppr-1/src/app/components/Library.tsx` — Library (web)
- `/Users/graceturner/Suppr-1/src/app/components/CookMode.tsx` — Cook Mode (web)
- `/Users/graceturner/Suppr-1/src/app/components/ShoppingList.tsx` — Shopping List (web)
- `/Users/graceturner/Suppr-1/src/app/components/RecipeUpload.tsx` — Upload/import (web)
- `/Users/graceturner/Suppr-1/docs/decisions/2026-05-01-cook-voice-handsfree.md` — Voice shell decision
- `/Users/graceturner/Suppr-1/docs/ux/brand-tokens.md` — Canonical colour tokens
- `/Users/graceturner/Suppr-1/docs/ux/design-tokens.md` — Canonical design tokens
