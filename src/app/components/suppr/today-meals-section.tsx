"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import { AddRowButton } from "../ui/add-row-button";
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
import { SupprButton } from "./suppr-button";
import { SourceDot } from "../ui/source-dot";
import { mapMealSourceToDot } from "../../../lib/nutrition/sourceMap";
import { MEAL_SLOTS } from "../../../lib/nutrition/mealSlots";
import { formatMacroTrailer } from "../../../lib/nutrition/macroFormat";
import { distributeMealBudget } from "../../../lib/nutrition/mealBudget";
import { emptySlotAimKcal } from "../../../lib/nutrition/mealSlotAim";
import { EmptyMealSlotAimLine } from "./empty-meal-slot-row";
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
import { shareMealTextOrLink } from "../../../lib/share/shareMealAction";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { useCalmMode } from "../../../lib/preferences/useCalmMode";
import { sheetTransition } from "../../../lib/motion";
import { mealRowImageUrl } from "../../../lib/nutrition/foodHistory";
import { TodayScrollSectionHeader } from "./today-scroll-section-header";
import { SwipeDeleteRow } from "../ui/swipe-delete-row";

/** ENG-1099 M6 — recipe-tier meal rows get PressableScale-style press feedback. */
function todayMealRowPressClass(clickable: boolean): string {
  if (!clickable) return "";
  return " transition-transform duration-150 ease-out active:scale-[0.97] origin-left";
}

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
  /** ENG-1373 — heading bound to the viewed date by the caller (`mealsSectionTitle`); defaults to "Today's Meals". */
  title?: string;
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
   * (`<MealNutritionDialog>`). When set, a "View nutrition" item renders in
   * each meal row's kebab menu; undefined → no item. Host wires this
   * unconditionally now (`web_meal_nutrition_detail` collapsed, ENG-1651).
   * Mirror: the mobile meal row routes to `apps/mobile/app/meal-nutrition.tsx`.
   */
  onOpenMealNutrition?: (mealId: string) => void;
  /**
   * ENG-837 — open the per-slot nutrition-detail dialog
   * (`<MealNutritionDialog slotAggregate>`), summing every logged item in the
   * slot. When set, a quiet "View slot nutrition" affordance renders on each
   * POPULATED slot header; undefined → no affordance. Same collapsed flag as
   * `onOpenMealNutrition` above. Mirror: the mobile slot opens
   * `apps/mobile/app/meal-nutrition.tsx?slot=&date=`.
   */
  onOpenSlotNutrition?: (slot: string) => void;
  /**
   * ENG-1122 — open the logged-meal edit dialog. When set (flag
   * `web_logged_meal_edit` on), an "Edit" item renders in each meal row's
   * kebab menu. Undefined (flag off) → no item.
   */
  onEditMeal?: (mealId: string) => void;
  /**
   * Empty-state primary CTA — opens the unified `<LogSheet>` (the same entry
   * the bottom-bar raised "+" uses on mobile-web; its right-edge icons cover
   * scan / voice / photo). Mirror: `apps/mobile/components/today/
   * TodayMealsSection.tsx` renders no collage — raised "+" + per-slot rows.
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
  /**
   * ENG-1642 — creates a real shareable meal-share link (`/m/<token>`)
   * for the kebab "Share meal" action and returns its URL, or `null` on
   * any failure (host resolves the flag, the meal, and the RPC call).
   * When set (flag `meal_share_links_v1` on), "Share meal" tries this
   * FIRST and, on success, shares/copies the link alongside the existing
   * text summary. Undefined (flag off) or a `null` return falls back to
   * the exact pre-ENG-1642 text-only share/copy path. Host:
   * `NutritionTracker.tsx`'s `onShareMealLink`.
   */
  onShareMealLink?: (mealId: string) => Promise<string | null>;
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
  /** ENG-1177 — enabled slot labels; defaults to classic four when omitted. */
  slotLabels?: readonly string[];
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

