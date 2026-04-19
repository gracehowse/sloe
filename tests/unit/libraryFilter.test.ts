/**
 * Library composer tests — F-7 (TestFlight `AO2jdncS2GxyJaeXPPFR30M`,
 * 2026-04-18).
 *
 * Pins the behaviour contract shared by
 *   - web  `src/context/AppDataContext.tsx#savedRecipesForLibrary`
 *   - mobile `apps/mobile/lib/recipes.ts#useSavedLibraryRecipes`
 * via the pure helper `src/lib/recipes/composeLibraryEntries.ts`.
 *
 * What this protects:
 *   1. Saved recipes appear in Library with `isSaved: true`.
 *   2. Recipes authored by the current user appear in Library even
 *      when they are NOT in `saves` — with `isSaved: false` so the
 *      bookmark icon stays honest.
 *   3. Unsaving an imported / created recipe does NOT remove it from
 *      Library (the regression the tester reported).
 *   4. Saving a community recipe then unsaving it DOES remove it from
 *      Library (you never "owned" it).
 *   5. Orphan saves (recipe was deleted) drop silently — no
 *      "Unavailable" card synthesised.
 *   6. Dedupe: saving your own recipe doesn't show it twice.
 *   7. Order: saves first (save-date desc), then author-owned rows
 *      not in saves (created-date desc).
 */
import { describe, expect, it } from "vitest";
import { composeLibraryEntries } from "../../src/lib/recipes/composeLibraryEntries";
import type { RecipeCard } from "../../src/types/recipe";

function mk(partial: Partial<RecipeCard> & { id: string }): RecipeCard {
  return {
    id: partial.id,
    creatorName: partial.creatorName ?? "You",
    creatorImage: partial.creatorImage ?? "avatar.jpg",
    title: partial.title ?? `Recipe ${partial.id}`,
    image: partial.image ?? "img.jpg",
    servings: partial.servings ?? 1,
    calories: partial.calories ?? 100,
    protein: partial.protein ?? 10,
    carbs: partial.carbs ?? 10,
    fat: partial.fat ?? 5,
    isVerified: partial.isVerified ?? false,
    savedCount: partial.savedCount ?? 0,
    isSaved: partial.isSaved ?? false,
    ...partial,
  };
}

const UID = "user-1";

describe("composeLibraryEntries (F-7)", () => {
  it("returns saves with isSaved=true", () => {
    const recipe = mk({ id: "r1", authorId: "someone-else" });
    const entries = composeLibraryEntries({
      userId: UID,
      saves: [{ recipeId: "r1", createdAt: "2026-04-18T10:00:00Z" }],
      authoredRecipes: [],
      communityRecipes: [recipe],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe("r1");
    expect(entries[0]!.isSaved).toBe(true);
  });

  it("includes user-authored recipes even when they are NOT in saves (isSaved=false)", () => {
    const myImport = mk({
      id: "r2",
      authorId: UID,
      sourceUrl: "https://example.com/recipe",
      feedCreatedAt: "2026-04-18T12:00:00Z",
    });
    const entries = composeLibraryEntries({
      userId: UID,
      saves: [],
      authoredRecipes: [myImport],
      communityRecipes: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe("r2");
    expect(entries[0]!.isSaved).toBe(false);
  });

  it("unsaving an imported recipe the user authored keeps it visible with isSaved=false", () => {
    // Tester scenario: user imports a recipe from TikTok → save row
    // is created on import. They then hit the bookmark to "un-save".
    // Previously the entry vanished from Library. Now it should stay
    // because they imported it (authorId === userId).
    const myImport = mk({
      id: "r-tiktok",
      authorId: UID,
      sourceUrl: "https://tiktok.com/@chef/video/123",
      feedCreatedAt: "2026-04-17T08:00:00Z",
    });

    // Before unsave — saved.
    const before = composeLibraryEntries({
      userId: UID,
      saves: [{ recipeId: "r-tiktok", createdAt: "2026-04-17T08:00:00Z" }],
      authoredRecipes: [myImport],
      communityRecipes: [],
    });
    expect(before).toHaveLength(1);
    expect(before[0]!.isSaved).toBe(true);

    // After unsave — still in Library.
    const after = composeLibraryEntries({
      userId: UID,
      saves: [],
      authoredRecipes: [myImport],
      communityRecipes: [],
    });
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe("r-tiktok");
    expect(after[0]!.isSaved).toBe(false);
  });

  it("unsaving a community recipe (someone else's) DOES remove it from Library", () => {
    const discoverRecipe = mk({ id: "r-community", authorId: "other-user" });

    const after = composeLibraryEntries({
      userId: UID,
      saves: [],
      authoredRecipes: [],
      communityRecipes: [discoverRecipe],
    });
    expect(after).toHaveLength(0);
  });

  it("drops orphan saves silently (recipe deleted — no Unavailable card)", () => {
    // F-8 (TestFlight `AAHS7CjeXNC-mwzyLgWFuKQ`): if a save row points
    // at a deleted recipe, it should NOT render as a placeholder card.
    const entries = composeLibraryEntries({
      userId: UID,
      saves: [{ recipeId: "ghost-id", createdAt: "2026-04-10T00:00:00Z" }],
      authoredRecipes: [],
      communityRecipes: [], // no matching row — this is the orphan
    });
    expect(entries).toHaveLength(0);
  });

  it("deduplicates: saving your own recipe shows one entry, not two", () => {
    const mine = mk({
      id: "r-mine",
      authorId: UID,
      feedCreatedAt: "2026-04-01T00:00:00Z",
    });
    const entries = composeLibraryEntries({
      userId: UID,
      saves: [{ recipeId: "r-mine", createdAt: "2026-04-18T15:00:00Z" }],
      authoredRecipes: [mine],
      communityRecipes: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.isSaved).toBe(true);
  });

  it("orders saves first (save-date desc), then author-owned rows not in saves (created-date desc)", () => {
    const saved = mk({ id: "r-saved", authorId: "other-user" });
    const mineOld = mk({
      id: "r-mine-old",
      authorId: UID,
      feedCreatedAt: "2026-04-01T00:00:00Z",
    });
    const mineNew = mk({
      id: "r-mine-new",
      authorId: UID,
      feedCreatedAt: "2026-04-17T00:00:00Z",
    });

    const entries = composeLibraryEntries({
      userId: UID,
      saves: [{ recipeId: "r-saved", createdAt: "2026-04-18T10:00:00Z" }],
      authoredRecipes: [mineNew, mineOld],
      communityRecipes: [saved],
    });

    // Sort is overall by savedAt desc — save at 2026-04-18 (newest),
    // mineNew created 2026-04-17, mineOld created 2026-04-01.
    expect(entries.map((e) => e.id)).toEqual([
      "r-saved",
      "r-mine-new",
      "r-mine-old",
    ]);
    expect(entries[0]!.isSaved).toBe(true);
    expect(entries[1]!.isSaved).toBe(false);
    expect(entries[2]!.isSaved).toBe(false);
  });

  it("an unauthed user sees only explicit saves (no authored union)", () => {
    // If we don't know the user id, we can't safely claim authorship.
    const myImport = mk({
      id: "r-anon",
      authorId: UID,
      feedCreatedAt: "2026-04-17T00:00:00Z",
    });
    const entries = composeLibraryEntries({
      userId: null,
      saves: [],
      authoredRecipes: [myImport],
      communityRecipes: [],
    });
    expect(entries).toHaveLength(0);
  });
});
