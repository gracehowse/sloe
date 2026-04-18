/**
 * Supabase client for `user_plan_templates` (Batch 3.10).
 *
 * Persistence wrapper around the shared pure helpers in `./planTemplates.ts`.
 * Both the web MealPlanner and the mobile PlannerScreen call through here so
 * parity stays tight — every new field needs to flow through these three
 * functions (`listPlanTemplates`, `createPlanTemplate`, `deletePlanTemplate`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanTemplate, PlanTemplateDraft, PlanTemplateSlot } from "./planTemplates.ts";
import { validatePlanTemplate } from "./planTemplates";

const TABLE = "user_plan_templates";

interface DbRow {
  id: string;
  user_id: string;
  name: string;
  day_count: number;
  slots: PlanTemplateSlot[];
  created_at: string;
  updated_at: string;
}

function rowToTemplate(row: DbRow): PlanTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    dayCount: row.day_count,
    slots: Array.isArray(row.slots) ? row.slots : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPlanTemplates(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ templates: PlanTemplate[]; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, user_id, name, day_count, slots, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return { templates: [], error: error.message };
  return { templates: (data as DbRow[] | null ?? []).map(rowToTemplate), error: null };
}

export async function createPlanTemplate(
  supabase: SupabaseClient,
  userId: string,
  draft: PlanTemplateDraft,
): Promise<{ template: PlanTemplate | null; error: string | null }> {
  const validationError = validatePlanTemplate(draft);
  if (validationError) return { template: null, error: validationError };

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      name: draft.name.trim(),
      day_count: draft.dayCount,
      slots: draft.slots,
    })
    .select("id, user_id, name, day_count, slots, created_at, updated_at")
    .single();

  if (error) {
    // Friendlier message for the unique-name violation.
    if (error.code === "23505") {
      return { template: null, error: "A template with that name already exists." };
    }
    return { template: null, error: error.message };
  }
  return { template: rowToTemplate(data as DbRow), error: null };
}

export async function deletePlanTemplate(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("id", templateId);
  return { error: error?.message ?? null };
}
