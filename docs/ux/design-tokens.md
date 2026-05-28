# Design tokens — canonical UI patterns

**Last reviewed:** 2026-04-27 (Phase 1 production design spec, source-of-truth at `docs/specs/2026-04-27-production-design-spec.md`).

This document codifies the canonical typography, casing, button, pill, section-header, source/provenance, depth, motion and icon patterns used in Suppr. It exists so future PRs have a reference for which pattern to use when adding new screens or surfaces.

If you're adding a new component, find the closest existing pattern below and match it. If a new pattern is genuinely needed, add it here in the same PR.

---

## Phase 1 token additions (2026-04-27)

Phase 1 of the production design spec adds the following tokens. They ship without changing visible structure — they're consumed by the new primitives (SupprCard / TrustChip / SourceDot / ConfidenceChip / EmptyState / SkeletonRow + SkeletonCard) and by Phase 2 surface refactors.

### Web — `src/styles/theme.css`

Light + dark blocks both carry these:

| Token | Role |
|---|---|
| `--source-usda` | USDA-verified dot (success-green) |
| `--source-off` | Open Food Facts dot (primary-blue) |
| `--source-fatsecret` | FatSecret dot (orange) |
| `--source-manual` | Manual entry dot (text-tertiary grey) |
| `--source-ai` | AI-estimated dot (magenta) — pairs with lucide `Sparkles` 8px to its left |
| `--confidence-neutral` | ConfidenceChip background base — calm grey, NOT a warning |
| `--north-star-bg-from` / `--north-star-bg-to` / `--north-star-border` | North-star block on Today |
| `--over-budget-fg` | Amber, never red, per memory |
| `--over-budget-soft` | Tinted bg for over-budget tiles |
| `--elev-card` | List rows on a card — `0 1px 2px rgba(0,0,0,0.04)` |
| `--elev-sheet` | Bottom-sheets — `0 -8px 32px rgba(0,0,0,0.12)` |
| `--elev-float` | Popovers / dropdowns — `0 4px 16px rgba(0,0,0,0.12)` |
| `--elev-float-primary` | FAB tint — `0 4px 16px rgba(76,108,224,0.4)` |
| `--ease-spring-soft` | Sheet present + confirm-success — `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| `--ease-decel` | Dismiss + fade-out — `cubic-bezier(0.05, 0.7, 0.1, 1)` |

`body { font-feature-settings: "tnum" 1, "ss01" 1, ... }` ships globally so every numeric inherits Inter's tabular-nums + stylistic set 01.

A global `@media (prefers-reduced-motion: reduce)` rule collapses `animation-duration` + `transition-duration` to ~0ms across the app. Components that drive their own animations (framer-motion) should additionally branch on `useReducedMotion()`.

### Mobile — `apps/mobile/constants/theme.ts`

```ts
import { Type, Elevation, IconSize, Spring, Colors } from "@/constants/theme";

// Type ladder — apply directly to <Text> (pair with fontVariant tabular-nums on numerics)
<Text style={[Type.title, { color: colors.text }]}>Today</Text>
<Text style={[Type.body, { fontVariant: ["tabular-nums"] }]}>553 left</Text>

// Elevation — spread into a View style
<View style={[{ backgroundColor: colors.card }, Elevation.card]} />

// IconSize — pair with lucide-react-native
<Bookmark size={IconSize.base} color={Accent.primary} />

// Spring — Reanimated config
withSpring(toValue, Spring.softSheet)

