"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SupprMark } from "../ui/suppr-mark";
import { SupprCard } from "../ui/suppr-card.tsx";
import { SourceDot } from "../ui/source-dot";
import { mapMealSourceToDot } from "../../../lib/nutrition/sourceMap";
import { formatMacroTrailer } from "../../../lib/nutrition/macroFormat";
import { distributeMealBudget } from "../../../lib/nutrition/mealBudget";
import { DestructiveConfirmDialog } from "./destructive-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import type { SavedMeal } from "../../../lib/nutrition/savedMeals";
import { summariseSavedMeal } from "../../../lib/nutrition/savedMealsLogic";
import { buildMealShareText } from "../../../lib/share/buildMealShareText";
import { track, isFeatureEnabled } from "../../../lib/analytics/track";
import { sheetTransition } from "../../../lib/motion";
import { mealRowImageUrl } from "../../../lib/nutrition/foodHistory";
import { toast } from "sonner";
import { TodayScrollSectionHeader } from "./today-scroll-section-header";
import { TodayMealsFigmaLayout } from "./today-meals-figma-layout";

/**
 * TodayMealsSection — per-slot meal list, save-as-usual full-width row,
 * Log-usual pill on slot headers, and the first-run "Make this your
 * usual {slot}" hint.
 *
 * Ship M1 (2026-04-18) — saved meals is the canonical re-log mechanism.
 *  - Right-side slot-header action: `[↻ Log usual: <savedMealName>]` pill
 *    when ≥1 saved meal matches the slot. 2+ matches open a picker.
 *  - Full-width row below the last item: `+ Save {SlotName} as a meal`
 *    when the slot has ≥2 items AND no saved meal yet for this slot.
 *  - First-run hint renders above the full-width save row when the
 *    shared `shouldShowUsualMealHint` gate passes for this slot.
 *
 * The old 10px "Save combo" metadata pill has been deleted. All
 * user-facing "combo" strings are replaced with "usual meal".
 */

export type TodayMealSectionMeal = {
  id: string;
  name: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier?: number;
  source?: string | null;
};

export interface TodayMealsSectionProps {
  mealsGrouped: Array<{ name: string; meals: TodayMealSectionMeal[] }>;
  mealsForSelectedDate: TodayMealSectionMeal[];
  effectiveCalorieTarget: number;
  fiberTarget: number;
  collapsedSlots: Set<string>;
  onToggleSlot: (name: string) => void;
  onOpenAddForSlot: (slot: string) => void;
  /** Open the save-as-usual dialog pre-seeded with the items in `slot`. */
  onOpenSaveUsualMeal: (slot: string) => void;
  onOpenDuplicateDay: () => void;
  onRequestCopyMeal: (mealId: string) => void;
  onDeleteMeal: (mealId: string, recipeTitle: string) => void;
  /**
   * P5 parity gap #15 — open the per-meal nutrition-detail dialog
   * (`<MealNutritionDialog>`). When set (flag `web_meal_nutrition_detail` on),
   * a "View nutrition" item renders in each meal row's kebab menu. Undefined
   * (flag off) → no item, the kebab + row layout is byte-identical to before.
   * Mirror: the mobile meal row routes to `apps/mobile/app/meal-nutrition.tsx`.
   */
  onOpenMealNutrition?: (mealId: string) => void;
  /**
   * Empty-state primary CTA — opens the unified `<LogSheet>`.
   *
   * 2026-05-02 parity sweep: the prior empty state collage (3 buttons —
   * Add custom meal / Photo log / Voice log — plus a duplicate
   * "Log from today's plan" rows block) diverged from mobile, which
   * has no in-meals-card empty-state collage at all (mobile uses the
   * raised "+" tab-bar button + per-slot "Tap to add" affordances +
   * the standalone `<TodayPlannedMealsCard>` rendered above). Web
   * now matches: a single primary CTA that opens the canonical
   * LogSheet — same entry the bottom-bar raised "+" uses on
   * mobile-web. The LogSheet's right-edge icons cover the
   * scan / voice / photo modes.
   *
   * Mirror: `apps/mobile/components/today/TodayMealsSection.tsx` (no
   * collage rendered; raised "+" + per-slot rows do the same job).
   */
  onOpenLogSheet: () => void;
  /** Ship M1 — all saved meals the authed user owns, sorted newest-logged-first. */
  savedMeals: SavedMeal[];
  /** Ship M1 — log a saved meal into a specific slot. */
  onLogSavedMeal: (meal: SavedMeal, slot: string) => void;
  /**
   * ENG-786 — when set (flag `today_log_again` on), a "Log this/these
   * again" row renders under each populated slot. Tapping it re-inserts
   * that slot's current entries as fresh entries on the viewed day, with
   * the same baked macros. Undefined (flag off) → no row, layout
   * byte-identical to pre-ENG-786. Mirror:
   * `apps/mobile/components/today/TodayMealsSection.tsx`.
   */
  onLogAgain?: (slot: string) => void;
  /** Ship M1 — whether the first-run hint is allowed to render in `slot`.
   * Computed in the host via `shouldShowUsualMealHint`. */
  hintVisibleForSlot: (slot: string) => boolean;
  /** Ship M1 — user tapped "Not now" on the hint for `slot`. */
  onDismissUsualMealHint: (slot: string) => void;
  /** Ship M1 — user tapped "Save as usual" on the hint for `slot`. */
  onAcceptUsualMealHint: (slot: string) => void;
  /** ENG-594 — Quick add accordion in the meals section header. */
  quickAddCollapsed?: boolean;
  onToggleQuickAddCollapsed?: () => void;
  quickAddPanel?: React.ReactNode;
}

