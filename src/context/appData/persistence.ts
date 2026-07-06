import { normalizeDayPlans } from "../../lib/nutrition/portionMultiplier.ts";
import type { DayPlan, LibraryEntryKind, LoggedMeal, ShoppingItem } from "../../types/recipe.ts";
import { DEFAULT_MACRO_TARGETS, normalizeMacroTargets, type MacroTargets } from "../../types/profile.ts";
import { DEFAULT_NOTIFICATION_PREFS, type AppNotification, type NotificationPrefs } from "../../types/notifications.ts";

export const STORAGE_KEY = "suppr-app-v1";

/** Default slot id for users without `mealPlanSlots` in localStorage yet. */
export const DEFAULT_MEAL_PLAN_SLOT_ID = "plan-slot-default";

/**
 * ENG-1446 — one-time migration constants for the retired `defaultSnapshot()`
 * demo fixtures. An existing real user whose localStorage snapshot was
 * written before this fix will still have these literal rows persisted
 * (they were seeded on first load, then carried forward by every
 * `loadSnapshot()` merge since). Strip them here so they disappear on next
 * load instead of resurfacing forever. IDs are distinctive enough to match
 * on their own ("seed-breakfast"/"seed-lunch" are not a format any real
 * logged meal uses), but the fixture shopping-item ids ("1".."9") are bare
 * digit strings — real shopping items are keyed by
 * `normalizeIngredientNameKey|unit` (see `shoppingMergeKey` in
 * `lib/planning/generateShoppingList.ts`), which never produces a bare
 * digit, so a name+id match is already safe. Belt-and-braces: also require
 * the fixture's exact `from` value so a same-id real row is never dropped.
 */
const SEED_MEAL_IDS: ReadonlySet<string> = new Set(["seed-breakfast", "seed-lunch"]);

/** The two fixed demo-recipe UUIDs `defaultSnapshot()` used to seed into
 *  `savedRecipeIds` (same historical `supabase/seed.sql` rows as
 *  `scripts/delete-seeded-recipes.ts`'s `DEMO_RECIPE_IDS`). UUIDs, so no
 *  bare-id collision risk — safe to match on their own. */
const SEED_SAVED_RECIPE_IDS: ReadonlySet<string> = new Set([
  "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "dddddddd-dddd-dddd-dddd-dddddddddddd",
]);

const SEED_SHOPPING_ITEMS: ReadonlySet<string> = new Set(
  [
    ["1", "Chicken Breast", "High-Protein Chicken Bowl"],
    ["2", "Brown Rice", "High-Protein Chicken Bowl"],
    ["3", "Broccoli", "High-Protein Chicken Bowl"],
    ["4", "Rolled Oats", "Overnight Protein Oats"],
    ["5", "Protein Powder", "Overnight Protein Oats"],
    ["6", "Almond Milk", "Overnight Protein Oats"],
    ["7", "Salmon Fillet", "Grilled Salmon"],
    ["8", "Sweet Potato", "Grilled Salmon"],
    ["9", "Olive Oil", "Multiple recipes"],
  ].map(([id, name, from]) => `${id} ${name} ${from}`),
);

function isSeedShoppingItem(item: ShoppingItem): boolean {
  return SEED_SHOPPING_ITEMS.has(`${item.id} ${item.name} ${item.from ?? ""}`);
}

export type MealPlanNamedSlot = {
  id: string;
  name: string;
  plan: DayPlan[] | null;
};

function normalizeMealPlanSlot(row: unknown): MealPlanNamedSlot | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Partial<MealPlanNamedSlot>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Plan";
  let plan: DayPlan[] | null = null;
  if (o.plan === null) plan = null;
  else if (Array.isArray(o.plan)) plan = normalizeDayPlans(o.plan) ?? null;
  return { id: o.id.trim(), name, plan };
}

