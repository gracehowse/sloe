export type UserTier = "free" | "base" | "pro";

/**
 * Normalise a raw `profiles.user_tier` string into the app-facing `UserTier`.
 *
 * `lifetime_pro` is the durable founding-cohort comp (ENG-1043 / monetisation
 * sequencing §1). It gates identically to `pro` everywhere, so it is collapsed
 * to `"pro"` here at the single point where the raw DB string enters app state —
 * every downstream `userTier === "pro"` gate then covers lifetime founders
 * without per-site branching. Any unrecognised value falls back to `"free"`.
 */
export function normaliseTier(raw: string | null | undefined): UserTier {
  if (raw === "pro" || raw === "lifetime_pro") return "pro";
  if (raw === "base") return "base";
  return "free";
}

/** How a recipe ended up in your library (local + synced metadata). */
export type LibraryEntryKind = "saved" | "created" | "imported";

/** Planner meal slots (order matches UI: breakfast → lunch → snacks → dinner). */
export const PLANNER_MEAL_SLOT_LABELS = ["Breakfast", "Lunch", "Snacks", "Dinner"] as const;
export type PlannerMealSlot = (typeof PLANNER_MEAL_SLOT_LABELS)[number];

export interface RecipeCard {
  id: string;
  creatorName: string;
  creatorImage: string;
  title: string;
  image: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  isVerified: boolean;
  creatorCalories?: number;
  savedCount: number;
  isSaved: boolean;
  /** Whether this recipe is publicly visible. Undefined for catalog / legacy objects. */
  isPublished?: boolean;
  /** ISO timestamp for feed ordering (uploaded recipes). Catalog demos omit this. */
  feedCreatedAt?: string;
  /** `community` = published by a creator; `catalog` = curated picks (not a live creator post). */
  feedSource?: "community" | "catalog";
  /** Recipe author id when loaded from the community feed — used for follows / Following feed. */
  authorId?: string | null;
  /** Optional legacy `creators` row linked from recipes.creator_id. */
  creatorId?: string | null;
  /**
   * Which planner slots this recipe is intended for. Used when generating plans and Swap.
   * Omit for legacy data — treated as fitting any slot.
   */
  mealSlots?: readonly PlannerMealSlot[];
  /** Platform the recipe was imported from (social import feature). */
  sourcePlatform?: "instagram" | "tiktok" | "youtube" | "pinterest" | "web" | "user";
  /**
   * Original source URL when the recipe was imported from a link. Used
   * to distinguish "imported" vs "created" drafts in Library (F-7,
   * 2026-04-18). Parity with mobile `RecipeCard.sourceUrl`.
   */
  sourceUrl?: string | null;
  /**
   * Human attribution for an imported recipe (creator handle / site name).
   * Parity with mobile `recipe.source_name`. Used by the import source-card
   * disclaimer (ENG-858) to name the non-endorsement clause.
   */
  sourceName?: string | null;
  /** Human-readable prep time (e.g. "15 min"). */
  prepTime?: string;
  /** Human-readable cook time (e.g. "30 min"). */
  cookTime?: string;
  /** Raw minutes from DB — used for Quick filters when set. */
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  /**
   * T12 (2026-04-24) — regulated allergens inferred at import / verify time.
   * Canonical slugs from `src/constants/regulatedAllergens.ts` (EU FIC + FDA).
   * Empty array means NOT TAGGED, not SAFE — UIs must pair any
   * "Contains: …" chip with a "verify ingredients" caveat per DI-P0-01.
   */
  allergens?: readonly string[];
  /**
   * GW-02 (2026-04-28) — dietary preset tags from `recipes.dietary_flags`
   * (jsonb). Values include `"vegan" | "vegetarian" | "gluten-free" |
   * "dairy-free" | "high-protein" | "keto" | "paleo" | "low-fodmap"`.
   * Used by the Library Vegetarian filter as the primary signal
   * (title-keyword heuristic falls behind this when present).
   */
  dietaryFlags?: readonly string[];
}

/**
 * Optional per-ingredient manual override (Batch 2.7).
 * When set, these values take precedence over the matched-source macros
 * when computing recipe totals. Persisted as `recipe_ingredients.override_macros`.
 */