/**
 * Per-slot icon + tint. Tones map to `IconBox` slot variants which
 * resolve to the `--slot-*` CSS custom properties.
 *
 * 2026-05-01 (ui-critic P2 #10): Snacks previously used `tone: "fat"`
 * which routed to `--macro-fat` (magenta). On the Today screen this
 * collided 1:1 with the Fat macro tile — same hue, two unrelated
 * meanings. Snacks now uses `tone: "slot-snack"` (cyan); macro tones
 * stay reserved for the Macro tile row.
 */
function getMealIcon(name: string): {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  tone: "slot-breakfast" | "slot-lunch" | "slot-dinner" | "slot-snack" | "primary";
} {
  if (name === "Breakfast") return { icon: Icons.breakfast as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "slot-breakfast" };
  if (name === "Lunch") return { icon: Icons.lunch as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "slot-lunch" };
  if (name === "Dinner") return { icon: Icons.dinner as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "slot-dinner" };
  if (name === "Snacks") return { icon: Icons.snack as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "slot-snack" };
  return { icon: Icons.add as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "primary" };
}

/** Slot-tinted pill chrome — avoids ink (`text-primary`) on every row. */
function slotPillClassName(sectionName: string): string {
  const { tone } = getMealIcon(sectionName);
  switch (tone) {
    case "slot-breakfast":
      return "border-slot-breakfast/30 bg-slot-breakfast-soft text-slot-breakfast hover:opacity-90";
    case "slot-lunch":
      return "border-slot-lunch/30 bg-slot-lunch-soft text-slot-lunch hover:opacity-90";
    case "slot-dinner":
      return "border-slot-dinner/30 bg-slot-dinner-soft text-slot-dinner hover:opacity-90";
    case "slot-snack":
      return "border-slot-snack/30 bg-slot-snack-soft text-slot-snack hover:opacity-90";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function slotHintClassName(sectionName: string): string {
  const { tone } = getMealIcon(sectionName);
  switch (tone) {
    case "slot-breakfast":
      return "border-slot-breakfast/25 bg-slot-breakfast-soft";
    case "slot-lunch":
      return "border-slot-lunch/25 bg-slot-lunch-soft";
    case "slot-dinner":
      return "border-slot-dinner/25 bg-slot-dinner-soft";
    case "slot-snack":
      return "border-slot-snack/25 bg-slot-snack-soft";
    default:
      return "border-border/40 bg-muted/50";
  }
}

function slotHintCtaClassName(sectionName: string): string {
  const { tone } = getMealIcon(sectionName);
  switch (tone) {
    case "slot-breakfast":
      return "bg-slot-breakfast text-white hover:opacity-90";
    case "slot-lunch":
      return "bg-slot-lunch text-white hover:opacity-90";
    case "slot-dinner":
      return "bg-slot-dinner text-white hover:opacity-90";
    case "slot-snack":
      return "bg-slot-snack text-white hover:opacity-90";
    default:
      return "bg-foreground text-primary-foreground hover:bg-foreground/90";
  }
}

/** TD4 — slot total kcal + coloured macro grams (mobile `SlotMacroChips` parity). */
function SlotMacroChips({
  kcal,
  protein,
  carbs,
  fat,
  fiber,
}: {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}) {
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[11px] tabular-nums">
      <span className="text-muted-foreground">{kcal} kcal</span>
      <span className="text-[var(--macro-protein)]">{Math.round(protein)}g</span>
      <span className="text-[var(--macro-carbs)]">{Math.round(carbs)}g</span>
      <span className="text-[var(--macro-fat)]">{Math.round(fat)}g</span>
      {Number.isFinite(fiber) && fiber > 0 ? (
        <span className="text-[var(--macro-fiber)]">{Math.round(fiber * 10) / 10}g</span>
      ) : null}
    </div>
  );
}

/**
 * Saved meals matching a slot. A meal matches when either:
 *   - `defaultMealSlot === slot` (user explicitly tagged it); OR
 *   - the meal has no default slot but its `lastLoggedAt` history shows
 *     it was last logged into this slot (implicit match, handled by the
 *     caller via pre-sorted listing — here we fall back to "no default
 *     slot" meals appearing under every slot is noisy, so we restrict
 *     to explicit matches only).
 *
 * Keeping this pure + local so tests can reach it if needed later.
 */
export function savedMealsForSlot(meals: readonly SavedMeal[], slot: string): SavedMeal[] {
  const out: SavedMeal[] = [];
  for (const m of meals) {
    if (m.defaultMealSlot === slot) out.push(m);
  }
  // Sort newest-logged first (lastLoggedAt desc, then createdAt desc).
  return out.sort((a, b) => {
    const ta = a.lastLoggedAt ? Date.parse(a.lastLoggedAt) : 0;
    const tb = b.lastLoggedAt ? Date.parse(b.lastLoggedAt) : 0;
    if (ta !== tb) return tb - ta;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function TodayMealsSection({
  mealsGrouped,
  mealsForSelectedDate,
  effectiveCalorieTarget,
  fiberTarget,
  collapsedSlots,
  onToggleSlot,
  onOpenAddForSlot,
  onOpenSaveUsualMeal,
  onOpenDuplicateDay,
  onRequestCopyMeal,
  onDeleteMeal,
  onOpenMealNutrition,
  onOpenLogSheet,
  savedMeals,
  onLogSavedMeal,
  onLogAgain,
  hintVisibleForSlot,
  onDismissUsualMealHint,
  onAcceptUsualMealHint,
  quickAddCollapsed,
  onToggleQuickAddCollapsed,
  quickAddPanel,
}: TodayMealsSectionProps) {
  const showQuickAdd =
    mealsForSelectedDate.length > 0 &&
    onToggleQuickAddCollapsed != null &&
    quickAddPanel != null;
  // Audit M7 (2026-04-18) — themed destructive-confirm dialog
  // replacing the prior `window.confirm` on the Delete overflow item.
  const [deleteCandidate, setDeleteCandidate] = React.useState<
    { id: string; recipeTitle: string } | null
  >(null);

  // Ship M1 — "pick which usual meal to log" sheet when 2+ saved meals
  // match the slot. `null` = closed; `{ slot, options }` = open for slot.
  const [usualPicker, setUsualPicker] = React.useState<
    { slot: string; options: SavedMeal[] } | null
  >(null);

  // 2026-05-15 (crowder task) — flag-gated header relayout. When ON,
  // the `Log usual: <name>` button moves out of the section-header
  // trailing cluster into a dedicated row directly under the header.
  // Mirrors the mobile change. See
  // `docs/decisions/2026-05-15-today-log-usual-row-v2.md`.
  const usualRowV2 = isFeatureEnabled("today_log_usual_row_v2");

  // ENG-797 / P5 parity (#6, #7, #27) — branded meal-management chrome.
  // When ON, the kebab dropdown gains a quiet SupprMark + thumbnail/title/
  // macro header (mirroring mobile's MealActionSheet), and the usual-meal
  // picker gains the same brand mark. The desktop dropdown interaction is
  // preserved — we add a header band, never a grabber bottom sheet. The
  // copy-meal dialog inherits the same chrome via its own flag read.
  // Legacy bare dropdown/dialog stays alive in the flag-off `else`.
  // Mirror: apps/mobile/components/today/TodayMealsSection.tsx (MealActionSheet).
  const brandedSheets = isFeatureEnabled("redesign_branded_sheets");

  // P5 parity (#22) — route the usual-meal picker open through the shared
  // motion vocabulary (`sheetTransition`) instead of Radix's default
  // fade/zoom. Mirrors mobile's slide-up sheet feel. Legacy Radix
  // animation stays alive when the flag is off. See src/lib/motion.ts.
  const redesignMotion = isFeatureEnabled("redesign_motion");

  // Figma `654:2` — summary meal cards (photo + Logged + Log {slot} CTA),
  // not TD4 `481:2` slot-grouped IconBox headers.
  const mealsFigmaLayout = isFeatureEnabled("today_meals_figma_654");

  return (
    <div className="mb-6">
      {!mealsFigmaLayout ? (
        <div className="flex items-start justify-between gap-3">
          <TodayScrollSectionHeader
            title="Today's Meals"
            testID="today-meals-section-header"
            className="mb-4 flex-1 min-w-0"
          />
          {mealsForSelectedDate.length > 0 && (
            <button
              type="button"
              onClick={onOpenDuplicateDay}
              className="mt-1 shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border bg-card"
              aria-label="Duplicate this day to another day"
            >
              <Icons.copyPlus className="w-3.5 h-3.5" />
              Duplicate day…
            </button>
          )}
        </div>
      ) : null}
      {showQuickAdd && (
        // Design Direction 2026 (ENG-795): canonical SupprCard — soft elevation
        // under `design_system_elevation`, flat byte-for-byte when OFF.
        // `padding="none"` keeps the child-padded `overflow-hidden` layout.
        <SupprCard
          elevation="slab-flat"
          radius="lg"
          padding="none"
          className="mb-3 overflow-hidden"
        >
          <button
            type="button"
            onClick={onToggleQuickAddCollapsed}
            aria-expanded={!quickAddCollapsed}
            aria-controls="today-meals-quick-add-panel"
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Icons.energy className="h-4 w-4 opacity-70" aria-hidden="true" />
              <span className="text-sm font-semibold">Quick add</span>
              <span className="text-xs truncate opacity-80">Your usuals</span>
            </span>
            <Icons.down
              className={`h-4 w-4 opacity-70 transition-transform ${quickAddCollapsed ? "" : "rotate-180"}`}
              aria-hidden="true"
            />
          </button>
          {!quickAddCollapsed ? (
            <div id="today-meals-quick-add-panel" className="px-3 pb-3">
              {quickAddPanel}
            </div>
          ) : null}
        </SupprCard>
      )}
      {mealsFigmaLayout ? (
        <>
          <TodayMealsFigmaLayout
            mealsGrouped={mealsGrouped}
            collapsedSlots={collapsedSlots}
            onToggleSlot={onToggleSlot}
            onOpenAddForSlot={onOpenAddForSlot}
            renderSlotExpanded={(sectionName, sectionMeals) => (
              <div
                className="border-t border-border/10"
                data-testid={`today-meals-figma-expanded-${sectionName}`}
              >
                {sectionMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/10"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {(() => {
                        const thumbUrl = mealRowImageUrl(meal);
                        if (thumbUrl) {
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbUrl}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg object-cover"
                            />
                          );
                        }
                        return (
                          <SourceDot
                            source={mapMealSourceToDot(meal.source)}
                            size={6}
                            className="shrink-0"
                          />
                        );
                      })()}
                      <span className="truncate text-sm text-foreground">
                        {meal.recipeTitle}
                      </span>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(meal.calories)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="px-1 text-muted-foreground hover:text-foreground"
                            aria-label={`More actions for ${meal.recipeTitle}`}
                          >
                            <Icons.more className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onOpenMealNutrition ? (
                            <DropdownMenuItem
                              onSelect={() => onOpenMealNutrition(meal.id)}
                            >
                              View nutrition
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onSelect={() => onRequestCopyMeal(meal.id)}
                          >
                            Copy to another day…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setDeleteCandidate({
                                id: meal.id,
                                recipeTitle: meal.recipeTitle,
                              });
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  data-testid={`today-add-food-${sectionName}`}
                  onClick={() => onOpenAddForSlot(sectionName)}
                  className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--primary-solid)] hover:opacity-80"
                  aria-label={`Add food to ${sectionName}`}
                >
                  <Icons.add className="h-4 w-4 shrink-0" aria-hidden />
                  Add food
                </button>
              </div>
            )}
          />
          {mealsForSelectedDate.length > 0 ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onOpenDuplicateDay}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                aria-label="Duplicate this day to another day"
              >
                <Icons.copyPlus className="h-3.5 w-3.5" />
                Duplicate day…
              </button>
            </div>
          ) : null}
        </>
      ) : (
      <div className="flex flex-col gap-3">
        {mealsGrouped.map(({ name: sectionName, meals: sectionMeals }) => {
          const hasMeals = sectionMeals.length > 0;
          const isOpen = !collapsedSlots.has(sectionName);
          const slotCals = Math.round(sectionMeals.reduce((sum, m) => sum + m.calories, 0));
          const slotProtein = sectionMeals.reduce((sum, m) => sum + (m.protein ?? 0), 0);
          const slotCarbs = sectionMeals.reduce((sum, m) => sum + (m.carbs ?? 0), 0);
          const slotFat = sectionMeals.reduce((sum, m) => sum + (m.fat ?? 0), 0);
          const slotFiber = sectionMeals.reduce(
            (sum, m) => sum + ((m as { fiberG?: number }).fiberG ?? 0),
            0,
          );
          // Preserve the distributeMealBudget call so any downstream
          // analytics side-effects remain identical. Result is unused
          // today but this mirrors the pre-H3 source exactly.
          const consumed: Record<string, number> = {};
          for (const gm of mealsGrouped) {
            // ENG-785: sum RAW m.calories — storage is already baked at
            // the entry's portion (F-70 convention), so re-applying the
            // portion multiplier here double-counts. The per-row display
            // (line ~526) and the day total both sum raw; match them.
            const cals = gm.meals.reduce((a, m) => a + m.calories, 0);
            if (cals > 0) consumed[gm.name] = cals;
          }
          distributeMealBudget(effectiveCalorieTarget, fiberTarget, consumed);

          const mealIconInfo = getMealIcon(sectionName);
          const slotSavedMeals = savedMealsForSlot(savedMeals, sectionName);
          const hasSaved = slotSavedMeals.length > 0;
          const showSaveRow = sectionMeals.length >= 2 && !hasSaved;
          const showHint =
            !hasSaved && sectionMeals.length >= 1 && hintVisibleForSlot(sectionName);
          const primarySaved = slotSavedMeals[0];
          const extraSavedCount = slotSavedMeals.length - 1;

          return (
            <SupprCard
              key={sectionName}
              elevation="slab-flat"
              radius="lg"
              padding="none"
              data-testid={`today-slot-${sectionName}`}
              className={`overflow-hidden ${hasMeals ? "" : "opacity-55"}`}
            >
              {/* Meal header row — TD4: Newsreader slot name + macro chips */}
              <div
                data-testid={`today-slot-header-${sectionName}`}
                className={`flex items-center gap-2.5 px-3.5 py-3 cursor-pointer select-none ${hasMeals && isOpen ? "border-b border-border" : ""}`}
                onClick={() => {
                  if (!hasMeals) {
                    onOpenAddForSlot(sectionName);
                    return;
                  }
                  onToggleSlot(sectionName);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!hasMeals) onOpenAddForSlot(sectionName);
                    else onToggleSlot(sectionName);
                  }
                }}
                aria-expanded={hasMeals ? isOpen : undefined}
                aria-label={
                  hasMeals
                    ? `${sectionName}, ${sectionMeals.length} items — expand or collapse`
                    : `${sectionName} — add food`
                }
              >
                <IconBox size="sm" tone={mealIconInfo.tone}>
                  <mealIconInfo.icon />
                </IconBox>
                <div className="flex-1 min-w-0">
                  <p className="font-[family-name:var(--font-headline)] text-lg font-medium text-foreground truncate">
                    {sectionName}
                  </p>
                  {hasMeals ? (
                    <SlotMacroChips
                      kcal={slotCals}
                      protein={slotProtein}
                      carbs={slotCarbs}
                      fat={slotFat}
                      fiber={slotFiber}
                    />
                  ) : null}
                </div>
                {/* Ship M1 — `Log usual: {name}` pill on slot headers with
                    ≥1 saved meal matching this slot. 2+ matches open the
                    picker sheet. Replaces the old 10px "Save combo"
                    metadata pill — that action now lives in the
                    full-width row below the last item.
                    2026-05-15 (crowder task) — when `usualRowV2` is ON,
                    this chip moves to a dedicated row below the header
                    so the header stays compact on narrow widths. */}
                {!usualRowV2 && mealsForSelectedDate.length > 0 && hasSaved && primarySaved && (
                  <button
                    type="button"
                    data-testid={`today-log-usual-pill-in-header-${sectionName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (slotSavedMeals.length >= 2) {
                        setUsualPicker({ slot: sectionName, options: slotSavedMeals });
                      } else {
                        onLogSavedMeal(primarySaved, sectionName);
                      }
                    }}
                    className={`mr-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${slotPillClassName(sectionName)}`}
                    aria-label={
                      slotSavedMeals.length >= 2
                        ? `Log a usual ${sectionName} — choose from ${slotSavedMeals.length} saved meals`
                        : `Log usual ${sectionName}: ${primarySaved.name}`
                    }
                    title={
                      slotSavedMeals.length >= 2
                        ? `Choose from ${slotSavedMeals.length} saved meals`
                        : `Log ${primarySaved.name}`
                    }
                  >
                    <Icons.refresh className="w-3 h-3" aria-hidden />
                    <span className="max-w-[140px] truncate">
                      Log usual{extraSavedCount > 0 ? "…" : `: ${primarySaved.name}`}
                    </span>
                  </button>
                )}
                <Icons.down
                  data-testid={`today-slot-chevron-${sectionName}`}
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsedSlots.has(sectionName) ? "-rotate-90" : ""}`}
                />
              </div>

              {/* 2026-05-15 (crowder task) — flag-gated dedicated row for
                  the `Log usual: <name>` button. Lives between the header
                  and the food items so the header stays compact even
                  when the saved-meal name is long. Renders regardless
                  of collapse state so the affordance is reachable from
                  collapsed slots too. */}
              {usualRowV2 && mealsForSelectedDate.length > 0 && hasSaved && primarySaved && (
                <div
                  data-testid={`today-log-usual-row-${sectionName}`}
                  className="flex items-center px-3.5 py-2 border-b border-border/10"
                >
                  <button
                    type="button"
                    data-testid={`today-log-usual-pill-${sectionName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (slotSavedMeals.length >= 2) {
                        setUsualPicker({ slot: sectionName, options: slotSavedMeals });
                      } else {
                        onLogSavedMeal(primarySaved, sectionName);
                      }
                    }}
                    className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${slotPillClassName(sectionName)}`}
                    aria-label={
                      slotSavedMeals.length >= 2
                        ? `Log a usual ${sectionName} — choose from ${slotSavedMeals.length} saved meals`
                        : `Log usual ${sectionName}: ${primarySaved.name}`
                    }
                    title={
                      slotSavedMeals.length >= 2
                        ? `Choose from ${slotSavedMeals.length} saved meals`
                        : `Log ${primarySaved.name}`
                    }
                  >
                    <Icons.refresh className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {extraSavedCount > 0
                        ? `Log usual ${sectionName}…`
                        : `Log usual: ${primarySaved.name}`}
                    </span>
                  </button>
                </div>
              )}

              {/* Expanded meal items */}
              {!collapsedSlots.has(sectionName) && sectionMeals.length > 0 && (
                <div>
                  {sectionMeals.map((meal) => (
                    <div
                      key={meal.id}
                      // Audit 2026-04-30 visual-qa P1 #11 — the inline
                      // 56px padding overrode the Tailwind `px-4` and
                      // diverged from the slot header (`px-3.5` = 14px),
                      // creating a 42px nesting indent without any
                      // visual connector. Align to the slot header so
                      // meals read as flat list items under the header.
                      className="flex items-center justify-between px-4 py-2.5 border-b border-border/10"
                      style={{ paddingLeft: 14 }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {(() => {
                          const thumbUrl = mealRowImageUrl(meal);
                          if (thumbUrl) {
                            return (
                              <img
                                src={thumbUrl}
                                alt=""
                                className="h-10 w-10 rounded-lg object-cover shrink-0"
                              />
                            );
                          }
                          return (
                            <SourceDot
                              source={mapMealSourceToDot(meal.source)}
                              size={6}
                              className="shrink-0"
                            />
                          );
                        })()}
                        <span className="text-sm text-foreground truncate">{meal.recipeTitle}</span>
                        {/* 2026-05-22 (Grace, mirrored to web 2026-05-31): the
                            per-meal source badge (`✓ Verified` / `✎ Manual`
                            dingbats) was deliberately removed from the meal row
                            on mobile — provenance lives on the meal detail page,
                            and the badge cluttered the scannable row. Web now
                            matches by not rendering NutritionSourceBadge here.
                            The component is still exported for other surfaces. */}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(meal.calories)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground px-1"
                              aria-label={`More actions for ${meal.recipeTitle}`}
                            >
                              <Icons.more className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className={brandedSheets ? "min-w-[244px] p-0" : undefined}
                          >
                            {/* P5 parity (#6, #27) — branded header band: a
                                quiet SupprMark + thumbnail + title + macro
                                line, matching mobile's MealActionSheet header
                                (apps/mobile/.../TodayMealsSection.tsx:308-335).
                                Desktop dropdown interaction is unchanged; this
                                only adds brand identity above the actions. */}
                            {brandedSheets && (
                              <>
                                <DropdownMenuLabel
                                  data-testid={`today-meal-action-branded-header-${meal.id}`}
                                  className="flex items-center gap-2.5 px-3 py-2.5 font-normal"
                                >
                                  {(() => {
                                    const thumbUrl = mealRowImageUrl(meal);
                                    if (thumbUrl) {
                                      return (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={thumbUrl}
                                          alt=""
                                          className="h-9 w-9 rounded-lg object-cover shrink-0"
                                        />
                                      );
                                    }
                                    return (
                                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 shrink-0">
                                        <Icons.dinner className="h-4 w-4 text-primary" aria-hidden />
                                      </span>
                                    );
                                  })()}
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                      <SupprMark
                                        size={14}
                                        className="opacity-50 shrink-0"
                                        aria-hidden
                                      />
                                      <span className="truncate text-[13px] font-semibold text-foreground">
                                        {meal.recipeTitle}
                                      </span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                      {formatMacroTrailer({
                                        calories: meal.calories,
                                        protein: meal.protein,
                                        carbs: meal.carbs,
                                        fat: meal.fat,
                                      })}
                                    </span>
                                  </span>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {/* P5 parity gap #15 — "View nutrition" opens the
                                per-meal nutrition-detail dialog. Only renders when
                                the host wired `onOpenMealNutrition` (flag
                                `web_meal_nutrition_detail` on); flag-OFF → absent,
                                kebab byte-identical to before. Mirror: the mobile
                                meal row routes to `meal-nutrition.tsx`. */}
                            {onOpenMealNutrition && (
                              <DropdownMenuItem
                                data-testid={`today-meal-view-nutrition-${meal.id}`}
                                className={brandedSheets ? "mx-1" : undefined}
                                onSelect={() => onOpenMealNutrition(meal.id)}
                              >
                                <Icons.pieChart className="w-3.5 h-3.5" aria-hidden />
                                View nutrition
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className={brandedSheets ? "mx-1" : undefined}
                              onSelect={() => onRequestCopyMeal(meal.id)}
                            >
                              Copy to another day…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={brandedSheets ? "mx-1" : undefined}
                              onSelect={async () => {
                                const message = buildMealShareText({
                                  recipeTitle: meal.recipeTitle,
                                  calories: meal.calories,
                                  protein: meal.protein,
                                  carbs: meal.carbs,
                                  fat: meal.fat,
                                  portionMultiplier: meal.portionMultiplier,
                                });
                                if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                                  try {
                                    await navigator.share({ title: meal.recipeTitle, text: message });
                                    track("meal_share_invoked", {
                                      surface: "today_meal_row_kebab",
                                      outcome: "shared",
                                    });
                                  } catch (err) {
                                    track("meal_share_invoked", {
                                      surface: "today_meal_row_kebab",
                                      outcome: (err as Error)?.name === "AbortError" ? "dismissed" : "error",
                                    });
                                  }
                                  return;
                                }
                                try {
                                  await navigator.clipboard.writeText(message);
                                  toast.success("Meal copied to clipboard");
                                  track("meal_share_invoked", {
                                    surface: "today_meal_row_kebab",
                                    outcome: "shared",
                                  });
                                } catch {
                                  toast.error("Couldn't copy meal");
                                  track("meal_share_invoked", {
                                    surface: "today_meal_row_kebab",
                                    outcome: "error",
                                  });
                                }
                              }}
                            >
                              Share meal
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setDeleteCandidate({ id: meal.id, recipeTitle: meal.recipeTitle });
                              }}
                              className={`text-destructive focus:text-destructive${brandedSheets ? " mx-1 mb-1" : ""}`}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}

                  {/* Ship M1 — first-run hint inside the slot body. Teaches
                      the feature once per slot then stops. Renders above
                      the save row so a user who hasn't saved yet sees the
                      invitation before the action. */}
                  {showHint && (
                    <div
                      role="note"
                      aria-label={`Tip — make this your usual ${sectionName}`}
                      className={`mx-3.5 my-2 rounded-card border p-3 ${slotHintClassName(sectionName)}`}
                    >
                      <p className="text-[13px] font-semibold text-foreground">
                        Make this your usual {sectionName.toLowerCase()}.
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        One tap to re-log it tomorrow.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAcceptUsualMealHint(sectionName)}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${slotHintCtaClassName(sectionName)}`}
                          aria-label={`Save ${sectionName} as a usual meal`}
                        >
                          <Icons.save className="w-3 h-3" aria-hidden />
                          Save as usual
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissUsualMealHint(sectionName)}
                          className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1"
                          aria-label={`Dismiss the usual-meal hint for ${sectionName}`}
                        >
                          Not now
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ENG-786 — "Log this/these again". Re-inserts this
                      slot's current entries as fresh entries on the viewed
                      day with the same baked macros. Flag-gated via the
                      `onLogAgain` prop (undefined when `today_log_again` is
                      off → row absent, layout byte-identical). Mirror:
                      `apps/mobile/components/today/TodayMealsSection.tsx`. */}
                  {onLogAgain && (
                    <button
                      type="button"
                      data-testid={`today-log-again-${sectionName}`}
                      onClick={() => onLogAgain(sectionName)}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 border-t border-border/40 text-[13px] font-semibold text-foreground hover:bg-muted/40 transition-colors"
                      aria-label={`Log ${sectionName} again — re-add ${
                        sectionMeals.length > 1 ? "these items" : "this item"
                      } to the day`}
                    >
                      <Icons.refresh className="w-4 h-4" aria-hidden />
                      {sectionMeals.length > 1 ? "Log these again" : "Log this again"}
                    </button>
                  )}

                  {/* Ship M1 — full-width "Save {Slot} as a meal" row. Only
                      renders when the slot has ≥2 items and no saved meal
                      yet for this slot. Same weight as other primary row
                      actions — this is the canonical save entry point now
                      that the 10px pill is gone. */}
                  {showSaveRow && (
                    <button
                      type="button"
                      onClick={() => onOpenSaveUsualMeal(sectionName)}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 border-t border-border/40 text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                      aria-label={`Save ${sectionName} as a usual meal — one tap to re-log next time`}
                    >
                      <Icons.save className="w-4 h-4" aria-hidden />
                      Save {sectionName} as a meal
                    </button>
                  )}

                  {/* TD4 — in-card Add food (populated, open slots only). */}
                  <button
                    type="button"
                    data-testid={`today-add-food-${sectionName}`}
                    onClick={() => onOpenAddForSlot(sectionName)}
                    className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--primary-solid)] hover:opacity-80"
                    aria-label={`Add food to ${sectionName}`}
                  >
                    <Icons.add className="h-4 w-4 shrink-0" aria-hidden />
                    Add food
                  </button>
                </div>
              )}
            </SupprCard>
          );
        })}
      </div>
      )}

      {!mealsFigmaLayout && mealsForSelectedDate.length === 0 ? (
        <SupprCard elevation="slab-flat" radius="lg" padding="none" className="overflow-hidden">
          <div
            data-testid="today-meals-empty-state"
            className="px-4 py-10 text-center"
          >
            <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-muted">
              <Icons.dinner className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No meals logged on this day
            </p>
            <p className="text-[13px] text-muted-foreground mb-5">
              Tap below to search, scan, snap a photo, or use your voice.
            </p>
            <button
              type="button"
              onClick={onOpenLogSheet}
              data-testid="today-meals-empty-cta"
              aria-label="Log a meal"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Icons.add className="h-5 w-5" />
              Log a meal
            </button>
          </div>
        </SupprCard>
      ) : null}
      <DestructiveConfirmDialog
        open={deleteCandidate != null}
        onOpenChange={(o) => {
          if (!o) setDeleteCandidate(null);
        }}
        title={
          deleteCandidate ? `Remove "${deleteCandidate.recipeTitle}"?` : "Remove meal?"
        }
        description="This removes the meal from today's log."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (deleteCandidate) onDeleteMeal(deleteCandidate.id, deleteCandidate.recipeTitle);
        }}
      />

      {/* Ship M1 — usual-meal picker for slots with 2+ matches. */}
      <Dialog
        open={usualPicker != null}
        onOpenChange={(o) => {
          if (!o) setUsualPicker(null);
        }}
      >
        <DialogContent
          className="bg-card border-border max-w-md"
          style={
            redesignMotion
              ? (() => {
                  const t = sheetTransition(usualPicker != null);
                  return { transform: t.transform, transition: t.transition };
                })()
              : undefined
          }
        >
          <DialogHeader>
            {/* P5 parity (#6, #27) — quiet brand mark above the title under
                redesign_branded_sheets, matching mobile's branded sheets. */}
            {brandedSheets && (
              <span
                data-testid="usual-picker-branded-mark"
                className="mb-1 inline-flex"
              >
                <SupprMark size={16} className="opacity-50" aria-hidden />
              </span>
            )}
            <DialogTitle className="text-foreground">
              {usualPicker ? `Log a usual ${usualPicker.slot}` : "Log a usual meal"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Pick which saved meal to log. Newest logged first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {(usualPicker?.options ?? []).slice(0, 3).map((m) => {
              const summary = summariseSavedMeal(m);
              const itemsLabel =
                summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (usualPicker) {
                      onLogSavedMeal(m, usualPicker.slot);
                    }
                    setUsualPicker(null);
                  }}
                  className="w-full text-left rounded-card bg-card card-slab-flat px-3 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  aria-label={`Log ${m.name} — ${itemsLabel}, ${summary.totalCalories} kcal`}
                >
                  <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                  {/* 2026-05-13 (premium-bar audit cross-cutting):
                      macro format unified via `formatMacroTrailer` so
                      this row matches the canonical "698 kcal · 22g
                      P · 95g C · 27g F" shape used on NorthStar +
                      EatAgain + macro tiles. Was letter-first
                      ("P 22g"). */}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {itemsLabel} · {formatMacroTrailer({
                      calories: summary.totalCalories,
                      protein: summary.totalProtein,
                      carbs: summary.totalCarbs,
                      fat: summary.totalFat,
                    })}
                  </p>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUsualPicker(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
