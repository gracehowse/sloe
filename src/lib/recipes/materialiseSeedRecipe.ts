/**
 * materialiseSeedRecipe — copy-on-save for the static Discover seed
 * catalogue (ENG-1467).
 *
 * The `seedRecipesV2` catalogue is presentational, in-app static content
 * (see the module doc there) — its rows are never written to the
 * `recipes` table, so their ids (`seed-v2-{cluster}-{slug}`) are plain
 * slugs, not UUIDs. Every save path (`toggleSave` on mobile,
 * `toggleSaveRecipe` on web) ultimately writes to the `saves` table,
 * whose `recipe_id` column is a `uuid` foreign key into `recipes` — so
 * saving a seed recipe directly threw
 * `invalid input syntax for type uuid` (console-only, the primary CTA
 * on Discover silently failing for every fresh user).
 *
 * Fix: when the id being saved is not a UUID, materialise it as a real,
 * private `recipes` row first (fresh UUID, `content_origin:
 * "first_party"`, `published: false`, `author_id` = the saving user —
 * required by the `recipes_insert_own` RLS policy, which checks
 * `auth.uid() = author_id` on every INSERT), carrying the seed's title/
 * macros/ingredients/steps across so the row is immediately full-featured
 * (loggable, plannable, editable) rather than a stub. Provenance is kept
 * via `source_name = "Suppr Kitchen"` (matches the seed's own
 * `attribution.author`) with `source_url: null` — this is first-party
 * content per `docs/decisions/2026-04-27-onboarding-seed-copyright-review.md`,
 * not an external import, so there is no source link to preserve.
 *
 * Idempotency: unlike `persistImportedRecipe.ts`'s `source_url` unique
 * index (ENG-1306, scoped to `content_origin = 'imported_stub'`), there
 * is no DB-level uniqueness guard for first-party rows — adding one is
 * out of scope for this bounded fix. Instead this does a check-then-insert
 * keyed on (`author_id`, `title`, `content_origin = 'first_party'`,
 * `source_name = 'Suppr Kitchen'`); every seed title in the catalogue is
 * unique (pinned by the "seed titles are unique" assertion in this
 * module's test), so a title match reliably means "this user already
 * has their own copy of this exact seed" and the existing row is reused
 * instead of inserting a duplicate. A same-title race (double-tap save)
 * can still slip through as a rare, harmless duplicate row — same risk
 * profile import-save carried before ENG-1306 added its index; revisit
 * with a dedicated unique index if this becomes a real support signal.
 *
 * Cross-platform: takes a generic `SupabaseClient` so both the mobile
 * `useSavedRecipes().toggleSave` (`apps/mobile/lib/recipes.ts`) and the
 * web `toggleSaveRecipe` (`src/context/AppDataContext.tsx`) call the SAME
 * function — no per-platform drift on the copy-on-save shape, mirroring
 * `persistImportedRecipe.ts`'s existing cross-platform pattern.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeedRecipe } from "./seedRecipesV2";
import { findSeedRecipeById, SEED_RECIPES_V2 } from "./seedRecipesV2";
import { IMPORT_ERROR_COPY, mapPersistenceError } from "./importErrorCopy";

/** Suppr-owned first-party provenance label — matches every seed's
 *  `attribution.author` in `seedRecipesV2.ts`. */
const SEED_SOURCE_NAME = "Suppr Kitchen";

/**
 * RFC-4122-shaped UUID check (any version/variant — Postgres `uuid`
 * columns accept all of them). Anything that fails this is NOT a real
 * `recipes.id`, whatever catalogue it came from.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | null | undefined): boolean {
  return typeof id === "string" && UUID_RE.test(id);
}

/**
 * Look up a user's already-materialised copy of a seed by title. Returns
 * null on any lookup error (treat as "not found" — the insert path below
 * still has its own error surfacing if something is actually broken).
 */