export interface IngredientOverride {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface IngredientRow {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  isVerified: boolean;
  source: string;
  /** Batch 2.7 — manual macro override. Replaces matched macros in totals when present. */
  overrideMacros?: IngredientOverride;
  /** Batch 2.7 — true when the user added this row post-import (not parsed by the importer). */
  addedByUser?: boolean;
  /**
   * GW-08 P2 (audit 2026-04-28) — real per-ingredient match confidence
   * (0..1). Persisted on `recipe_ingredients.confidence` (added by
   * migration `20260408143000_add_verified_nutrition_micros.sql`).
   * Pre-fix the load path discarded this column and synthesised a
   * value from `is_verified`; the synthesis made VR-01's confidence
   * gate circular. Now hydrated from the persisted column with a
   * legacy fallback (0.9 / 0.3) when the column is null.
   */
  confidence?: number | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  from: string;
  /**
   * Honeydew parity (2026-04-30): the userId of the household member
   * that toggled the row last. `null` for solo lists, legacy rows, and
   * anything that hasn't been checked yet. Surfaced as a coloured
   * initials chip on multi-member household lists.
   */
  checkedBy?: string | null;
}

export interface LoggedMeal {
  id: string;
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * How many "plates" / people this log represents (1 = solo, 2 = shared dinner, etc.).
   * Macros on the row are already scaled; this is for display and analytics.
   */
  portionMultiplier?: number;
  /** Optional fiber logged with this entry (grams). */
  fiberG?: number;
  /** Optional water logged with this entry (ml). */
  waterMl?: number;
  /** Optional micronutrients (e.g. sugarG, sodiumMg from Health import). */
  micros?: Record<string, number> | null;
  /** Optional provenance for confidence badges (USDA, Open Food Facts, AI photo, etc.). */
  source?: string | null;
  /**
   * Schema refactor Phase 2 (2026-05-11) — typed FK to `recipes.id`.
   * When set, the row's `nutrition_entries.recipe_id` column carries
   * this id so journal entries can be reverse-linked to a recipe (and
   * auto-NULLed if the recipe is later deleted, per the FK SET NULL).
   * Optional because Health-import / manual-entry / barcode-only logs
   * don't have a recipe id in scope.
   */
  recipeId?: string;
  /** Optional hero image when logged from a recipe or branded search hit. */
  recipeImageUrl?: string | null;
  imageUrl?: string | null;
  /** ISO timestamp when the entry was logged (journal sort / recency). */
  createdAt?: string;
  /** ENG-772 — when the user ate this entry (`nutrition_entries.eaten_at`). */
  eatenAt?: string | null;
}

export interface DayPlanMeal {
  name: string;
  recipeTitle: string;
  /** Optional recipe id — surfaced by newer planners for stable navigation and leftover math. */
  recipeId?: string;
  /** Base recipe macros for one portion (multiplier 1). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional fiber (grams) so leftovers can carry it through. */
  fiberG?: number;
  /**
   * Scale for this slot (1 = one serving as above, 2 = double / partner, etc.).
   * Day totals and shopping list use base macros × this value.
   */
  portionMultiplier?: number;
  /** True when no saved recipes exist for this slot (should not appear after macro-aware generation). */
  isPlaceholder?: boolean;
  /**
   * Batch 3.10 — when set, this slot is a leftover portion of the named parent
   * recipe id. Macros equal the parent's scaled macros; the flag is purely
   * visual. When the user swaps the parent, any downstream leftovers with a
   * matching `leftoverOf` are cleared.
   */
  leftoverOf?: string;
  /** Batch 3.10 — visual-only companion to `leftoverOf`. Set together. */
  isLeftover?: boolean;
  /**
   * P1-19 (2026-04-25): true when the recipe's macros were synthesized
   * by `coerceMacrosWhenCaloriesButNoGrams` (kcal known, P/C/F unknown
   * → neutral 28/42/30 split). The journal-write paths refuse rows with
   * this flag (see `nutrition-approximation-policy.md` §A1); the
   * planner UI surfaces an "Estimated · verify" chip on the row.
   */
  macrosAreEstimated?: boolean;
}

export interface DayPlan {
  day: number;
  meals: DayPlanMeal[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG?: number;
  };
  /**
   * F-15 — grams of protein below the day target after the joint-fit
   * scaler ran. Negative grams (e.g. `-25` = 25g under). Undefined /
   * 0 when the scaler closed the gap. Day card surfaces the hint only
   * when `residualProteinGap < -10`.
   */
  residualProteinGap?: number;
}
