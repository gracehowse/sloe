"use client";

import * as React from "react";
import { toast } from "sonner";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import NutritionSourceBadge from "../../../components/NutritionSourceBadge";
import type { UserTier } from "../../../types/recipe";
import { distributeMealBudget } from "../../../lib/nutrition/mealBudget";
import {
  isMealPlanPlaceholderLikeTitle,
  scaledMacro,
} from "../../../lib/nutrition/portionMultiplier";
import { normalizeJournalSlotName } from "../../../lib/nutrition/journalSlot";
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

export type TodayMealSectionPlanEntry = {
  name: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isPlaceholder?: boolean;
  /** Lets the Today log path pull fiber/sugar/sodium from the saved recipe. */
  recipeId?: string | null;
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
  mealPlanFirstDay: { meals: TodayMealSectionPlanEntry[] } | null;
  onLogPlanMeal: (meal: TodayMealSectionPlanEntry) => void;
  onOpenAddCustom: () => void;
  onOpenPhotoLog: () => void;
  onOpenVoiceLog: () => void;
  userTier: UserTier;
  /** Ship M1 — all saved meals the authed user owns, sorted newest-logged-first. */
  savedMeals: SavedMeal[];
  /** Ship M1 — log a saved meal into a specific slot. */
  onLogSavedMeal: (meal: SavedMeal, slot: string) => void;
  /** Ship M1 — whether the first-run hint is allowed to render in `slot`.
   * Computed in the host via `shouldShowUsualMealHint`. */
  hintVisibleForSlot: (slot: string) => boolean;
  /** Ship M1 — user tapped "Not now" on the hint for `slot`. */
  onDismissUsualMealHint: (slot: string) => void;
  /** Ship M1 — user tapped "Save as usual" on the hint for `slot`. */
  onAcceptUsualMealHint: (slot: string) => void;
}

