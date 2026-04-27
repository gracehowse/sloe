# Lucide sweep — Phase 1 status (2026-04-27)

**Source spec:** `docs/specs/2026-04-27-production-design-spec.md` §1.5.

**Goal:** every `@expo/vector-icons` (`Ionicons` + `MaterialCommunityIcons`) usage in `apps/mobile/**` swapped for `lucide-react-native` glyphs from the canonical mapping table. Web is already on `lucide-react`; this is the mobile-only sweep.

## Phase 1 — converted (2026-04-27)

The spec's named Phase 1 surfaces, plus a few high-traffic files where the conversion was tractable in the same pass:

- `apps/mobile/components/today/TodayMealsSection.tsx` — meal-slot glyphs (Coffee / Sun / UtensilsCrossed / Cookie) + Bookmark / ChevronRight / Copy / Plus / RefreshCw / Trash2
- `apps/mobile/components/today/TodayDateHeader.tsx` — ChevronLeft / ChevronRight / Sun / LayoutGrid (the F-84 toggle)
- `apps/mobile/components/today/TodayQuickLogStrip.tsx` — Search / Mic / Camera / ScanBarcode / Lock
- `apps/mobile/components/FoodSearchModal.tsx` — Check / CheckCircle2 / ChevronRight / Minus / Plus / Search / X
- `apps/mobile/app/recipe/[id].tsx` — Bookmark / ChevronLeft / Clock / Minus / Plus / PlusCircle / Share2 / Timer / UtensilsCrossed / Users / X
- `apps/mobile/app/(tabs)/library.tsx` — Bookmark / ChevronLeft / ArrowUpDown / Search / BookOpen
- `apps/mobile/app/(tabs)/discover.tsx` — already lucide-only, no work needed

After the Phase 1 sweep, **65–70 files in `apps/mobile/**` still import from `@expo/vector-icons`**. They render correctly today; the conversion is mechanical but staged to keep PR review tractable.

## Phase 1 long-tail — explicitly deferred to follow-up tickets

The spec frames the lucide sweep as "stage as a single PR but with one commit per surface (10–12 commits)." For the long-tail below, we ship one Notion task per surface so the conversion can be batched in subsequent PRs without blocking Phase 2 (tab collapse + canonical Today refactor).

The following surfaces still import `@expo/vector-icons` and are scheduled for the follow-up sweep. Run `grep -rln "@expo/vector-icons" apps/mobile/**/*.{ts,tsx}` for the canonical list at any time.

Routes:
- `apps/mobile/app/onboarding.tsx` (11 sites)
- `apps/mobile/app/burn-detail.tsx`
- `apps/mobile/app/cook.tsx`
- `apps/mobile/app/create-recipe.tsx`
- `apps/mobile/app/fasting.tsx`
- `apps/mobile/app/health-sync.tsx`
- `apps/mobile/app/household-settings.tsx`
- `apps/mobile/app/import-shared.tsx`
- `apps/mobile/app/login.tsx`
- `apps/mobile/app/macro-detail.tsx`
- `apps/mobile/app/meal-nutrition.tsx`
- `apps/mobile/app/notifications-prompt.tsx`
- `apps/mobile/app/nutrition-sources.tsx`
- `apps/mobile/app/profile.tsx`
- `apps/mobile/app/recipe/verify.tsx`
- `apps/mobile/app/shopping.tsx`
- `apps/mobile/app/targets.tsx`
- `apps/mobile/app/weight-tracker.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/planner.tsx`
- `apps/mobile/app/(tabs)/barcode.tsx`
- `apps/mobile/app/creator/[id].tsx`