/** Slot-tinted pill chrome — avoids ink (`text-primary`) on every row.
 *  ENG-1109 — text stays `text-foreground-secondary` (AA-safe), never the
 *  slot hue as text (slot hue alone fails AA at caption size). */
function slotPillClassName(_sectionName: string): string {
  return "border-border bg-background-secondary text-foreground-secondary hover:bg-muted/60";
}

/** ENG-1099 M5 — lighter slot glyph chip (18% → 12% tint). */
function slotIconTierClass(
  tone: ReturnType<typeof getMealIcon>["tone"],
): string | undefined {
  switch (tone) {
    case "slot-breakfast":
      return "!bg-slot-breakfast/12";
    case "slot-lunch":
      return "!bg-slot-lunch/12";
    case "slot-dinner":
      return "!bg-slot-dinner/12";
    case "slot-snack":
      return "!bg-slot-snack/12";
    default:
      return undefined;
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
      <span data-testid="today-macro-chip-label" className="text-[var(--macro-protein-solid)]">
        {Math.round(protein)}g
      </span>
      <span data-testid="today-macro-chip-label" className="text-[var(--macro-carbs-solid)]">
        {Math.round(carbs)}g
      </span>
      <span data-testid="today-macro-chip-label" className="text-[var(--macro-fat-solid)]">
        {Math.round(fat)}g
      </span>
      {Number.isFinite(fiber) && fiber > 0 ? (
        <span data-testid="today-macro-chip-label" className="text-[var(--macro-fiber-solid)]">
          {Math.round(fiber * 10) / 10}g
        </span>
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
  title = "Today's Meals",
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
  onOpenSlotNutrition,
  onEditMeal,
  onOpenLogSheet,
  savedMeals,
  onLogSavedMeal,
  onLogAgain,
  onShareMealLink,
  hintVisibleForSlot,
  onDismissUsualMealHint,
  onAcceptUsualMealHint,
  quickAddCollapsed,
  onToggleQuickAddCollapsed,
  quickAddPanel,
  slotLabels,
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

  // ENG-1095 — web↔mobile meals parity (Grace 2026-06-13). Mobile iterates a
  // FIXED slot list (Breakfast/Lunch/Dinner/Snacks) so all four rows render on
  // every day, including an empty one; web only ever built slots that had
  // logged meals, so an empty day collapsed to a single "Log a meal" card and
  // logging Breakfast made Lunch/Dinner/Snacks vanish. Render the four standard
  // slots ALWAYS (+ any extra populated slot, e.g. a legacy "Other"/"Planned",
  // appended in their existing order so no logged meal is dropped), mirroring
  // mobile's `slots.map`. Gated on `today_meals_all_slots_v1` (default-on);
  // off → the legacy populated-only list + the "Log a meal" empty card (kept in
  // the else as the kill switch). Web-only: mobile already renders all four.
  const allSlotsOn = isFeatureEnabled("today_meals_all_slots_v1");
  const enabledSlotLabels = slotLabels ?? MEAL_SLOTS;
  const slotsToRender = React.useMemo(() => {
    if (!allSlotsOn) return mealsGrouped;
    const byName = new Map(mealsGrouped.map((g) => [g.name, g]));
    const standard = enabledSlotLabels.map(
      (name) => byName.get(name) ?? { name, meals: [] },
    );
    const extras = mealsGrouped.filter(
      (g) => !(enabledSlotLabels as readonly string[]).includes(g.name),
    );
    return [...standard, ...extras];
  }, [allSlotsOn, mealsGrouped, enabledSlotLabels]);

  // ENG-1092 "Purposeful empties" — empty slots show "Aim ~X kcal" (redistributed
  // budget) where the macro chips sit on a populated slot. `consumedBySlot` feeds
  // the shared helper so partial-day aims shrink honestly. Gated on
  // `plan_today_aim_empty_v1`; off → bare empty slots (pre-ENG-1092).
  const aimEmptyOn = isFeatureEnabled("plan_today_aim_empty_v1");
  // ENG-1098 "Calm mode" — quiet the per-slot aim numbers (the empty slot still
  // renders; only the "Aim ~X kcal" line is hidden). Shared key with mobile.
  const [calmMode] = useCalmMode();
  const consumedBySlot = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of mealsGrouped) {
      map[g.name] = g.meals.reduce((a, m) => a + m.calories, 0);
    }
    return map;
  }, [mealsGrouped]);

  return (
    <div className="mb-6" data-testid="today-meals-section">
      <div className="flex items-start justify-between gap-3">
        <TodayScrollSectionHeader
          title={title}
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
      {showQuickAdd && (
        // Design Direction 2026 (ENG-795): canonical SupprCard.
        // `padding="none"` keeps the child-padded `overflow-hidden` layout.
        // One-treatment elevation (Grace 2026-06-09): the quick-add card sits
        // on the page ground → soft lift (`elevation="card"`). Was slab-flat.
        <SupprCard
          elevation="card"
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
      {/* F-160 (TF57): with the lift retired (flat-card surfaces 2026-06-12) the
          slot cards no longer need air to separate them — the inter-card gap
          tightens to the pre-inversion rhythm (`gap-2` 8px, was `gap-3` 12px) so
          the four slots read as one tight grouped block (mobile `Spacing.sm` parity). */}
      <div className="flex flex-col gap-2">
        {/* Proto `card card--flush divide` (Grace 2026-06-25, reverses TD4 /
            ENG-1099): ONE raised card holding the slots as hairline-divided rows. */}
        <SupprCard elevation="card" radius="lg" padding="none" className="overflow-hidden">
        {slotsToRender.map(({ name: sectionName, meals: sectionMeals }, slotIdx) => {
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
            <div
              key={sectionName}
              data-testid={`today-slot-${sectionName}`}
              // Proto `.card--flush divide`: divided ROW inside the outer card
              // (no per-slot card) — hairline between slots, none after the last.
              className={`overflow-hidden ${
                slotIdx < slotsToRender.length - 1 ? "border-b border-border" : ""
              }`}
            >
              {/* Meal header row — TD4: Newsreader slot name + macro chips */}
              <div
                className={`flex items-center gap-2.5 px-3.5 py-3 ${hasMeals && isOpen ? "border-b border-border" : ""}`}
              >
                {/* Expand/add trigger is a real <button> over the icon+name;
                    the action pills are SIBLINGS (un-nested) so the row no
                    longer trips axe `nested-interactive`. (ENG-1225) */}
                <button
                  type="button"
                  data-testid={`today-slot-header-${sectionName}`}
                  onClick={() => {
                    if (!hasMeals) {
                      onOpenAddForSlot(sectionName);
                      return;
                    }
                    onToggleSlot(sectionName);
                  }}
                  aria-expanded={hasMeals ? isOpen : undefined}
                  aria-label={
                    hasMeals
                      ? `${sectionName}, ${sectionMeals.length} items — expand or collapse`
                      : `${sectionName} — add food`
                  }
                  className="flex flex-1 min-w-0 items-center gap-2.5 text-left cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                >
                <IconBox
                  size="sm"
                  tone={mealIconInfo.tone}
                  className={slotIconTierClass(mealIconInfo.tone)}
                >
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
                  ) : aimEmptyOn && !calmMode ? (
                    (() => {
                      // ENG-1092 — empty-slot purpose line, in the exact spot the
                      // macro chips fill on a populated slot. `null` (no target /
                      // day at-or-over budget) → no line, never "Aim ~0 kcal".
                      // ENG-1098: hidden entirely under Calm mode.
                      const aim = emptySlotAimKcal(
                        sectionName,
                        effectiveCalorieTarget,
                        fiberTarget,
                        consumedBySlot,
                      );
                      return aim == null ? null : (
                        <EmptyMealSlotAimLine
                          slot={sectionName}
                          aimKcal={aim}
                          surface="today"
                        />
                      );
                    })()
                  ) : null}
                </div>
                </button>
                {/* Ship M1 — `Log usual: {name}` pill on slot headers with
                    ≥1 saved meal matching this slot. 2+ matches open the
                    picker sheet. Replaces the old 10px "Save combo"
                    metadata pill — that action now lives in the
                    full-width row below the last item. The pill itself
                    lives in the dedicated row below the header (see
                    `today-log-usual-row-${sectionName}` further down),
                    not inline here — kept compact on narrow widths. */}
                {/* ENG-837 — quiet "View slot nutrition" affordance. Populated
                    slots only (an empty slot has nothing to aggregate). Tertiary
                    ghost icon-button (NOT a filled CTA — one filled CTA per
                    screen rule). `stopPropagation` so it opens the slot-aggregate
                    dialog instead of toggling the slot collapse. Only renders when
                    the host wired `onOpenSlotNutrition` — the host wires this
                    unconditionally now (`web_meal_nutrition_detail` collapsed,
                    ENG-1651). Mirror: mobile slot → meal-nutrition.tsx?slot=. */}
                {onOpenSlotNutrition && hasMeals ? (
                  <button
                    type="button"
                    data-testid={`today-slot-view-nutrition-${sectionName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSlotNutrition(sectionName);
                    }}
                    className="mr-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`View combined nutrition for ${sectionName}`}
                    title={`View combined nutrition for ${sectionName}`}
                  >
                    <Icons.pieChart className="w-3.5 h-3.5" aria-hidden />
                    <span className="sr-only sm:not-sr-only">Slot nutrition</span>
                  </button>
                ) : null}
                {/* ENG-1095: empty slots show a "+" (add) affordance, not a
                    chevron — a downward chevron on an empty row reads as
                    "expand" when there's nothing to expand. Matches mobile's
                    trailing "+" on empty per-slot rows. Populated slots keep the
                    expand/collapse chevron. */}
                {hasMeals ? (
                  <Icons.down
                    data-testid={`today-slot-chevron-${sectionName}`}
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsedSlots.has(sectionName) ? "-rotate-90" : ""}`}
                  />
                ) : (
                  <Icons.add
                    data-testid={`today-slot-add-${sectionName}`}
                    className="w-4 h-4 text-muted-foreground"
                    aria-hidden
                  />
                )}
              </div>

              {/* 2026-05-15 (crowder task, ENG-1651 permanent 2026-07-22) —
                  dedicated row for the `Log usual: <name>` button. Lives
                  between the header and the food items so the header
                  stays compact even when the saved-meal name is long.
                  Renders regardless of collapse state so the affordance
                  is reachable from collapsed slots too. Mirrors mobile.
                  See `docs/decisions/2026-05-15-today-log-usual-row-v2.md`. */}
              {mealsForSelectedDate.length > 0 && hasSaved && primarySaved && (
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
                    <SwipeDeleteRow
                      key={meal.id}
                      onDelete={() =>
                        setDeleteCandidate({ id: meal.id, recipeTitle: meal.recipeTitle })
                      }
                    >
                    <div
                      data-testid={`today-meal-row-${meal.id}`}
                      // `pl-3.5` aligns rows to the slot header (visual-qa P1 #11).
                      // ENG-1524 — real hairline divider (full `border-border`, no
                      // `/10` alpha; the old 10% was near-invisible).
                      className={`flex items-center justify-between py-2.5 pl-3.5 pr-4 border-b border-border${
                        todayMealRowPressClass(Boolean(onOpenMealNutrition))
                      }`}
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
                        {/* ENG-1524 — name demoted to secondary ink (↔ mobile). */}
                        <span className="text-sm text-muted-foreground truncate">{meal.recipeTitle}</span>
                        {/* Source badge removed (Grace 2026-05-22) — it lives on the meal detail page. */}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {/* ENG-1524 — kcal is the tracker's point: promoted to the
                            headline font (text-lg, primary, tabular-nums); "kcal" a tertiary suffix. */}
                        <span className="flex items-baseline gap-0.5">
                          <span data-testid={`today-meal-kcal-${meal.id}`} className="font-[family-name:var(--font-headline)] text-lg font-medium text-foreground tabular-nums">
                            {Math.round(meal.calories)}
                          </span>
                          <span className="text-[11px] text-foreground-tertiary">kcal</span>
                        </span>
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
                                      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 shrink-0">
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
                                the host wired `onOpenMealNutrition` (unconditional
                                now — `web_meal_nutrition_detail` collapsed,
                                ENG-1651). Mirror: the mobile meal row routes to
                                `meal-nutrition.tsx`. */}
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
                            {onEditMeal && (
                              <DropdownMenuItem
                                data-testid={`today-meal-edit-${meal.id}`}
                                className={brandedSheets ? "mx-1" : undefined}
                                onSelect={() => onEditMeal(meal.id)}
                              >
                                <Icons.edit className="w-3.5 h-3.5" aria-hidden />
                                Edit
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
                                const shareUrl = onShareMealLink ? await onShareMealLink(meal.id) : null;
                                await shareMealTextOrLink({
                                  title: meal.recipeTitle,
                                  message,
                                  shareUrl,
                                  linkAttempted: Boolean(onShareMealLink),
                                  surface: "today_meal_row_kebab",
                                });
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
                    </SwipeDeleteRow>
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

                  {/* In-card Add food (populated, open slots only). This pill
                      (F-160, the FIRST quiet-fill adoption) is the canonical
                      AddControl — now rendered by the shared `AddRowButton`
                      primitive it was extracted into (2026-07-10 AddControl
                      ruling, ENG-1375 S4). A wrapper div keeps the card-edge
                      inset. Mirror: apps/mobile/.../TodayMealsSection.tsx. */}
                  <div className="px-3 pb-3 pt-2">
                    <AddRowButton
                      data-testid={`today-add-food-${sectionName}`}
                      onClick={() => onOpenAddForSlot(sectionName)}
                      label="Add food"
                      aria-label={`Add food to ${sectionName}`}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </SupprCard>{/* /one outer meal-section card */}
      </div>

      {!allSlotsOn && mealsForSelectedDate.length === 0 ? (
        // ENG-1095: superseded by the always-render four-slot list when
        // `today_meals_all_slots_v1` is on (empty day shows the four per-slot
        // rows, mobile parity). This single "Log a meal" card is the flag-off
        // kill switch only.
        // One-treatment elevation (Grace 2026-06-09): empty-state card sits on
        // the page ground → soft lift (`elevation="card"`). Was slab-flat.
        <SupprCard elevation="card" radius="lg" padding="none" className="overflow-hidden">
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
            {/* Button system (2026-06-12): the empty-day "Log a meal" CTA →
                `SupprButton` variant="primary" (solid aubergine fill, white
                label + glyph, pill, no shadow — the solid fill IS the
                affordance). Supersedes the old aubergine-OUTLINE treatment.
                Mirrors the mobile `TodayFirstMealEmptyState` "Log a meal",
                the cold-start CTA authority (primary). */}
            <SupprButton
              variant="primary"
              onClick={onOpenLogSheet}
              data-testid="today-meals-empty-cta"
              aria-label="Log a meal"
              className="gap-2"
            >
              <Icons.add className="h-5 w-5" />
              Log a meal
            </SupprButton>
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
                  // One card grammar (ENG-1499): all resting cards are flat +
                  // hairline via `.card-slab` (the legacy flat-slab alias
                  // class is retired — it had become byte-identical).
                  className="w-full text-left rounded-card bg-card card-slab px-3 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
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
