"use client";

/**
 * SaveMealDialog (Batch 2.6; renamed copy Ship M1, 2026-04-18) — create
 * a **saved meal** (formerly "combo") from 2+ already-logged items in
 * the current session.
 *
 * This is not a recipe. It's a reusable bundle of foods — e.g.
 * "My usual breakfast" = oatmeal + berries + protein powder — so the
 * user can re-log the whole thing in one tap from the Quick Add panel's
 * "Usual meals" tab (`SavedMealsTab`) or from the new slot-header
 * `Log usual: {name}` pill.
 *
 * Behaviour:
 *  - Name input (required; trimmed) + default-slot dropdown
 *  - Reorder preview (up / down arrows on each row) and remove
 *  - Save calls `createSavedMeal` from the shared `savedMeals.ts`
 *    helper; the caller applies optimistic UI on its side and shows a
 *    Sonner toast.
 *  - Focus moves to the name input when the dialog opens (Radix
 *    handles the underlying focus trap; we just set `autoFocus`).
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { SavedMealItem } from "../../../lib/nutrition/savedMeals";

const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type MealSlot = (typeof MEAL_SLOTS)[number];

type SavePayload = {
  name: string;
  defaultMealSlot?: MealSlot;
  items: Array<Omit<SavedMealItem, "id" | "position">>;
};

export type SaveMealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Items the user is about to bundle into a saved meal — preserved order. */
  initialItems: Array<Omit<SavedMealItem, "id" | "position">>;
  /** Default slot preselected in the dropdown (usually the active slot). */
  defaultSlot?: MealSlot;
  /** Called with the final payload when the user taps Save. */
  onSave: (payload: SavePayload) => void | Promise<void>;
  /** Optional prefix for suggested names (e.g. "My usual breakfast"). */
  suggestedName?: string;
};

export function SaveMealDialog({
  open,
  onOpenChange,
  initialItems,
  defaultSlot,
  onSave,
  suggestedName,
}: SaveMealDialogProps) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<MealSlot | "">(defaultSlot ?? "");
  const [items, setItems] = useState<typeof initialItems>([]);
  const [saving, setSaving] = useState(false);

  // Reset internal state every time the dialog opens so a previous
  // partially-filled edit can't leak into a new session.
  useEffect(() => {
    if (open) {
      setName(suggestedName ?? "");
      setSlot(defaultSlot ?? "");
      setItems(initialItems);
      setSaving(false);
    }
  }, [open, defaultSlot, suggestedName, initialItems]);

  const canSave = useMemo(() => {
    return name.trim().length > 0 && items.length >= 1 && !saving;
  }, [name, items.length, saving]);

  const moveItem = (from: number, direction: -1 | 1) => {
    setItems((prev) => {
      const to = from + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [row] = next.splice(from, 1);
      if (row) next.splice(to, 0, row);
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        ...(slot ? { defaultMealSlot: slot as MealSlot } : {}),
        items,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Save as a usual meal</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            One tap re-logs all of these items next time.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Name</span>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                defaultSlot ? `My usual ${defaultSlot.toLowerCase()}` : "My usual breakfast"
              }
              autoFocus
              maxLength={80}
              aria-label="Usual meal name"
              aria-required="true"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Default slot (optional)</span>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as MealSlot | "")}
              className="w-full h-9 px-3 rounded-md border border-border bg-input-background text-foreground text-sm"
              aria-label="Default meal slot"
            >
              <option value="">No default</option>
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Items ({items.length})
            </span>
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                No items left. Cancel and pick more items to save.
              </p>
            )}
            <ul className="divide-y divide-border/50 rounded-md border border-border overflow-hidden">
              {items.map((it, i) => (
                <li
                  key={`${it.recipeTitle}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {it.recipeTitle || "Untitled"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round(it.calories)} kcal · P {Math.round(it.protein)}g · C{" "}
                      {Math.round(it.carbs)}g · F {Math.round(it.fat)}g
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => moveItem(i, -1)}
                    disabled={i === 0}
                    className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Move ${it.recipeTitle || "item"} up`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(i, 1)}
                    disabled={i === items.length - 1}
                    className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Move ${it.recipeTitle || "item"} down`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${it.recipeTitle || "item"} from usual meal`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave} aria-disabled={!canSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveMealDialog;