Components:
- `apps/mobile/components/SaveMealSheet.tsx`
- `apps/mobile/components/HouseholdSummaryRow.tsx`
- `apps/mobile/components/PhotoLogSheet.tsx`
- `apps/mobile/components/HouseholdBar.tsx`
- `apps/mobile/components/QuickAddPanel.tsx`
- `apps/mobile/components/MealTypePicker.tsx`
- `apps/mobile/components/RecipeNotesCard.tsx`
- `apps/mobile/components/FirstRunChecklist.tsx`
- `apps/mobile/components/JournalDatePickerModal.tsx`
- `apps/mobile/components/SponsoredDisclosure.tsx`
- `apps/mobile/components/CreateCustomFoodSheet.tsx`
- `apps/mobile/components/OptionCard.tsx`
- `apps/mobile/components/VoiceLogSheet.tsx`
- `apps/mobile/components/AiPaywallSheet.tsx`
- `apps/mobile/components/CopyMealSheet.tsx`
- `apps/mobile/components/BarcodeScannerModal.tsx`
- `apps/mobile/components/HydrationStimulantsCard.tsx`
- `apps/mobile/components/DuplicateDaySheet.tsx`
- `apps/mobile/components/HouseholdCard.tsx`
- `apps/mobile/components/EmptyState.tsx`
- `apps/mobile/components/ActivityLevelPreview.tsx`
- `apps/mobile/components/AddIngredientSheet.tsx`
- `apps/mobile/components/AppleHealthCard.tsx` (already partial lucide; finish remaining MCI)
- `apps/mobile/components/Badge.tsx`
- `apps/mobile/components/BarcodeCameraView.tsx`
- `apps/mobile/components/Digest.tsx`
- `apps/mobile/components/PlanTemplatesSheet.tsx`
- `apps/mobile/components/RecipeHeroFallback.tsx` (already partial lucide)
- `apps/mobile/components/RulerSlider.tsx`
- `apps/mobile/components/today/TodayDeficitInsight.tsx`
- `apps/mobile/components/today/TodayHeroFastingChip.tsx`
- `apps/mobile/components/today/TodayMealsSection*` (any siblings still on @expo)

Charts + helpers:
- `apps/mobile/components/charts/*.tsx`

## Mapping cheat-sheet (canonical, from spec §1.5)

| Old (`@expo/vector-icons`) | New (`lucide-react-native`) |
|---|---|
| `chevron-back` | `ChevronLeft` |
| `chevron-forward` | `ChevronRight` |
| `close` / `close-circle` | `X` |
| `add` | `Plus` |
| `add-circle-outline` | `PlusCircle` |
| `remove` | `Minus` |
| `checkmark` | `Check` |
| `checkmark-circle` | `CheckCircle2` |
| `bookmark` / `bookmark-outline` | `Bookmark` (use `fill` prop for solid) |
| `share-outline` | `Share2` |
| `search` / `search-outline` | `Search` |
| `mic-outline` | `Mic` |
| `camera-outline` | `Camera` |
| `scan-outline` | `ScanBarcode` |
| `lock-closed` | `Lock` |
| `time-outline` | `Clock` |
| `timer-outline` | `Timer` |
| `people-outline` | `Users` |
| `restaurant-outline` | `UtensilsCrossed` |
| `cafe-outline` (Breakfast) | `Coffee` |
| `sunny-outline` (Lunch) | `Sun` |
| `cookie-outline` (Snacks, was MCI) | `Cookie` |
| `swap-vertical` | `ArrowUpDown` |
| `book-outline` | `BookOpen` |
| `refresh-outline` | `RefreshCw` |
| `copy-outline` | `Copy` |
| `trash-outline` | `Trash2` |
| `pencil` | `Pencil` |
| `bell` | `Bell` |
| `cog-outline` / `settings` | `Settings2` |
| `shield-checkmark` | `ShieldCheck` |
| `download-outline` | `Download` |
| `wifi-outline` (offline state) | `WifiOff` |

If a glyph need surfaces that's not in this table, propose an addition to the spec — do not pick a lucide icon unilaterally.

## Tests pinning the sweep

- `apps/mobile/tests/unit/mealSlotIconFamilyParity.test.ts` — pins meal-slot glyphs to lucide on both platforms (was F-12, now spec §1.5).
- `apps/mobile/tests/unit/screenAuditFixesParity.test.ts` — F-84 mobile pin updated to lucide `Sun` / `LayoutGrid`.
- `tests/unit/supprPrimitives.test.tsx` (web) + `apps/mobile/tests/unit/supprPrimitives.test.tsx` — render-shape coverage for the new primitives.
- `tests/unit/designTokensPhase1.test.ts` (web) + `apps/mobile/tests/unit/designTokensPhase1.test.ts` — token-coverage pins.
