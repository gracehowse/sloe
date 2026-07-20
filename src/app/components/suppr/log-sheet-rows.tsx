"use client";

/**
 * LogSheet browse/library rows — extracted from `log-sheet.tsx`
 * (ENG-1448 PR 1; the 400-line discipline says every touch shrinks the
 * legacy file). Mobile parity: `apps/mobile/components/today/LogSheetRows.tsx`.
 *
 * `slotName` is the active meal slot from the host's ENG-773 slot
 * selector — it feeds the thumb's slot tier so an unmatched title gets
 * an honest slot glyph instead of a generic one (never a wrong food
 * image; see `foodFallbackCategory.ts`).
 */
import { Plus } from "lucide-react";
import { cn } from "../ui/utils";
import { FoodFallbackThumb } from "./food-fallback-thumb";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { type SourceDotSource } from "../ui/source-dot";
import type { LogSheetLibraryRecipe } from "./log-sheet";

export function LibraryRow({
  recipe,
  onPick,
  slotName,
}: {
  recipe: LogSheetLibraryRecipe;
  onPick: () => void;
  slotName?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Log ${recipe.title}`}
      className={cn(
        "flex w-full items-center rounded-md py-2 px-1 text-left",
        "hover:bg-muted/50 active:bg-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      {/* ENG-1611 — foods/ingredients render as text: no tiles on log-sheet rows. */}
      {isFeatureEnabled("ingredient_text_rows_v1") ? null : (
        <FoodFallbackThumb title={recipe.title} slot={slotName} imageUrl={recipe.thumbnail} />
      )}
      <div className={cn("flex-1 min-w-0", isFeatureEnabled("ingredient_text_rows_v1") ? "" : "ml-2")}>
        <p className="truncate text-[13px] text-foreground">{recipe.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {recipe.kcalPerPortion} kcal
          </span>
          {recipe.mealTag ? (
            <span className="rounded border border-border bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
              {recipe.mealTag}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function BrowseRow({
  title,
  kcal,
  source,
  onPick,
  subtitle,
  slotName,
}: {
  title: string;
  kcal: number;
  source: SourceDotSource;
  onPick: () => void;
  subtitle?: string;
  slotName?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      {/* ENG-1611 — text-only food rows (see LibraryRow note). */}
      {isFeatureEnabled("ingredient_text_rows_v1") ? null : (
        <FoodFallbackThumb
          title={title}
          slot={slotName}
          size={44}
          className="size-11 shrink-0 rounded-xl border border-border"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight text-foreground">{title}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {subtitle ?? `${kcal} kcal`}
        </p>
      </div>
      <button
        type="button"
        onClick={onPick}
        aria-label={`Log ${title}`}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-macro-carbs",
          "hover:bg-card/80 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        <Plus width={16} height={16} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
