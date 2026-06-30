"use client";

/**
 * SavedMealsTab (Batch 2.6; renamed copy Ship M1, 2026-04-18) — the
 * **"Usual meals"** tab body inside `QuickAddPanel`. Lists the user's
 * saved meals with total kcal / P / C / F, a one-tap log button, and an
 * overflow with Rename / Delete.
 *
 * Full item-editing is **out of scope** for this batch — user deletes
 * + re-creates to change items. This is documented in the empty-state
 * helper text and in `docs/product/overview.md`.
 *
 * The parent (`QuickAddPanel`) owns fetch + persistence + optimistic
 * state; this component is presentation + action dispatch only so the
 * optimistic logic stays in one place.
 */

import { useState } from "react";
import { Bookmark, Loader2, LogIn, MoreVertical, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SourceDot } from "../ui/source-dot";
import type { SavedMeal } from "../../../lib/nutrition/savedMeals";
import {
  dominantSavedMealSource,
  summariseSavedMeal,
} from "../../../lib/nutrition/savedMealsLogic";
import { EmptyState } from "./empty-state";

export type SavedMealsTabProps = {
  meals: SavedMeal[];
  loading: boolean;
  /** Slot the one-tap log will target (falls back to the meal's
   * `defaultMealSlot` when defined). */
  activeSlot: string;
  /** Optimistic pending set keyed by saved meal id. */
  pendingIds: Set<string>;
  /** Log the whole combo to its effective slot. */
  onLog: (meal: SavedMeal) => void;
  /** Inline prompt → new name. Parent shows the rename input UI; this
   * component only exposes the trigger. */
  onRename: (meal: SavedMeal) => void;
  onDelete: (meal: SavedMeal) => void;
  /** Optional empty-state override if the user has not signed in. */
  signedIn: boolean;
};

export function SavedMealsTab({
  meals,
  loading,
  activeSlot,
  pendingIds,
  onLog,
  onRename,
  onDelete,
  signedIn,
}: SavedMealsTabProps) {
  // Track menu open state locally so tapping inside the dropdown doesn't
  // trigger the row-level log handler.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-6 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading saved meals…
      </div>
    );
  }

  if (!signedIn) {
    return (
      <EmptyState
        illustration={<LogIn aria-hidden />}
        title="Sign in to save a usual meal for one-tap re-logging."
      />
    );
  }

  if (meals.length === 0) {
    // Ship M1 (2026-04-18) — copy aligned with the new slot-header full
    // width row ("Save {Slot} as a meal") so the empty-state points the
    // user at the canonical save entry point.
    return (
      <EmptyState
        illustration={<Bookmark aria-hidden />}
        title={
          <>
            Log 2 or more items in a slot, then tap{" "}
            <span className="font-medium text-foreground">Save {"{"}Slot{"}"} as a meal</span>{" "}
            to re-log it in one tap.
          </>
        }
      />
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {meals.map((meal) => {
        const summary = summariseSavedMeal(meal);
        const pending = pendingIds.has(meal.id);
        const slotLabel = meal.defaultMealSlot ?? activeSlot;
        const itemsLabel = summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
        // Trust posture (audit 2026-04-30 round-2 fix #B7) — surface
        // the dominant source across this meal's items so the saved
        // meal row carries the same provenance signal as a single
        // diary row. See `dominantSavedMealSource` for the rule.
        const dominantSource = dominantSavedMealSource(meal);
        return (
          <div key={meal.id} className="flex items-center gap-2 px-3.5 py-2.5">
            <SourceDot source={dominantSource} size={6} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate">{meal.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {itemsLabel} · {summary.totalCalories} kcal · P {Math.round(summary.totalProtein)}g · C{" "}
                {Math.round(summary.totalCarbs)}g · F {Math.round(summary.totalFat)}g
              </p>
            </div>
            <DropdownMenu
              open={openMenuId === meal.id}
              onOpenChange={(o) => setOpenMenuId(o ? meal.id : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                  aria-label={`More actions for ${meal.name}`}
                  aria-haspopup="menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setOpenMenuId(null);
                    onRename(meal);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setOpenMenuId(null);
                    onDelete(meal);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => onLog(meal)}
              disabled={pending || summary.itemCount === 0}
              className={`size-7 inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary-solid hover:bg-primary/20 ${
                pending ? "opacity-60 cursor-not-allowed" : ""
              }`}
              aria-label={`Log ${meal.name} to ${slotLabel}`}
              title={`Log to ${slotLabel}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default SavedMealsTab;
