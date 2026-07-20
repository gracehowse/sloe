"use client";

/**
 * CookbookImportSuccess — success state for web cookbook import (ENG-1582).
 * Mirrors mobile `CookbookSuccessView.tsx`.
 */
import { CheckCircle } from "lucide-react";
import { SupprButton } from "../suppr/suppr-button.tsx";

interface CookbookImportSuccessProps {
  savedCount: number;
  bookName: string;
  partialSave: boolean;
  onViewLibrary: () => void;
  onBuildPlan: () => void;
}

export function CookbookImportSuccess({
  savedCount,
  bookName,
  partialSave,
  onViewLibrary,
  onBuildPlan,
}: CookbookImportSuccessProps) {
  const label = bookName.trim() || "your cookbook";
  return (
    <div
      data-testid="cookbook-import-success"
      className="product-shell py-pm-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4"
    >
      <CheckCircle className="size-14 text-success-solid" aria-hidden />
      <h1 className="font-[family-name:var(--font-headline)] text-[32px] text-foreground-brand">
        Saved.
      </h1>
      <p className="text-[15px] text-muted-foreground max-w-sm">
        {partialSave
          ? `Saved ${savedCount} recipes before the free save limit. Upgrade to save the rest.`
          : `${savedCount} ${savedCount === 1 ? "recipe" : "recipes"} saved to Library as Imported · ${label}. Build your week in Plan when you're ready.`}
      </p>
      <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[12px] font-semibold text-muted-foreground">
        In your library
      </span>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mt-4">
        <SupprButton variant="primary" className="flex-1" onClick={onViewLibrary} data-testid="cookbook-import-view-library">
          View Library
        </SupprButton>
        <SupprButton variant="ghost" className="flex-1" onClick={onBuildPlan} data-testid="cookbook-import-build-plan">
          Build plan
        </SupprButton>
      </div>
    </div>
  );
}
