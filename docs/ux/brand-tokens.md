# Brand colour tokens (web + mobile)

Single reference for **accent roles** so colours do not drift between the Next.js web app and Expo mobile app.

**Wellness palette rationale (2026-05):** `docs/ux/color-direction-noom-lifesum-2026-05.md`

> **Note:** The palette shifted from violet (#7c3aed) to blue (#4c6ce0) during the 2026 design overhaul. Any remaining violet references in web components are legacy and should be migrated to the current blue primary.

## Accent palette

| Role | Hex (canonical) | Mobile token | Web CSS variable | Usage |
|------|-----------------|-------------|-----------------|--------|
| **Primary (UI chrome)** | `#1c1916` (light) / `#e8e7ed` (dark) | `Accent.primary` / `Colors.*.tint` | `--primary` | Buttons, selected states, links, tab bar — **not** brand blue |
| **Brand blue** | `#4c6ce0` | `Accent.brandBlue` | `--macro-protein` | Protein macro, OFF provenance, avatar gradient start only |
| **Brand blue light** | `#7a90f5` | `Accent.brandBlueLight` | `--macro-protein` (dark) | Dark protein macro, sugar macro |
| **Primary light (stone)** | `#5e574e` | `Accent.primaryLight` | `--slot-dinner` | Dinner slot tint, secondary UI emphasis |
| **Success** | `#62b35a` | `Accent.success` | `--success` | Confirmations, calorie ring under-target, positive states |
| **Success light** | `#82d878` | `Accent.successLight` | `--success` (dark) | Dark mode success tint |
| **Warning** | `#e0a838` | `Accent.warning` | `--warning` | Over-budget, breakfast slot, activity bonus — **not** carbs macro |
| **Warning light** | `#f0c058` | `Accent.warningLight` | `--warning` (dark) | Dark mode warning tint |
| **Carbs** | `#d4a02f` | `Accent.carbs` | `--macro-carbs` | Carbs macro track (muted yellow-orange) |
| **Fiber** | `#4a7878` | `Accent.fiber` | `--macro-fiber` | Fibre macro — dusty blue-teal, not success sage |
| **Carbs light** | `#f0956e` | `Accent.carbsLight` | `--macro-carbs` (dark) | Dark mode carbs tint |
| **Destructive** | `#e04848` | `Accent.destructive` | `--destructive` | Errors, dangerous actions only — never for over-budget |
| **Destructive light** | `#ff6c6c` | `Accent.destructiveLight` | `--destructive` (dark) | Dark mode destructive tint |
| **Magenta** | `#e04888` | `Accent.magenta` | `--macro-fat` | Fat macro, gradient accent — not for standalone body UI, **never for the Snacks slot** |
| **Cyan** | `#06b6d4` | `Accent.cyan` / `SlotColors.snack` | `--macro-water` / `--slot-snack` | Water tracking, exercise/activity, **Snacks meal-slot tint** |
| **Orange** | `#f97316` | `Accent.orange` | n/a | Sodium macro |
| **Info** | `#0ea5e9` | `Accent.info` | n/a | Informational accents |

## Macro colours

Fixed across all screens. Never hardcode — always reference `MacroColors` (mobile) or `--macro-*` (web).

| Macro | Colour | Hex | Web CSS variable |
|-------|--------|-----|------------------|
| Calories | Success (green) | `#62b35a` | `--macro-calories` |
| Protein | Primary (blue) | `#4c6ce0` | `--macro-protein` |
| Carbs | Yellow-orange | `#d4a02f` | `--macro-carbs` |
| Fat | Magenta (pink) | `#e04888` | `--macro-fat` |
| Fiber | Blue-teal | `#4a7878` | `--macro-fiber` (distinct from calories sage) |
| Sugar | Primary light (periwinkle) | `#7a90f5` | `--macro-sugar` |
| Sodium | Orange | `#f97316` | `--macro-sodium` |
| Water | Cyan | `#06b6d4` | `--macro-water` |

## Meal-slot colours

Per-slot tint applied to the slot-header icon wrapper on Today's meal section and the slot-header column on Plan. **Never use macro tokens here** — slot tints are a separate role from macro tints, and reusing one for the other creates a 1:1 colour collision (the Snacks-slot vs Fat-macro bug fixed 2026-05-01, ui-critic P2 #10).

| Slot | Light | Dark | Mobile token | Web CSS variable |
|------|-------|------|--------------|------------------|
| Breakfast | `#e0a838` (amber) | `#f0c058` | `SlotColors.breakfast` | `--slot-breakfast` |
| Lunch | `#62b35a` (green) | `#82d878` | `SlotColors.lunch` | `--slot-lunch` |
| Dinner | `#5e574e` (warm stone) | `#9490a0` | `SlotColors.dinner` | `--slot-dinner` |
| Snack(s) | `#06b6d4` (cyan) | `#22d3ee` | `SlotColors.snack` | `--slot-snack` |

Each slot also exposes a `--slot-<name>-soft` variant (12% alpha, matches the `--macro-*-soft` pattern) for tinted backgrounds (chip pills, icon wrappers).

_Added 2026-05-01 (ui-critic P2 #10) — replaces the prior pattern where `Snacks` borrowed `MacroColors.fat` (magenta `#e04888`) and collided 1:1 with the Fat macro tile on the same Today screen. Source-grep + render parity tests live at `apps/mobile/tests/unit/slotColorTokensParity.test.ts` and `apps/mobile/tests/unit/todayMealsSectionSlotColors.test.tsx`._

## Stimulant tracker colours

Used exclusively by the Hydration & Stimulants card (Batch 2.5). Not macro roles — caffeine has its own violet tone; alcohol uses an amber that rhymes with the warning accent because "approaching weekly limit" is the same semantic category.

| Stimulant | Colour | Hex | Mobile token | Web CSS variable |
|-----------|--------|-----|--------------|-----------------|
| Caffeine | Violet | `#8b5cf6` | `StimulantColors.caffeine` | `--stimulant-caffeine` |
| Alcohol | Amber | `#f59e0b` | `StimulantColors.alcohol` | `--stimulant-alcohol` |

_Added 2026-04-18 (audit M9) — replaces the hardcoded hex values previously duplicated across `src/app/components/suppr/hydration-stimulants-card.tsx` and `apps/mobile/components/HydrationStimulantsCard.tsx`._

## Surface colours

| Role | Light | Dark | Mobile token |
|------|-------|------|-------------|
| Background | `#f6f3ee` (warm cream) | `#0a0a0f` | `Colors.*.background` |
| Background secondary | `#f0ebe3` | `#111118` | `Colors.*.backgroundSecondary` |
| Card | `#ffffff` | `#16161e` | `Colors.*.card` |
| Card border | `#ddd5c8` | `#32313c` | `Colors.*.cardBorder` |
| Border | `#ddd5c8` | `#32313c` | `Colors.*.border` |
| Input background | `#ebe5dc` | `#222028` | `Colors.*.inputBg` |
| Overlay | `#00000088` | `#000000aa` | `Colors.*.overlay` |

## Text colours

| Role | Light | Dark |
|------|-------|------|
| Primary text | `#1c1916` | `#e8e7ed` |
| Secondary text | `#5e574e` | `#a8a4b4` |
| Tertiary text | `#8c8378` | `#706c7c` |

## Where it lives in code

- **Mobile:** `apps/mobile/constants/theme.ts` — `Accent`, `MacroColors`, `Brand`, `Colors.light` / `Colors.dark`, `Spacing`, `Radius`.
- **Web:** `src/styles/theme.css` — CSS custom properties. When adding a new surface, use existing tokens. Do not introduce new hex values without updating this doc.

## Spacing tokens

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 20px |
| `xl` | 24px |
| `xxl` | 32px |
| `xxxl` | 40px |

## Radius tokens

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Chips, badges, small buttons |
| `md` | 12px | Inputs, standard buttons |
| `lg` | 16px | Cards (canonical card radius) |
| `xl` | 20px | Large cards, modals |
| `full` | 9999px | Pills, circular badges |

## Rules

1. **No hardcoded hex values in components.** All colours must come from theme tokens or `useThemeColors()`.
2. **One primary per screen region.** Do not mix `primary` and `primaryLight` as competing accents.
3. **Magenta is not a standalone accent** — only for fat macro and gradient endpoints. Specifically: **never use `MacroColors.fat` / `--macro-fat` as a meal-slot tint** (the Snacks slot uses `SlotColors.snack` / `--slot-snack`). Macro tokens are reserved for the Macro tile row.
4. **Over-budget = warning (amber), never destructive (red).** Red implies failure.
5. **Macro colours are immutable.** They must not change per-screen or per-context.
6. **Surface tints use `color + "08"` consistently.** Do not mix "08", "12", "18", "20" for the same role.

## Visual QA checklist

When changing accents, spot-check: Discover header, tab bar (light + dark), tracker macro chips, paywall header, calorie ring, burn detail, and one settings row. Verify both light and dark mode.