async function findExistingMaterialisedCopy(
  supabase: SupabaseClient,
  userId: string,
  title: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("recipes")
    .select("id")
    .eq("author_id", userId)
    .eq("title", title)
    .eq("content_origin", "first_party")
    .eq("source_name", SEED_SOURCE_NAME)
    .limit(1)
    .maybeSingle();
  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export type MaterialiseSeedResult =
  | { ok: true; recipeId: string }
  | { ok: false; error: string };

/**
 * Reconstruct the seed-id -> materialised-recipe-id map for a user in
 * ONE query, so callers (the save-state hooks on load/refresh) can
 * render "is this seed saved?" correctly without an N-query title match
 * per seed. Title -> seed-id reverse lookup relies on the same
 * uniqueness the per-save idempotency check does (every seed title in
 * `SEED_RECIPES_V2` is unique).
 */
export async function fetchMaterialisedSeedMap(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("author_id", userId)
    .eq("content_origin", "first_party")
    .eq("source_name", SEED_SOURCE_NAME);
  if (error || !data) return {};

  const titleToSeedId = new Map<string, string>();
  for (const seed of SEED_RECIPES_V2) titleToSeedId.set(seed.title, seed.id);

  const map: Record<string, string> = {};
  for (const row of data as { id: string; title: string }[]) {
    const seedId = titleToSeedId.get(row.title);
    if (seedId) map[seedId] = row.id;
  }
  return map;
}

/**
 * Materialise a seed catalogue recipe into a real, private `recipes` row
 * owned by `userId`. Idempotent per-user (see module doc). Does NOT
 * insert into `saves` — the caller's normal save flow does that with
 * this function's returned `recipeId` in place of the original slug id.
 */
export async function materialiseSeedRecipe(
  supabase: SupabaseClient,
  userId: string,
  seed: SeedRecipe,
): Promise<MaterialiseSeedResult> {
  const existingId = await findExistingMaterialisedCopy(supabase, userId, seed.title);
  if (existingId) return { ok: true, recipeId: existingId };

  const instructions = seed.steps.join("\n");

  const { data: inserted, error: insErr } = await supabase
    .from("recipes")
    .insert({
      author_id: userId,
      title: seed.title,
      description: seed.shortDescription ?? null,
      instructions,
      image_url: seed.heroImageUrl,
      servings: seed.servings,
      prep_time_min: seed.prepTimeMin > 0 ? seed.prepTimeMin : null,
      cook_time_min: seed.cookTimeMin > 0 ? seed.cookTimeMin : null,
      dietary: seed.tags ?? [],
      published: false,
      content_origin: "first_party",
      source_name: SEED_SOURCE_NAME,
      source_url: null,
      calories: Math.round(seed.kcalPerPortion),
      protein: Math.round(seed.proteinG),
      carbs: Math.round(seed.carbsG),
      fat: Math.round(seed.fatG),
      fiber_g: Math.round(seed.fiberG),
      sugar_g: 0,
      sodium_mg: 0,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    // Same race window persistImportedRecipe guards with a unique index;
    // we have none here (see module doc), but a 23505 can still surface
    // from an unrelated constraint — recover the same way if possible.
    if ((insErr as { code?: string } | null)?.code === "23505") {
      const recovered = await findExistingMaterialisedCopy(supabase, userId, seed.title);
      if (recovered) return { ok: true, recipeId: recovered };
    }
    console.error(
      "[materialiseSeedRecipe] recipe insert failed:",
      insErr?.message ?? "no row returned",
      "| seedId:",
      seed.id,
    );
    return { ok: false, error: IMPORT_ERROR_COPY[mapPersistenceError(insErr ?? null)] };
  }

  const recipeId = (inserted as { id: string }).id;

  const ingredientRows = seed.ingredients.map((ing) => ({
    recipe_id: recipeId,
    name: ing.name,
    amount: ing.grams,
    unit: "g",
    // Recipe-level totals are the seed's authored estimate (see the
    // module doc in seedRecipesV2.ts); per-ingredient macros are not
    // part of the seed shape, so ingredient rows carry name + grams
    // only. Logging from the materialised recipe still runs through the
    // standard ingredient-matching pipeline at log time — unchanged
    // from the seed's pre-save behaviour.
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    is_verified: false,
    source: "seed_catalogue",
  }));

  if (ingredientRows.length > 0) {
    const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingredientRows);
    if (ingErr) {
      console.error(
        "[materialiseSeedRecipe] ingredient insert failed, rolling back recipe:",
        ingErr.message,
        "| seedId:",
        seed.id,
      );
      try {
        const { error: rbErr } = await supabase.from("recipes").delete().eq("id", recipeId);
        if (rbErr) {
          console.error(
            "[materialiseSeedRecipe] rollback delete failed (orphan recipe row):",
            rbErr.message,
            "| recipeId:",
            recipeId,
          );
        }
      } catch (rbCaught) {
        console.error(
          "[materialiseSeedRecipe] rollback delete threw (orphan recipe row):",
          rbCaught instanceof Error ? rbCaught.message : rbCaught,
          "| recipeId:",
          recipeId,
        );
      }
      return { ok: false, error: IMPORT_ERROR_COPY[mapPersistenceError(ingErr)] };
    }
  }

  return { ok: true, recipeId };
}

/**
 * Convenience wrapper: resolve a seed by id and materialise it. Returns
 * a distinct "not found" shape when the id doesn't match any known seed
 * (defensive — should be unreachable from the normal Discover → save
 * flow, since callers only reach this after `isUuid(id)` fails).
 */
export async function materialiseSeedRecipeById(
  supabase: SupabaseClient,
  userId: string,
  seedId: string,
): Promise<MaterialiseSeedResult> {
  const seed = findSeedRecipeById(seedId);
  if (!seed) {
    console.error("[materialiseSeedRecipe] no catalogue entry for id:", seedId);
    return { ok: false, error: IMPORT_ERROR_COPY.save_failed };
  }
  return materialiseSeedRecipe(supabase, userId, seed);
}
