import { useState } from "react";
import { ReportRecipeSheet } from "@/components/recipe/ReportRecipeSheet";

/**
 * useRecipeReport — owns the per-recipe "Report an issue" sheet state + render
 * (ENG-1227), so the pinned recipe-detail host only adds a menu entry
 * (`onPress: openReport`) and `{sheet}`. Web parity:
 * `src/app/components/suppr/use-recipe-report.tsx`.
 */
export function useRecipeReport(
  recipeId: string,
  recipeTitle?: string,
): { openReport: () => void; sheet: React.ReactNode } {
  const [open, setOpen] = useState(false);
  const sheet = (
    <ReportRecipeSheet
      visible={open}
      onClose={() => setOpen(false)}
      recipeId={recipeId}
      recipeTitle={recipeTitle}
    />
  );
  return { openReport: () => setOpen(true), sheet };
}
