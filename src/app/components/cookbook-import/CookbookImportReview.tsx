"use client";

/**
 * CookbookImportReview — the review step of the web Cookbook-Import surface
 * (ENG-1582). Per-recipe include/exclude, author-vs-match nutrition mode, and
 * sticky save footer. Presentation only — state comes from `useCookbookImport`.
 */
import { ArrowLeft } from "lucide-react";
import { SupprButton } from "../suppr/suppr-button.tsx";
import { CookbookImportReviewRow } from "./CookbookImportReviewRow.tsx";
import type {
  PlanImportNutritionMode,
  PlanImportVerifiedRecipe,
} from "../../../lib/planning/planImport/types.ts";

interface CookbookImportReviewProps {
  bookName: string;
  recipes: PlanImportVerifiedRecipe[];
  selectedCount: number;
  excludedKeys: Set<string>;
  nutritionMode: PlanImportNutritionMode;
  setNutritionMode: (mode: PlanImportNutritionMode) => void;
  parseWarnings: string[];
  pickError: string | null;
  committing: boolean;
  onBack: () => void;
  onToggle: (key: string) => void;
  onSave: () => void;
}

export function CookbookImportReview({
  bookName,
  recipes,
  selectedCount,
  excludedKeys,
  nutritionMode,
  setNutritionMode,
  parseWarnings,
  pickError,
  committing,
  onBack,
  onToggle,
  onSave,
}: CookbookImportReviewProps) {
  return (
    <div data-testid="cookbook-import-review" className="product-shell py-pm-6 flex flex-col min-h-[70vh]">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to pick PDF"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <h1 className="font-[family-name:var(--font-headline)] text-[28px] text-foreground-brand">
          Review recipes
        </h1>
      </div>

      <p className="text-[15px] text-foreground mb-4">
        {selectedCount} of {recipes.length} selected ·{" "}
        <span className="font-[family-name:var(--font-headline)]">{bookName}</span>
      </p>

      {parseWarnings.length > 0 ? (
        <p className="text-[13px] text-muted-foreground mb-4">
          Note: {parseWarnings.join(", ").replace(/_/g, " ")}
        </p>
      ) : null}

      <div className="space-y-2 mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Nutrition handling
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["author", "match"] as const).map((mode) => {
            const active = nutritionMode === mode;
            return (
              <button
                key={mode}
                type="button"
                data-testid={`cookbook-import-mode-${mode}`}
                onClick={() => setNutritionMode(mode)}
                aria-pressed={active}
                className={[
                  "rounded-[var(--radius-card)] px-4 py-3 text-[13px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "bg-primary-soft text-primary-solid"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted/60",
                ].join(" ")}
              >
                {mode === "author" ? "Author's numbers" : "Match & verify"}
              </button>
            );
          })}
        </div>
      </div>

      {pickError ? (
        <p role="alert" data-testid="cookbook-import-error" className="text-[13px] text-destructive mb-4">
          {pickError}
        </p>
      ) : null}

      <div className="flex-1 space-y-3 pb-10">
        {recipes.map((item) => (
          <CookbookImportReviewRow
            key={item.key}
            item={item}
            excluded={excludedKeys.has(item.key)}
            nutritionMode={nutritionMode}
            onToggle={onToggle}
          />
        ))}
      </div>

      <div className="sticky bottom-0 py-4 border-t border-border bg-background/95 backdrop-blur-sm mt-4">
        <p className="text-[15px] text-foreground mb-3">
          {selectedCount} of {recipes.length} selected
        </p>
        <SupprButton
          variant="primary"
          className="w-full"
          disabled={committing || selectedCount === 0}
          onClick={onSave}
          data-testid="cookbook-import-save"
        >
          {committing ? "Saving…" : `Save ${selectedCount} recipes to Library`}
        </SupprButton>
      </div>
    </div>
  );
}
