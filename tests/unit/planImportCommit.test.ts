/**
 * Shared Plan-Import commit pipeline — ENG-696 (web↔mobile, NOT forked).
 *
 * `commitPlanImport` is the single persistence path both platforms call: the
 * web surface (`src/app/components/PlanImport.tsx`) and the mobile wrapper
 * (`apps/mobile/lib/planImportCommit.ts`) hand it a Supabase client. This test
 * pins the persistence contract against a fake client:
 *
 *   1. importToLibrary=true → every parsed recipe is inserted + saved.
 *   2. importToLibrary=false → only recipes referenced by a slot are persisted.
 *   3. A successful run creates a template and returns a materialised dayPlan.
 *   4. A recipe insert failure aborts and returns { ok:false }.
 *
 * It also pins that the mobile wrapper delegates to this shared module (so the
 * pipeline can't silently diverge per-platform).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const REPO = resolve(__dirname, "../..");

// --- Mock the persistence collaborators the shared module imports. ---
const createTemplateMock = vi.fn();
vi.mock("@/lib/nutrition/planTemplatesClient", () => ({
  createPlanTemplate: (...args: unknown[]) => createTemplateMock(...args),
}));
vi.mock("@/lib/nutrition/planTemplates", () => ({
  applyTemplateToWeek: (t: { id: string }) => [{ day: 0, meals: [], templateId: t.id }],
}));
vi.mock("@/lib/planning/planImport/buildPlanTemplateDraft", () => ({
  buildPlanTemplateDraftFromImport: () => ({ name: "Plan", dayCount: 1, slots: [{ a: 1 }] }),
}));

import { commitPlanImport } from "@/lib/planning/planImport/commitPlanImport";
import type {
  PlanImportCompiledSlot,
  PlanImportVerifiedRecipe,
} from "@/lib/planning/planImport/types";

function makeRecipe(key: string): PlanImportVerifiedRecipe {
  return {
    key,
    title: `Recipe ${key}`,
    serves: 1,
    ingredients: ["oats"],
    supprNutrition: { calories: 400, protein: 20, carbs: 50, fat: 10, fiberG: 8 },
    confidence: "high",
    confidenceTier: "high",
    ingredientCount: 1,
    ingredientMacros: [
      { name: "oats", amount: "50", unit: "g", calories: 400, protein: 20, carbs: 50, fat: 10, fiberG: 8 },
    ],
  };
}

function makeSlot(recipeKeys: string[]): PlanImportCompiledSlot {
  return {
    dayIndex: 0,
    dayLabel: "Mon",
    slot: "Breakfast",
    title: "Breakfast",
    recipeKeys,
    linkStatus: "linked",
    portionMultiplier: 1,
    supprNutrition: { calories: 400, protein: 20, carbs: 50, fat: 10, fiberG: 8 },
    authorNutrition: null,
    claimedKcal: null,
    confidence: "high",
  };
}

/** Minimal Supabase fake — records inserts, returns ids for recipes. */
function makeFakeSupabase(opts: { failRecipeInsert?: boolean } = {}) {
  const inserts: Record<string, unknown[]> = {};
  let recipeCounter = 0;
  const client = {
    from(table: string) {
      return {
        insert(rows: unknown) {
          (inserts[table] ??= []).push(rows);
          if (table === "recipes") {
            return {
              select: () => ({
                single: () =>
                  opts.failRecipeInsert
                    ? Promise.resolve({ data: null, error: { message: "boom", code: "23505" } })
                    : Promise.resolve({ data: { id: `recipe-${++recipeCounter}` }, error: null }),
              }),
            };
          }
          return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
  };
  return { client: client as never, inserts };
}

beforeEach(() => {
  createTemplateMock.mockReset();
  createTemplateMock.mockResolvedValue({ template: { id: "tmpl-1" }, error: null });
});

describe("commitPlanImport (shared pipeline)", () => {
  it("imports every recipe to library when importToLibrary=true", async () => {
    const { client, inserts } = makeFakeSupabase();
    const res = await commitPlanImport({
      supabase: client,
      userId: "user-1",
      planName: "Plan",
      recipes: [makeRecipe("a"), makeRecipe("b")],
      slots: [makeSlot(["a"])],
      nutritionMode: "match",
      importToLibrary: true,
    });
    expect(res.ok).toBe(true);
    // Both recipes persisted even though only "a" is scheduled.
    expect(inserts["recipes"]).toHaveLength(2);
    expect(inserts["saves"]).toHaveLength(2);
    if (res.ok) {
      expect(res.dayPlan).toEqual([{ day: 0, meals: [], templateId: "tmpl-1" }]);
    }
  });

  it("persists only scheduled recipes when importToLibrary=false", async () => {
    const { client, inserts } = makeFakeSupabase();
    const res = await commitPlanImport({
      supabase: client,
      userId: "user-1",
      planName: "Plan",
      recipes: [makeRecipe("a"), makeRecipe("b")], // only "a" is in a slot
      slots: [makeSlot(["a"])],
      nutritionMode: "match",
      importToLibrary: false,
    });
    expect(res.ok).toBe(true);
    expect(inserts["recipes"]).toHaveLength(1);
  });

  it("aborts with { ok:false } when a recipe insert fails", async () => {
    const { client } = makeFakeSupabase({ failRecipeInsert: true });
    const res = await commitPlanImport({
      supabase: client,
      userId: "user-1",
      planName: "Plan",
      recipes: [makeRecipe("a")],
      slots: [makeSlot(["a"])],
      nutritionMode: "match",
      importToLibrary: true,
    });
    expect(res.ok).toBe(false);
    expect(createTemplateMock).not.toHaveBeenCalled();
  });

  it("mobile wrapper delegates to the shared module (pipeline not forked)", () => {
    const wrapper = readFileSync(resolve(REPO, "apps/mobile/lib/planImportCommit.ts"), "utf8");
    expect(wrapper).toContain("@suppr/shared/planning/planImport/commitPlanImport");
    expect(wrapper).toMatch(/commitPlanImportShared\(\{\s*supabase/);
    // The persistence body must NOT live in the mobile wrapper anymore.
    expect(wrapper).not.toContain('.from("recipes")');
  });
});
