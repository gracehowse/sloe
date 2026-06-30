"use client";

/**
 * ENG-901 M6 — import-success surface (Figma `304:2`).
 * Web parity with mobile `import-shared.tsx` successSheet.
 */
import { Icons } from "../ui/icons";
import { SupprButton } from "./suppr-button";

export interface ImportSuccessSheetProps {
  recipeTitle: string;
  recipeId: string;
  macroLine?: string | null;
  creditLine?: string | null;
  onViewRecipe: () => void;
  onReviewIngredients?: () => void;
}

export function ImportSuccessSheet({
  recipeTitle,
  recipeId,
  macroLine,
  creditLine,
  onViewRecipe,
  onReviewIngredients,
}: ImportSuccessSheetProps) {
  return (
    <div
      data-testid="import-success-sheet"
      className="mx-auto w-full max-w-md rounded-[var(--radius-card-lg)] border border-[color-mix(in_srgb,var(--accent-success)_21%,transparent)] bg-card px-6 py-8 text-center shadow-[0_12px_24px_color-mix(in_srgb,var(--foreground-brand)_16%,transparent)]"
      role="status"
      aria-label={`Saved ${recipeTitle} to your library`}
    >
      <div className="mb-2 flex justify-center">
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent-success)_12%,transparent)]"
          aria-hidden
        >
          <Icons.check className="h-10 w-10 text-[var(--accent-success)]" strokeWidth={2.5} />
        </div>
      </div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent-success)]">
        Saved
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-headline)] text-2xl leading-tight text-foreground-brand px-1">
        {recipeTitle}
      </h2>
      {macroLine ? (
        <p className="mt-2 text-[15px] font-semibold text-muted-foreground">{macroLine}</p>
      ) : null}
      {creditLine ? (
        <p className="mt-1 text-sm font-semibold text-primary-solid">{creditLine}</p>
      ) : null}
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent-success)_21%,transparent)] bg-[color-mix(in_srgb,var(--accent-success)_8%,transparent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-success)]">
        <Icons.saved className="h-[18px] w-[18px]" aria-hidden />
        In your library
      </div>
      <SupprButton variant="primary" type="button" className="mt-6 w-full" onClick={onViewRecipe}>
        View recipe
      </SupprButton>
      {onReviewIngredients ? (
        <SupprButton variant="ghost" type="button" className="mt-3 w-full" onClick={onReviewIngredients}>
          Review ingredients
        </SupprButton>
      ) : null}
      <span className="sr-only">Recipe id {recipeId}</span>
    </div>
  );
}
