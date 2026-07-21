"use client";

/**
 * CookbookImportReviewRow — a single recipe row in the web cookbook import
 * review list (ENG-1582). Mirrors mobile `CookbookReviewRow.tsx`.
 */
import { CheckCircle, UtensilsCrossed } from "lucide-react";
import type {
  PlanImportNutritionMode,
  PlanImportVerifiedRecipe,
} from "../../../lib/planning/planImport/types.ts";

interface CookbookImportReviewRowProps {
  item: PlanImportVerifiedRecipe;
  excluded: boolean;
  nutritionMode: PlanImportNutritionMode;
  onToggle: (key: string) => void;
}

export function CookbookImportReviewRow({
  item,
  excluded,
  nutritionMode,
  onToggle,
}: CookbookImportReviewRowProps) {
  const kcal =
    nutritionMode === "author" && item.authorNutrition?.calories
      ? item.authorNutrition.calories
      : item.supprNutrition.calories;

  const trustKcal =
    nutritionMode === "author"
      ? item.supprNutrition.calories
      : item.authorNutrition?.calories;

  return (
    <button
      type="button"
      data-testid={`cookbook-recipe-${item.key}`}
      onClick={() => onToggle(item.key)}
      className={[
        "w-full text-left rounded-[var(--radius-card)] border p-4 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        excluded
          ? "border-border bg-card opacity-55"
          : "border border-primary bg-primary-soft",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-muted"
          aria-hidden
        >
          <UtensilsCrossed className="size-[18px] text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-headline)] text-[15px] text-foreground line-clamp-2">
            {item.title}
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            Serves {item.serves} · {item.ingredientCount ?? item.ingredients.length} ingredients ·{" "}
            {item.confidence} confidence
          </p>
          {trustKcal != null && nutritionMode === "match" && item.authorNutrition?.calories ? (
            <p className="text-[13px] text-muted-foreground mt-0.5">author {item.authorNutrition.calories}</p>
          ) : null}
          {trustKcal != null && nutritionMode === "author" ? (
            <p className="text-[13px] text-muted-foreground mt-0.5">Sloe {item.supprNutrition.calories}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-[family-name:var(--font-headline)] text-[15px] text-foreground tabular-nums">
            {kcal} kcal
          </span>
          <span
            className={[
              "flex size-[22px] items-center justify-center rounded-md border-[1.5px]",
              excluded ? "border-border bg-transparent" : "border-primary bg-primary-soft",
            ].join(" ")}
            aria-hidden
          >
            {!excluded ? <CheckCircle className="size-[14px] text-primary-solid" strokeWidth={2} /> : null}
          </span>
        </div>
      </div>
    </button>
  );
}
