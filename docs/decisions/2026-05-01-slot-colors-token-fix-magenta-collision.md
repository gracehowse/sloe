# 2026-05-01 — `SlotColors` token (resolve magenta=fat=snack collision)

**Status:** Resolved
**Area:** Design system / theme tokens
**Owner:** Grace (review) · agent-adbc4e0fdf5df5fe7 (impl)

## Problem

ui-critic P2 #10. On the Today screen, the Snacks meal-slot icon wrapper used `MacroColors.fat` (magenta `#e04888`) for its tint. The Fat macro tile in the Macro row immediately above used the same magenta. Same hue, two unrelated meanings ("Snacks slot" vs "Fat macro") rendered side-by-side. Confusing to scan; collapsed two semantic roles into one colour.

The same pattern was present on the Plan tab (`apps/mobile/app/(tabs)/planner.tsx`'s `SLOT_COLOR_MOBILE`) and on the web `today-meals-section.tsx` via `IconBox tone="fat"` for Snacks.

## Decision

Add a dedicated `SlotColors` token namespace, parallel to `MacroColors`. Slot tints come from `SlotColors`; macro tints come from `MacroColors`. They never share a hex.

Roles:
- **Breakfast** → amber (`#e8a020` / `Accent.warning` / `--slot-breakfast`)
- **Lunch** → green (`#22a860` / `Accent.success` / `--slot-lunch`)
- **Dinner** → blue (`#4c6ce0` / `Accent.primary` / `--slot-dinner`)
- **Snack** → cyan (`#06b6d4` / `--slot-snack`)

Snack cyan shares its hex with `Accent.cyan` / `--macro-water`, but Water is rendered on the Hydration card which is structurally separated from Today's meal section by an entire surface — there is no in-surface 1:1 collision the way the Snacks-vs-Fat one was.

Macro tokens (`MacroColors.*` / `--macro-*`) remain reserved for the Macro tile row only.

## Implementation

| File | Change |
|------|--------|
| `apps/mobile/constants/theme.ts` | New `SlotColors` export with 4 roles. |
| `apps/mobile/components/today/TodayMealsSection.tsx` | Drops `MacroColors` import; `SLOT_COLOR` reads from `SlotColors`. |
| `apps/mobile/app/(tabs)/planner.tsx` | `SLOT_COLOR_MOBILE` reads from `SlotColors`. |
| `src/styles/theme.css` | New `--slot-{breakfast,lunch,dinner,snack}` tokens (light + dark) plus `-soft` variants and `--color-slot-*` mappings in `@theme inline`. |
| `src/app/components/ui/icon-box.tsx` | `IconBox` adds 4 `slot-*` tones (`bg-slot-X-soft text-slot-X`). |
| `src/app/components/suppr/today-meals-section.tsx` | Snacks now uses `tone: "slot-snack"`; Breakfast/Lunch/Dinner promoted to `slot-*` tones too. |
| `docs/ux/brand-tokens.md` | New "Meal-slot colours" section + rule 3 updated. |

## Tests

- `apps/mobile/tests/unit/slotColorTokensParity.test.ts` — 12 tests. Pins `SlotColors` exports, mobile slot files don't reference `MacroColors.fat`, web `--slot-*` tokens exist (light + dark), `IconBox` exposes `slot-*` tones, web Snacks slot uses `tone: "slot-snack"`.
- `apps/mobile/tests/unit/todayMealsSectionSlotColors.test.tsx` — 3 render tests. Renders `TodayMealsSection` with all 4 slots, asserts no icon-wrapper background contains the magenta hex `#e04888` and that all 4 canonical slot tints are present.

## Parity

Web ↔ mobile fully aligned. The 4-slot palette renders the same hue family on both platforms in light and dark mode. Source of truth lives in `apps/mobile/constants/theme.ts` (`SlotColors`) and `src/styles/theme.css` (`--slot-*`); `docs/ux/brand-tokens.md` cross-links both.

## Risks / follow-ups

None. The change is additive on the token side (new exports, new CSS vars, new IconBox tones) and a 1:1 swap on the four call sites that consumed `MacroColors.fat` for slot tinting. `MacroColors.fat` itself is unchanged and remains the sole token for the Fat macro tile.
