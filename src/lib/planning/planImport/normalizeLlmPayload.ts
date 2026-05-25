import type {
  PlanImportLlmPayload,
  PlanImportParsedRecipe,
  PlanImportScheduleDay,
  PlanImportScheduleSlot,
} from "./types.ts";

function slugKey(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `recipe-${index + 1}`;
}

function normSlot(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("break")) return "Breakfast";
  if (s.startsWith("lunch")) return "Lunch";
  if (s.startsWith("din")) return "Dinner";
  if (s.startsWith("snack") || s.startsWith("snk")) return "Snacks";
  const t = raw.trim();
  return t.length ? t[0]!.toUpperCase() + t.slice(1) : "Lunch";
}

function normRecipe(raw: unknown, index: number): PlanImportParsedRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = String(r.title ?? r.name ?? "").trim();
  if (!title) return null;
  const key = String(r.key ?? slugKey(title, index)).trim() || slugKey(title, index);
  const ingredientsRaw = r.ingredients;
  const ingredients = Array.isArray(ingredientsRaw)
    ? ingredientsRaw.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const servesRaw = r.serves ?? r.servings;
  const serves =
    typeof servesRaw === "number" && Number.isFinite(servesRaw) && servesRaw > 0
      ? Math.round(servesRaw)
      : 1;
  const authorRaw = r.authorNutrition ?? r.nutrition ?? r.author_nutrition;
  let authorNutrition = null;
  if (authorRaw && typeof authorRaw === "object") {
    const a = authorRaw as Record<string, unknown>;
    authorNutrition = {
      calories: numOrNull(a.calories ?? a.kcal),
      protein: numOrNull(a.protein ?? a.proteinG),
      carbs: numOrNull(a.carbs ?? a.carbsG),
      fat: numOrNull(a.fat ?? a.fatG),
      fiberG: numOrNull(a.fiberG ?? a.fibreG ?? a.fiber),
    };
  }
  return {
    key,
    title,
    serves,
    ingredients,
    method: typeof r.method === "string" ? r.method.trim() : null,
    authorNutrition,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normScheduleSlot(raw: unknown): PlanImportScheduleSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const label = String(s.label ?? s.title ?? s.meal ?? "").trim();
  if (!label) return null;
  const slot = normSlot(String(s.slot ?? s.mealSlot ?? "Lunch"));
  const keysRaw = s.recipeKeys ?? s.recipe_keys ?? s.recipes;
  let recipeKeys: string[] = [];
  if (Array.isArray(keysRaw)) {
    recipeKeys = keysRaw.map((k) => String(k).trim()).filter(Boolean);
  } else if (typeof keysRaw === "string" && keysRaw.trim()) {
    recipeKeys = [keysRaw.trim()];
  }
  const portionRaw = s.portionMultiplier ?? s.portion_multiplier;
  const portionMultiplier =
    typeof portionRaw === "number" && portionRaw > 0 ? portionRaw : 1;
  return {
    slot,
    label,
    recipeKeys,
    portionMultiplier,
    claimedKcal: numOrNull(s.claimedKcal ?? s.claimed_kcal ?? s.kcal),
  };
}

function normScheduleDay(raw: unknown, index: number): PlanImportScheduleDay | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const dayLabel = String(d.dayLabel ?? d.day_label ?? d.label ?? `Day ${index + 1}`).trim();
  const dayIndexRaw = d.dayIndex ?? d.day_index ?? index;
  const dayIndex =
    typeof dayIndexRaw === "number" && Number.isInteger(dayIndexRaw) && dayIndexRaw >= 0
      ? dayIndexRaw
      : index;
  const slotsRaw = d.slots ?? d.meals;
  const slots = Array.isArray(slotsRaw)
    ? slotsRaw.map(normScheduleSlot).filter((x): x is PlanImportScheduleSlot => x != null)
    : [];
  if (slots.length === 0) return null;
  return { dayLabel, dayIndex, slots };
}

/** Coerce arbitrary LLM JSON into a stable internal shape. */
export function normalizeLlmPayload(raw: unknown): PlanImportLlmPayload {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const planName =
    typeof root.planName === "string"
      ? root.planName.trim()
      : typeof root.plan_name === "string"
        ? root.plan_name.trim()
        : null;
  const recipesRaw = root.recipes;
  const recipes = Array.isArray(recipesRaw)
    ? recipesRaw
        .map((r, i) => normRecipe(r, i))
        .filter((x): x is PlanImportParsedRecipe => x != null)
    : [];
  const scheduleRaw = root.schedule ?? root.days;
  const schedule = Array.isArray(scheduleRaw)
    ? scheduleRaw
        .map((d, i) => normScheduleDay(d, i))
        .filter((x): x is PlanImportScheduleDay => x != null)
    : [];
  return { planName, recipes, schedule };
}
