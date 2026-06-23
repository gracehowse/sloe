"use client";

import * as React from "react";
import { ReportRecipeDialog } from "./report-recipe-dialog";

/**
 * useRecipeReport — owns the per-recipe "Report an issue" dialog state + render
 * (ENG-1225 #19), so the pinned RecipeDetail host only adds a menu item
 * (`onSelect={openReport}`) and `{dialog}`. Returns the trigger + the rendered
 * dialog. Mirror target: `apps/mobile/app/recipe/[id].tsx` (parity follow-up).
 */
export function useRecipeReport(
  recipeId: string,
  recipeTitle?: string,
): { openReport: () => void; dialog: React.ReactNode } {
  const [open, setOpen] = React.useState(false);
  const dialog = (
    <ReportRecipeDialog
      open={open}
      onOpenChange={setOpen}
      recipeId={recipeId}
      recipeTitle={recipeTitle}
    />
  );
  return { openReport: () => setOpen(true), dialog };
}