// Colours — sourceUsda, sourceOff, sourceFatsecret, sourceManual, sourceAi,
// confidenceNeutral, northStarBgFrom, northStarBgTo, northStarBorder,
// overBudgetFg, overBudgetSoft, destructiveForeground, primaryForeground
const colors = useThemeColors();
<View style={{ backgroundColor: colors.northStarBgFrom }} />
```

### Phase 1 primitives (callers NOT swept yet — that's Phase 2)

| Primitive | Web path | Mobile path |
|---|---|---|
| `SupprCard` | `src/app/components/ui/suppr-card.tsx` | `apps/mobile/components/ui/SupprCard.tsx` |
| `TrustChip` | `src/app/components/ui/trust-chip.tsx` | `apps/mobile/components/ui/TrustChip.tsx` |
| `SourceDot` | `src/app/components/ui/source-dot.tsx` | `apps/mobile/components/ui/SourceDot.tsx` |
| `ConfidenceChip` | `src/app/components/ui/confidence-chip.tsx` | `apps/mobile/components/ui/ConfidenceChip.tsx` |
| `EmptyState` (universal) | `src/app/components/ui/empty-state.tsx` | `apps/mobile/components/ui/EmptyState.tsx` |
| `SkeletonRow` / `SkeletonCard` | `src/app/components/ui/skeleton-row.tsx` | `apps/mobile/components/ui/SkeletonRow.tsx` |

Universal `EmptyState` uses `icon` / `title` / `body` / `primaryCta` / `secondaryCta`. It coexists with the older `EmptyState` at `src/app/components/suppr/empty-state.tsx` (and `apps/mobile/components/EmptyState.tsx`) which use `description` + `action`. Phase 2 sweeps callers; Phase 1 ships the primitive.

### Iconography (lucide-only)

The mobile sweep replaces every `@expo/vector-icons` (`Ionicons` + `MaterialCommunityIcons`) usage with `lucide-react-native` per the spec §1.5 mapping table. **Phase 1 status (2026-04-27):** the named Today surfaces and a handful of frequently-touched files have been converted; a long-tail of ~70 files remains for Phase 1 follow-up. See `docs/ux/lucide-sweep-status.md` for the audit.

Per-icon canonical mapping lives in `docs/specs/2026-04-27-production-design-spec.md` §1.5. Do not introduce new icon glyphs not in the mapping; if a need surfaces, propose to the spec rather than picking unilaterally.

### Reduce-motion

- **Web:** the global `@media (prefers-reduced-motion: reduce)` rule in `theme.css` honours system preference. Components that animate via framer-motion / View Transitions should additionally branch on `useReducedMotion()`.
- **Mobile:** `useReduceMotion()` at `apps/mobile/hooks/use-reduce-motion.ts` is the canonical hook. Components driving Reanimated worklets / `Animated.timing` should branch on this and skip the spring/translate paths in favour of an opacity-only fallback.

---

## Casing

Two casings are in use, with non-overlapping semantics:

### UPPERCASE micro eyebrows

Used for **inline metric labels** and **form-row eyebrows**. Tracking ≥0.4, font weight 600-700, fontSize 10-12, color = textTertiary or textSecondary.

Examples:
- Macro tile titles: `PROTEIN`, `CARBS`, `FAT`, `FIBER`
- Form-row eyebrows: `RECIPE NAME`, `DESCRIPTION (OPTIONAL)`, `INGREDIENTS`, `INSTRUCTIONS (OPTIONAL)`
- Inline metric labels: `MICRONUTRIENTS`, `WEEKLY PLAN`, `MEMBERS`, `WHICH MEALS ARE SHARED?`
- Above-the-fold surface eyebrows: `BROWSE`, `APR 20 · MONDAY`, `LAST 30 DAYS`, `WEEK OF APRIL 26`, `WEEK DIGEST`

### Sentence Case bold

Used for **section group headers** that span multiple rows. Font weight 700-800, fontSize 14-22, color = text (foreground).

Examples (canonical surface = `apps/mobile/app/(tabs)/more.tsx`):
- `Account` (top), `Everything else`, `Goals & targets`, `Connections`, `Recipes`, `App`, `Legal`, `Build`, `Danger zone`
- Sub-section headers: `Macros` (on Targets), `Calories` (on Progress), `Daily Calories` (on Progress)
- Recipe Detail card titles: `Ingredients`, `Steps`, `Nutrition`, `Log to journal`, `Your notes`

### Title Case

Used for **screen titles** in nav bars and **labels** that aren't section headers. Font weight 700-800, fontSize 22-28.

Examples:
- Top-level tab titles: `Today`, `Discover`, `Library`, `Plan`, `Progress`, `More`
- Pushed-screen titles: `Health Sync`, `Weight & Trends`, `Targets`, `New recipe`, `Burn Detail`, `Shopping list`
- Recipe titles: `Mediterranean Chickpea Salad` (passed through `normalizeRecipeTitle`)

### Lowercase

Used **never** for UI labels. The 2026-04-26 audit found `lunch` and `snacks` lowercase pills as bugs — fix to Title Case.

### Apostrophes and contractions

Render `Don't` not `Dont`. The `recipeSearchMatch` helper strips apostrophes for *search comparison* but UI labels keep them.

---

## Buttons

### Primary action (submit / save / generate)

