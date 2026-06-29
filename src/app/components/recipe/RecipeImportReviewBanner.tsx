"use client";

import { AlertTriangle } from "lucide-react";

import { importReviewBannerCopy } from "@/lib/nutrition/recipeImportReview";

export interface RecipeImportReviewBannerProps {
  sourceName?: string | null;
  sourceUrl?: string | null;
  onVerify: () => void;
}

/** ENG-1247 — web twin of `apps/mobile/components/recipe/RecipeImportReviewBanner.tsx`. */
export function RecipeImportReviewBanner({
  sourceName,
  sourceUrl,
  onVerify,
}: RecipeImportReviewBannerProps) {
  const copy = importReviewBannerCopy({ sourceName, sourceUrl });
  return (
    <div
      className="mb-4 flex gap-3 rounded-2xl p-4"
      style={{ backgroundColor: "var(--warning-soft)" }}
      data-testid="recipe-import-review-banner"
      role="status"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-[11px] text-white"
        style={{ backgroundColor: "var(--warning)" }}
      >
        <AlertTriangle className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{copy.title}</p>
        <p className="mt-1 text-sm text-foreground-secondary">{copy.body}</p>
        <button
          type="button"
          onClick={onVerify}
          className="mt-3 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground"
          style={{ backgroundColor: "var(--primary)" }}
        >
          Verify ingredients
        </button>
      </div>
    </div>
  );
}

export default RecipeImportReviewBanner;