function getMealIcon(name: string): { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; tone: "warning" | "success" | "primary" | "fat" } {
  if (name === "Breakfast") return { icon: Icons.breakfast as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "warning" };
  if (name === "Lunch") return { icon: Icons.lunch as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "success" };
  if (name === "Dinner") return { icon: Icons.dinner as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "primary" };
  if (name === "Snacks") return { icon: Icons.snack as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "fat" };
  return { icon: Icons.add as React.ComponentType<React.SVGProps<SVGSVGElement>>, tone: "primary" };
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
  mealPlanFirstDay,
  onLogPlanMeal,
  onOpenAddCustom,
  onOpenPhotoLog,
  onOpenVoiceLog,
  userTier,
  savedMeals,
  onLogSavedMeal,
  hintVisibleForSlot,
  onDismissUsualMealHint,
  onAcceptUsualMealHint,
}: TodayMealsSectionProps) {
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

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Meals</h3>
        {mealsForSelectedDate.length > 0 && (
          <button
            type="button"
            onClick={onOpenDuplicateDay}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border bg-card"
            aria-label="Duplicate this day to another day"
          >
            <Icons.copyPlus className="w-3.5 h-3.5" />
            Duplicate day…
          </button>
        )}
      </div>
      <div className="rounded-card bg-card border border-border overflow-hidden">
        {mealsGrouped.map(({ name: sectionName, meals: sectionMeals }) => {
          // Preserve the distributeMealBudget call so any downstream
          // analytics side-effects remain identical. Result is unused
          // today but this mirrors the pre-H3 source exactly.
          const consumed: Record<string, number> = {};
          for (const gm of mealsGrouped) {
            const cals = gm.meals.reduce((a, m) => a + scaledMacro(m.calories, m.portionMultiplier ?? 1), 0);
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
            <div key={sectionName} className="border-b border-border last:border-b-0">
              {/* Meal header row */}
              <div
                className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border cursor-pointer select-none"
                onClick={() => onToggleSlot(sectionName)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleSlot(sectionName);
                  }
                }}
                aria-expanded={!collapsedSlots.has(sectionName)}
              >
                <IconBox size="sm" tone={mealIconInfo.tone}>
                  <mealIconInfo.icon />
                </IconBox>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{sectionName}</p>
                  <p className="text-[11px] text-muted-foreground">{sectionMeals.length} item{sectionMeals.length !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {Math.round(sectionMeals.reduce((sum, m) => sum + scaledMacro(m.calories, m.portionMultiplier ?? 1), 0))}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">kcal</span>
                {/* Ship M1 — `Log usual: {name}` pill on slot headers with
                    ≥1 saved meal matching this slot. 2+ matches open the
                    picker sheet. Replaces the old 10px "Save combo"
                    metadata pill — that action now lives in the
                    full-width row below the last item. */}
                {hasSaved && primarySaved && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (slotSavedMeals.length >= 2) {
                        setUsualPicker({ slot: sectionName, options: slotSavedMeals });
                      } else {
                        onLogSavedMeal(primarySaved, sectionName);
                      }
                    }}
                    className="mr-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
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
                <Icons.down className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${collapsedSlots.has(sectionName) ? "-rotate-90" : ""}`} />
              </div>

              {/* Expanded meal items */}
              {!collapsedSlots.has(sectionName) && sectionMeals.length > 0 && (
                <div>
                  {sectionMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-border/10"
                      style={{ paddingLeft: 56 }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                        <span className="text-xs text-foreground truncate">{meal.recipeTitle}</span>
                        {meal.source && <NutritionSourceBadge source={meal.source} />}
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
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onRequestCopyMeal(meal.id)}>
                              Copy to another day…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setDeleteCandidate({ id: meal.id, recipeTitle: meal.recipeTitle });
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

                  {/* Ship M1 — first-run hint inside the slot body. Teaches
                      the feature once per slot then stops. Renders above
                      the save row so a user who hasn't saved yet sees the
                      invitation before the action. */}
                  {showHint && (
                    <div
                      role="note"
                      aria-label={`Tip — make this your usual ${sectionName}`}
                      className="mx-3.5 my-2 rounded-card border border-primary/25 bg-primary/5 p-3"
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
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
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

                  {/* Ship M1 — full-width "Save {Slot} as a meal" row. Only
                      renders when the slot has ≥2 items and no saved meal
                      yet for this slot. Same weight as other primary row
                      actions — this is the canonical save entry point now
                      that the 10px pill is gone. */}
                  {showSaveRow && (
                    <button
                      type="button"
                      onClick={() => onOpenSaveUsualMeal(sectionName)}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 border-t border-border/40 text-[13px] font-semibold text-primary hover:bg-primary/5 transition-colors"
                      aria-label={`Save ${sectionName} as a usual meal — one tap to re-log next time`}
                    >
                      <Icons.save className="w-4 h-4" aria-hidden />
                      Save {sectionName} as a meal
                    </button>
                  )}
                </div>
              )}

              {/* Empty meal: dimmed slot with "Tap to add" matching mobile */}
              {!collapsedSlots.has(sectionName) && sectionMeals.length === 0 && (
                <button
                  type="button"
                  onClick={() => onOpenAddForSlot(sectionName)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 opacity-45 hover:opacity-70 transition-opacity"
                >
                  <span className="size-7 rounded-lg bg-muted flex items-center justify-center">
                    <Icons.add className="size-3.5 text-muted-foreground" />
                  </span>
                  <span className="text-xs text-muted-foreground">Tap to add</span>
                </button>
              )}
            </div>
          );
        })}

        {mealsForSelectedDate.length === 0 && (
          <div className="py-8">
            {/* Quick-log from plan if plan exists for day 1 */}
            {mealPlanFirstDay &&
            mealPlanFirstDay.meals.filter(
              (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
            ).length > 0 ? (
              <div className="mb-6">
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Log from today&apos;s plan</p>
                <div className="space-y-2">
                  {mealPlanFirstDay.meals
                    .filter(
                      (m) => !isMealPlanPlaceholderLikeTitle(m.recipeTitle, { isPlaceholder: m.isPlaceholder }),
                    )
                    .map((meal, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onLogPlanMeal(meal);
                          toast.success(`Logged ${meal.recipeTitle}`);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors text-left"
                      >
                        <div>
                          <span className="text-xs font-medium text-primary">{normalizeJournalSlotName(meal.name)}</span>
                          <p className="text-sm font-medium text-foreground">{meal.recipeTitle}</p>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">{Math.round(meal.calories)} kcal</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="text-center">
              <p className="mb-4 text-muted-foreground">
                {mealPlanFirstDay ? "Or add a custom meal" : "No meals logged on this day"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAddCustom}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-pm hover:bg-primary/90"
                >
                  <Icons.add className="h-5 w-5" />
                  {mealPlanFirstDay ? "Add custom meal" : "Log your first meal"}
                </button>
                <button
                  type="button"
                  onClick={onOpenPhotoLog}
                  aria-label={
                    userTier === "pro"
                      ? "AI photo log — snap a meal for nutrition estimates"
                      : "AI photo log — Pro feature"
                  }
                  title="Photos are sent to our servers and processed with AI to estimate nutrition. Pro only."
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  <Icons.camera className="h-5 w-5" />
                  Photo log
                  {userTier !== "pro" && <Icons.lock className="h-3.5 w-3.5" aria-hidden />}
                </button>
                <button
                  type="button"
                  onClick={onOpenVoiceLog}
                  aria-label={userTier === "pro" ? "Record voice log" : "Voice log — Pro feature"}
                  title="Voice and typed descriptions are processed with AI on our servers. Pro only."
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-5 py-3 font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  <Icons.mic className="h-5 w-5" />
                  Voice log
                  {userTier !== "pro" && <Icons.lock className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
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
                  className="w-full text-left rounded-card border border-border bg-card px-3 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  aria-label={`Log ${m.name} — ${itemsLabel}, ${summary.totalCalories} kcal`}
                >
                  <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {itemsLabel} · {summary.totalCalories} kcal · P{" "}
                    {Math.round(summary.totalProtein)}g · C{" "}
                    {Math.round(summary.totalCarbs)}g · F{" "}
                    {Math.round(summary.totalFat)}g
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