Full-width, `Accent.primary` (#588CE4) background, white text, `Radius.md` corners, `paddingVertical: 16`, `fontSize: 16`, `fontWeight: 700`.

**Onboarding exception:** the onboarding flow uses `Accent.success` (green) for "next / continue" actions. This is intentional — green carries a "progress / growth / let's go" emotional valence appropriate to the welcome flow, while the rest of the app's "submit / save / generate" actions are about reliability and pick `Accent.primary`. Don't migrate onboarding to primary without a deliberate emotional-design review.

Canonical examples:
- `Save Recipe` (Create Recipe form bottom)
- `Generate plan` (Planner)
- `Open Planner` (Shopping list empty state)
- `Save changes` (Household)
- `Done` (sheets / modals)
- `Sync Now` (Health Sync)

### Secondary action

Card-style with `colors.cardBorder` border, `colors.text` text, same dimensions as primary.

### Destructive escalation hierarchy

Three levels in increasing severity, each with progressively less visual weight:

1. **Soft destructive** (e.g. "Reset Plan keep my data"): `Accent.primary` solid button — same as a normal primary action because the data is preserved.
2. **Hard destructive** (e.g. "Erase all app data"): `t.red + "40"` outline, red text, requires confirm dialog.
3. **Account destructive** (e.g. "Delete my account permanently"): `t.red + "20"` (subtler) outline, red text, opacity 0.85, requires confirm dialog.

Cancel is text-only (no border, no background) so it never reads as destructive.

### Icon-button style

`paddingVertical: 8`, `paddingHorizontal: 4`, `hitSlop: 8`, plain Lucide icon at 22-24px. Round (`Radius.full`) backgrounds appear only on the FAB and the day-picker calendar button.

---

## Pills

### Macro pills (Recipe Detail / Today)

`paddingVertical: 5`, `paddingHorizontal: 10`, `Radius.sm`, coloured dot (8x8) on the left, label, then value. Colour from `MacroColors.{protein,carbs,fat,fiber,sugar,sodium}`.

### Filter pills (Discover / Library)

`paddingVertical: 6`, `paddingHorizontal: 13`, `Radius.full`, 1px border, fontSize 11. Active state: border + background tint of `Accent.primary`.

### Status pills (On track, Adaptive, Pro)

`paddingVertical: 4`, `paddingHorizontal: 10`, `Radius.full`, fontSize 11, fontWeight 700. Background tinted at 12-18% of the indicator colour.

### Confidence pills (ingredient match)

Coloured dot 6x6 left of the row, no separate pill. Colour ramp:
- Green (`Accent.success`) ≥80%
- Amber (`Accent.warning`) 50-79%
- Red (`Accent.destructive`) <50%

### Meal-type pills (Recipe Detail)

`Title Case` (e.g. `Lunch`, not `lunch`), `Accent.primary` text, light tinted background (`Accent.primary + "12"`). Render once below the recipe title — never as a duplicate above the title (closed in 2026-04-26 round 1).

### Fit-percent pills (Recipe Detail)

`{N}% match` — always include the "match" suffix so the bare number isn't ambiguous (closed in 2026-04-26 round 1).

---

## Layout spacing

`apps/mobile/constants/theme.ts` exports:

```ts
Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
Radius = { sm: 6, md: 12, lg: 16, full: 9999 };
```

Use these tokens — never raw pixel values for margin/padding/border-radius. Inline `marginBottom: 12` is OK for one-off micro adjustments but should justify itself in a comment.

---

## Colour tokens

Foreground / background / cards / borders all sourced from `useThemeColors()` (light + dark mode). Never hardcode `#000` / `#fff`.

Brand accents from `Accent` (also exported as named macro colours in `MacroColors`):

| Token | Hex | Use |
|---|---|---|
| `Accent.primary` | `#588CE4` | Primary actions, brand highlights, protein |
| `Accent.success` | `#22a860` | Calories, fibre, "On track", confirmation |
| `Accent.warning` | `#e8a020` | Carbs, escalation, "Activity Bonus earned" |
| `Accent.destructive` | `#e04848` | Hard destructive actions, sodium accents |
| `Accent.magenta` | `#DF5EBC` | Fat |
| `Accent.cyan` | `#06b6d4` | Water, freeze indicators |
| `Accent.orange` | `#f97316` | Sodium |

Dark mode background: `#0a0a0f` (intentional OLED-friendly elevation; not pure `#000000`). Cards: `#16161e`. The 2026-04-26 audit confirmed this is correct — pure `#000` would lose card-vs-bg separation.

---

## Section header pattern (the C14 fix)

When adding a new screen with grouped settings rows:

✅ Use Sentence Case bold headers (matches `more.tsx`):

```tsx
<Text style={{ fontSize: 14, fontWeight: "700", color: colors.textSecondary, marginBottom: Spacing.sm }}>
  Goals & targets
</Text>
```

❌ Do not use UPPERCASE eyebrow headers for section groups:

```tsx
<Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase" }}>
  GOALS & TARGETS  // ← wrong for a section group
</Text>
```

UPPERCASE eyebrows are reserved for inline metric labels and form-row eyebrows (see "UPPERCASE micro eyebrows" above).

The legacy `settings.tsx` surface uses UPPERCASE eyebrows for section groups — that's the bug. The canonical surface is `more.tsx`. Migrate UPPERCASE → Sentence Case when touching the file for any other reason.

---

## Audit checklist for new PRs

Before merging a PR that adds a new screen / surface / form:

- [ ] Section group headers in Sentence Case bold (not UPPERCASE)
- [ ] Form-row eyebrows in UPPERCASE micro (not Sentence Case)
- [ ] Primary submit is `Accent.primary` (not `Accent.success`)
- [ ] One submit affordance per form (not "Cancel + CREATE + Save Recipe")
- [ ] Recipe titles routed through `normalizeRecipeTitle` at the read boundary
- [ ] Macro values routed through `formatMacro` / `formatMacroValue`
- [ ] Search inputs routed through `recipeSearchMatch` (token-AND match)
- [ ] Spacing / Radius tokens (no raw pixel values without justification)
- [ ] Colour from `useThemeColors()` + `Accent` / `MacroColors` (no hardcoded hex)
- [ ] Casing: `Snacks` not `snacks`, `Lunch` not `lunch` (Title Case for meal-type labels)
