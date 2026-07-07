"use client";

/**
 * FoodSearch — full-screen dialog for food search (web).
 *
 * As of 2026-04-30 (web parity follow-up to mobile commit `1968953`),
 * the dialog is a thin wrapper that mounts the shared
 * `<FoodSearchPanel>` body. The dialog owns:
 *   - the Dialog shell (`<Dialog>` + `<DialogContent>` + `<DialogHeader>`)
 *   - the search `<Input>` (auto-focused on open)
 *   - the close affordance (handled by Dialog primitive)
 *
 * Everything else — debounced multi-source search, results list,
 * pagination, preview portion picker + fit-this-in, custom-foods CRUD
 * — lives in `src/app/components/food-search/FoodSearchPanel.tsx`.
 *
 * The same panel is mounted inline by `<LogSheet>` so the user can
 * type-and-see-results without a second modal animation. See the
 * panel's docstring for the why.
 *
 * Call sites preserved (no host changes required):
 *   - `NutritionTracker.tsx` — Today, with budget context (fit-this-in
 *     lights up).
 *   - `RecipeDetail.tsx` — verify-ingredient.
 *
 * Mobile mirror: `apps/mobile/components/FoodSearchModal.tsx` — same
 * thin-wrapper shape, same panel mount.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog.tsx";
import { Input } from "./ui/input.tsx";
import { Icons } from "./ui/icons";
import {
  FoodSearchPanel,
  type FoodSearchSelection as PanelSelection,
  type SupabaseLike as PanelSupabaseLike,
} from "./food-search/FoodSearchPanel";
import type { MacroConsumed, MacroTargets } from "@/lib/nutrition/remainingMacros";

/** Re-exported for backwards compat with the existing call-site imports
 *  (`NutritionTracker.tsx`, `RecipeDetail.tsx`). The selection shape is
 *  identical across surfaces — only the file path moved. */
export type FoodSearchSelection = PanelSelection;

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: FoodSearchSelection) => void;
  initialQuery?: string;
  /** Original recipe amount (e.g. 2 for "2 chicken breasts") */
  initialAmount?: number | string | null;
  /** Original recipe unit (e.g. "lb", "cup", "g") */
  initialUnit?: string | null;
  /** Original ingredient description shown as context (e.g. "1 lb chicken breast") */
  originalDescription?: string | null;
  /** Optional budget context for fit-this-in projection. */
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  /** Custom-foods wiring. When omitted, the custom-food entry point is
   *  hidden and the search behaves exactly as before. */
  supabase?: PanelSupabaseLike;
  userId?: string | null;
  /** ENG-772 — journal day for food-search preview time picker. */
  logDateKey?: string;
  /** History-first search (ENG-1031) — the user's logging history, newest-
   *  first. Threaded to the panel so the typed-query "Past logged" group
   *  ranks matching past logs above database results. */
  recentFoods?: Array<{
    recipeTitle: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    source?: string;
    count?: number;
    imageUrl?: string | null;
  }>;
};

export function FoodSearch({
  open,
  onClose,
  onSelect,
  initialQuery = "",
  initialAmount,
  initialUnit,
  originalDescription,
  macroTargets,
  macroConsumed,
  supabase,
  userId,
  logDateKey,
  recentFoods,
}: Props) {
  // Caller owns the query; the panel reacts to it. We sync the input
  // back to `initialQuery` whenever the dialog opens so callers that
  // re-mount with a different starting query (recipe-verify path) get
  // the right starting search instead of stale text.
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Search Foods</DialogTitle>
        </DialogHeader>

        {/* Search input — owned by the dialog wrapper, not the panel. */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods…"
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Results + preview — shared panel. The panel scrolls
            internally; the Dialog's max-h-[85vh] keeps the whole
            surface in viewport. */}
        <div className="flex-1 overflow-hidden">
          <FoodSearchPanel
            query={query}
            initialAmount={initialAmount}
            initialUnit={initialUnit}
            originalDescription={originalDescription}
            macroTargets={macroTargets}
            macroConsumed={macroConsumed}
            supabase={supabase}
            userId={userId}
            logDateKey={logDateKey}
            recentFoods={recentFoods}
            mode="full"
            onSelect={(selection) => {
              onSelect(selection);
              // Dialog closes after a successful pick — matches the
              // pre-refactor behaviour byte-for-byte.
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
