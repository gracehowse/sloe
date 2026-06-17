/**
 * Mobile thin wrapper around the shared Plan-Import commit pipeline
 * (`@suppr/shared/planning/planImport/commitPlanImport`, ENG-696).
 *
 * The persistence rules (recipe insert → ingredients → save → template →
 * week materialise) live in the shared module so web + mobile do NOT fork the
 * pipeline. This wrapper only injects the mobile Supabase client and keeps the
 * mobile call-site signature (`commitPlanImport(input)` with no client arg)
 * stable.
 */
import { supabase } from "@/lib/supabase";
import {
  commitPlanImport as commitPlanImportShared,
  type PlanImportCommitResult,
} from "@suppr/shared/planning/planImport/commitPlanImport";
import type {
  PlanImportCompiledSlot,
  PlanImportNutritionMode,
  PlanImportVerifiedRecipe,
} from "@suppr/shared/planning/planImport/types";

export type { PlanImportCommitResult };

export type PlanImportCommitInput = {
  userId: string;
  planName: string;
  recipes: PlanImportVerifiedRecipe[];
  slots: PlanImportCompiledSlot[];
  nutritionMode: PlanImportNutritionMode;
  importToLibrary: boolean;
};

export function commitPlanImport(input: PlanImportCommitInput): Promise<PlanImportCommitResult> {
  return commitPlanImportShared({ supabase, ...input });
}
