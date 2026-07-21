"use client";

/**
 * CookbookImport — web Cookbook-Import surface (ENG-1582, parity with the
 * mobile flow at `apps/mobile/app/cookbook-import.tsx`).
 *
 * Spine: pick PDF → extract + parse → review (per-recipe exclude,
 * author-vs-match) → save to Library (partial-save on free tier).
 * Reuses the SAME `/api/cookbook-import/*` routes and the SAME shared
 * `commitCookbookImport` pipeline the mobile flow calls.
 */
import { ArrowLeft, ChefHat, RefreshCw } from "lucide-react";
import { SupprButton } from "./suppr/suppr-button.tsx";
import { CookbookImportReview } from "./cookbook-import/CookbookImportReview.tsx";
import { CookbookImportSuccess } from "./cookbook-import/CookbookImportSuccess.tsx";
import { useCookbookImport } from "./cookbook-import/useCookbookImport.ts";

interface CookbookImportProps {
  /** Return to the Library surface. */
  onClose: () => void;
  onUpgrade?: () => void;
  onViewLibrary?: () => void;
  onBuildPlan?: () => void;
}

export function CookbookImport({
  onClose,
  onUpgrade,
  onViewLibrary,
  onBuildPlan,
}: CookbookImportProps) {
  const s = useCookbookImport(onClose, onUpgrade);

  if (s.step === "parsing") {
    return (
      <div
        data-testid="cookbook-import-parsing"
        className="product-shell py-pm-6 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4"
      >
        <ChefHat className="size-10 text-primary-solid" aria-hidden />
        <RefreshCw className="size-6 animate-spin text-primary-solid -mt-2" aria-hidden />
        <p className="font-[family-name:var(--font-headline)] text-[22px] text-foreground-brand">
          {s.parsingMessage}
        </p>
        <p className="text-[13px] text-muted-foreground max-w-sm">
          Recipes are matched to Sloe&apos;s food database — you review before saving.
        </p>
        <SupprButton variant="ghost" onClick={() => s.setStep("pick")}>
          Cancel
        </SupprButton>
      </div>
    );
  }

  if (s.step === "success") {
    return (
      <CookbookImportSuccess
        savedCount={s.savedCount}
        bookName={s.bookName}
        partialSave={s.partialSave}
        onViewLibrary={onViewLibrary ?? onClose}
        onBuildPlan={onBuildPlan ?? onClose}
      />
    );
  }

  if (s.step === "review") {
    return (
      <CookbookImportReview
        bookName={s.bookName}
        recipes={s.recipes}
        selectedCount={s.selectedRecipes.length}
        excludedKeys={s.excludedKeys}
        nutritionMode={s.nutritionMode}
        setNutritionMode={s.setNutritionMode}
        parseWarnings={s.parseWarnings}
        pickError={s.pickError}
        committing={s.committing}
        onBack={() => s.setStep("pick")}
        onToggle={s.toggleExclude}
        onSave={() => void s.finishSave()}
      />
    );
  }

  return (
    <div data-testid="cookbook-import-pick" className="product-shell py-pm-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to library"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <h1 className="font-[family-name:var(--font-headline)] text-[28px] text-foreground-brand">
          Import cookbook
        </h1>
      </div>

      <p className="text-[15px] text-muted-foreground leading-relaxed">
        Upload one searchable PDF from your scanner app. Sloe extracts every recipe with
        ingredients — then you build your week in Plan.
      </p>

      <input
        ref={s.fileInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        data-testid="cookbook-import-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          s.onPickFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        data-testid="cookbook-import-pick-pdf"
        onClick={() => s.fileInputRef.current?.click()}
        className="w-full rounded-[var(--radius-card-lg)] border border-dashed border-border bg-card p-6 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <p className="font-[family-name:var(--font-headline)] text-[15px] text-foreground">
          {s.pickedFile ? s.pickedFile.name : "Choose cookbook PDF"}
        </p>
        <p className="text-[13px] text-muted-foreground mt-2">
          {s.pickedFile
            ? "Click to replace · export a searchable PDF (not a flat scan)"
            : "Searchable PDF export (not a flat scan) — 4 MB max"}
        </p>
      </button>

      <div className="space-y-2">
        <label htmlFor="cookbook-import-book-name" className="section-label">
          Book name
        </label>
        <input
          id="cookbook-import-book-name"
          data-testid="cookbook-import-book-name"
          value={s.bookName}
          onChange={(e) => s.setBookName(e.target.value)}
          placeholder="e.g. Fast 800"
          className="w-full rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus-visible:ring-primary"
        />
      </div>

      {s.pickError ? (
        <div role="alert" data-testid="cookbook-import-error" className="space-y-2">
          <p className="text-[13px] text-destructive">{s.pickError}</p>
          {s.pickError.includes("Pro") && onUpgrade ? (
            <SupprButton variant="ghost" onClick={onUpgrade} data-testid="cookbook-import-upgrade">
              View plans
            </SupprButton>
          ) : null}
        </div>
      ) : null}

      <SupprButton
        variant="primary"
        className="w-full"
        onClick={() => void s.runParse()}
        data-testid="cookbook-import-parse"
      >
        Parse cookbook
      </SupprButton>
    </div>
  );
}

export default CookbookImport;