export interface PersistedSnapshot {
  savedRecipeIds: string[];
  savedAtById: Record<string, string>;
  /** Cached card metadata so saved recipes can be shown even if unpublished later. */
  savedRecipeMetaById?: Record<
    string,
    {
      title: string;
      image?: string | null;
      creatorName?: string | null;
      creatorImage?: string | null;
      calories?: number | null;
      protein?: number | null;
      carbs?: number | null;
      fat?: number | null;
    }
  >;
  shoppingItems: ShoppingItem[];
  /** Fingerprint of meal plan when shopping list was last built from plan (`fingerprintMealPlanForShopping`). */
  shoppingListSourceFingerprint?: string | null;
  /** ENG-1135 — plan week start date when list was generated. */
  shoppingListPlanStartDate?: string | null;
  /** ENG-1051 — pantry suppress-list. */
  pantryStaples?: readonly string[];
  nutritionByDay: Record<string, LoggedMeal[]>;
  mealPlan: DayPlan[] | null;
  /** Named plan slots (active = `activeMealPlanSlotId`). Cloud still syncs active plan JSON only. */
  mealPlanSlots?: MealPlanNamedSlot[];
  activeMealPlanSlotId?: string | null;
  nutritionTargets: MacroTargets;
  extraWaterByDay?: Record<string, number>;
  /** Default activity burn (kcal) when a day has no explicit entry in `activityBurnByDay`. */
  activityBurnKcal?: number;
  /** Per calendar day (`YYYY-MM-DD`) activity burn when activity-adjusted calories are on. */
  activityBurnByDay?: Record<string, number>;
  /** Per saved recipe id: saved from feed vs your own creation vs imported third-party copy. */
  libraryEntryKindByRecipeId?: Record<string, LibraryEntryKind>;
  /** Notifications shown in the in-app inbox (newest-first). */
  notificationsInbox?: AppNotification[];
  /** User preference toggles for which notifications are generated/shown. */
  notificationPrefs?: NotificationPrefs;
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeLoggedMealRow(m: unknown): LoggedMeal | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Partial<LoggedMeal>;
  if (typeof o.id !== "string") return null;
  return {
    id: o.id,
    name: typeof o.name === "string" ? o.name : "Meal",
    recipeTitle: typeof o.recipeTitle === "string" ? o.recipeTitle : "",
    time: typeof o.time === "string" ? o.time : "",
    calories: Math.max(0, Math.round(Number(o.calories) || 0)),
    protein: Math.max(0, Math.round(Number(o.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(o.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(o.fat) || 0)),
    ...(typeof o.fiberG === "number" && Number.isFinite(o.fiberG) ? { fiberG: Math.max(0, Math.round(o.fiberG)) } : {}),
    ...(typeof o.waterMl === "number" && Number.isFinite(o.waterMl) ? { waterMl: Math.max(0, Math.round(o.waterMl)) } : {}),
    ...(typeof o.portionMultiplier === "number" &&
    Number.isFinite(o.portionMultiplier) &&
    o.portionMultiplier > 0
      ? {
          portionMultiplier: Math.min(8, Math.max(0.5, Math.round(o.portionMultiplier * 2) / 2)),
        }
      : {}),
    ...(typeof o.source === "string" ? { source: o.source } : {}),
    ...(typeof o.recipeId === "string" ? { recipeId: o.recipeId } : {}),
    ...(typeof o.recipeImageUrl === "string" ? { recipeImageUrl: o.recipeImageUrl } : {}),
    ...(typeof o.imageUrl === "string" ? { imageUrl: o.imageUrl } : {}),
    ...(o.micros && typeof o.micros === "object" ? { micros: o.micros as LoggedMeal["micros"] } : {}),
    ...(typeof o.createdAt === "string" ? { createdAt: o.createdAt } : {}),
  };
}

export function defaultSnapshot(): PersistedSnapshot {
  return {
    // ENG-1446 — a fresh account must start empty. `savedRecipeIds` used
    // to hard-code two fixed demo-recipe UUIDs (historical `supabase/
    // seed.sql` rows, see `scripts/delete-seeded-recipes.ts`), which made
    // a brand-new user's library look like they'd already saved two
    // recipes. Genuinely neutral defaults (targets, prefs) still seed
    // below; anything presenting fabricated user *activity* does not.
    savedRecipeIds: [],
    savedAtById: {},
    savedRecipeMetaById: {},
    // ENG-1446 — was 9 hard-coded fixture grocery items ("from: High-
    // Protein Chicken Bowl" / "Overnight Protein Oats" / "Grilled
    // Salmon") implying meals/plans the user never created. The
    // shopping screen already has a real empty state ("Your shopping
    // list builds itself" — `src/app/components/ShoppingList.tsx`), so
    // no code depends on a non-empty default.
    shoppingItems: [],
    // ENG-1446 — was two hard-coded demo meals ("seed-breakfast" /
    // "seed-lunch": Overnight Protein Oats / High-Protein Chicken & Rice
    // Bowl) logged for "today" on every fresh account. A brand-new user
    // must see zero logged meals, not fabricated activity.
    nutritionByDay: {},
    mealPlan: null,
    mealPlanSlots: [{ id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null }],
    activeMealPlanSlotId: DEFAULT_MEAL_PLAN_SLOT_ID,
    nutritionTargets: { ...DEFAULT_MACRO_TARGETS },
    shoppingListSourceFingerprint: null,
    shoppingListPlanStartDate: null,
    pantryStaples: [],
    libraryEntryKindByRecipeId: {},
    notificationsInbox: [],
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
  };
}

export function loadSnapshot(): PersistedSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSnapshot();
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    const base = defaultSnapshot();
    let nutritionByDay = base.nutritionByDay;
    if (parsed.nutritionByDay && typeof parsed.nutritionByDay === "object") {
      const next: Record<string, LoggedMeal[]> = {};
      for (const [k, day] of Object.entries(parsed.nutritionByDay)) {
        if (!Array.isArray(day)) continue;
        // ENG-1446 — one-time migration: drop the retired demo-fixture
        // rows ("seed-breakfast"/"seed-lunch") from any existing user's
        // stored snapshot so they stop resurfacing on every load.
        next[k] = day
          .map((row) => normalizeLoggedMealRow(row))
          .filter((x): x is LoggedMeal => Boolean(x) && !SEED_MEAL_IDS.has(x!.id));
      }
      nutritionByDay = next;
    }
    let mealPlan: DayPlan[] | null = base.mealPlan;
    if (parsed.mealPlan === null) {
      mealPlan = null;
    } else if (Array.isArray(parsed.mealPlan)) {
      mealPlan = normalizeDayPlans(parsed.mealPlan) ?? base.mealPlan;
    }

    let mealPlanSlots: MealPlanNamedSlot[] | undefined;
    let activeMealPlanSlotId: string | undefined;
    if (Array.isArray(parsed.mealPlanSlots)) {
      const slots = parsed.mealPlanSlots
        .map((row) => normalizeMealPlanSlot(row))
        .filter((x): x is MealPlanNamedSlot => Boolean(x));
      if (slots.length > 0) {
        mealPlanSlots = slots;
        activeMealPlanSlotId =
          typeof parsed.activeMealPlanSlotId === "string" &&
          slots.some((s) => s.id === parsed.activeMealPlanSlotId)
            ? parsed.activeMealPlanSlotId
            : slots[0]!.id;
      }
    }
    if (!mealPlanSlots?.length) {
      mealPlanSlots = [{ id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: mealPlan }];
      activeMealPlanSlotId = DEFAULT_MEAL_PLAN_SLOT_ID;
      mealPlan = mealPlanSlots[0]!.plan;
    } else {
      const active = mealPlanSlots.find((s) => s.id === activeMealPlanSlotId) ?? mealPlanSlots[0]!;
      mealPlan = active.plan;
    }

    const notificationsInbox: AppNotification[] = Array.isArray(parsed.notificationsInbox)
      ? (parsed.notificationsInbox as unknown[])
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const o = row as Partial<AppNotification>;
            if (typeof o.id !== "string" || typeof o.kind !== "string" || typeof o.createdAt !== "string") return null;
            return {
              id: o.id,
              kind: o.kind as AppNotification["kind"],
              createdAt: o.createdAt,
              readAt: typeof o.readAt === "string" || o.readAt === null ? (o.readAt ?? null) : null,
              title: typeof o.title === "string" ? o.title : "Update",
              ...(typeof o.body === "string" && o.body.trim() ? { body: o.body } : {}),
              ...(typeof o.recipeId === "string" && o.recipeId.trim() ? { recipeId: o.recipeId } : {}),
            };
          })
          .filter((x): x is AppNotification => Boolean(x))
      : base.notificationsInbox ?? [];

    const notificationPrefs: NotificationPrefs =
      parsed.notificationPrefs && typeof parsed.notificationPrefs === "object"
        ? {
            ...DEFAULT_NOTIFICATION_PREFS,
            ...(parsed.notificationPrefs as Partial<NotificationPrefs>),
          }
        : base.notificationPrefs ?? { ...DEFAULT_NOTIFICATION_PREFS };

    // ENG-1446 — one-time migration: drop the retired demo-fixture saved-
    // recipe ids from any existing user's stored snapshot.
    const savedRecipeIds = Array.isArray(parsed.savedRecipeIds)
      ? parsed.savedRecipeIds.filter((id) => !SEED_SAVED_RECIPE_IDS.has(id))
      : base.savedRecipeIds;

    return {
      savedRecipeIds,
      savedAtById:
        parsed.savedAtById && typeof parsed.savedAtById === "object"
          ? Object.fromEntries(
              Object.entries({ ...base.savedAtById, ...parsed.savedAtById }).filter(
                ([id]) => !SEED_SAVED_RECIPE_IDS.has(id),
              ),
            )
          : base.savedAtById,
      savedRecipeMetaById:
        parsed.savedRecipeMetaById && typeof parsed.savedRecipeMetaById === "object"
          ? { ...base.savedRecipeMetaById, ...(parsed.savedRecipeMetaById as any) }
          : base.savedRecipeMetaById,
      // ENG-1446 — one-time migration: drop the retired demo-fixture
      // shopping items (ids "1".."9", "from" a fixture recipe name) from
      // any existing user's stored snapshot.
      shoppingItems: Array.isArray(parsed.shoppingItems)
        ? parsed.shoppingItems.filter(
            (row): row is ShoppingItem =>
              !(
                row &&
                typeof row === "object" &&
                typeof (row as Partial<ShoppingItem>).id === "string" &&
                typeof (row as Partial<ShoppingItem>).name === "string" &&
                isSeedShoppingItem(row as ShoppingItem)
              ),
          )
        : base.shoppingItems,
      shoppingListSourceFingerprint:
        typeof parsed.shoppingListSourceFingerprint === "string" || parsed.shoppingListSourceFingerprint === null
          ? parsed.shoppingListSourceFingerprint
          : undefined,
      shoppingListPlanStartDate:
        typeof parsed.shoppingListPlanStartDate === "string" || parsed.shoppingListPlanStartDate === null
          ? parsed.shoppingListPlanStartDate
          : undefined,
      pantryStaples: Array.isArray(parsed.pantryStaples)
        ? parsed.pantryStaples.filter((s): s is string => typeof s === "string")
        : undefined,
      nutritionByDay,
      mealPlan,
      mealPlanSlots,
      activeMealPlanSlotId: activeMealPlanSlotId ?? DEFAULT_MEAL_PLAN_SLOT_ID,
      nutritionTargets: normalizeMacroTargets(parsed.nutritionTargets ?? base.nutritionTargets),
      extraWaterByDay:
        parsed.extraWaterByDay && typeof parsed.extraWaterByDay === "object"
          ? parsed.extraWaterByDay
          : undefined,
      activityBurnKcal:
        typeof parsed.activityBurnKcal === "number" && Number.isFinite(parsed.activityBurnKcal)
          ? Math.max(0, Math.round(parsed.activityBurnKcal))
          : undefined,
      activityBurnByDay:
        parsed.activityBurnByDay && typeof parsed.activityBurnByDay === "object"
          ? Object.fromEntries(
              Object.entries(parsed.activityBurnByDay as Record<string, unknown>)
                .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
                .map(([k, v]) => [k, Math.max(0, Math.round(v as number))]),
            )
          : undefined,
      libraryEntryKindByRecipeId:
        parsed.libraryEntryKindByRecipeId && typeof parsed.libraryEntryKindByRecipeId === "object"
          ? { ...base.libraryEntryKindByRecipeId, ...parsed.libraryEntryKindByRecipeId }
          : base.libraryEntryKindByRecipeId,
      notificationsInbox,
      notificationPrefs,
    };
  } catch {
    return defaultSnapshot();
  }
}
