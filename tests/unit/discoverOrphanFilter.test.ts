/**
 * Orphan-save filter tests — F-8 (TestFlight `AAHS7CjeXNC-mwzyLgWFuKQ`,
 * 2026-04-18).
 *
 * The tester reported Library / Discover "defaults to recipes that
 * don't exist". Root cause: `saves.recipe_id` is not an FK cascade on
 * all historical projects, so deleting a recipe can leave orphan save
 * rows pointing at a UUID the recipes table no longer knows about.
 * The old web fallback rendered those as "Unavailable" cards; the
 * tester saw them as broken/fake recipes.
 *
 * `filterOrphanSaves` partitions save IDs into `{ validIds, orphanIds }`
 * so the loader can drop orphans from local state and clean up the
 * server-side rows. This file pins the partitioning contract.
 *
 * Graceful fallback guarantee:
 *   - When *all* save IDs are orphans, `validIds` is empty — the
 *     library falls back to the union-with-authored-recipes path,
 *     which on a brand-new account with no authored rows is an empty
 *     state. The Discover feed itself queries `recipes` live
 *     (`refreshDiscoverRecipes` on web / `useDiscoverRecipes` on
 *     mobile) so deleted rows are never returned in the first place —
 *     no separate "dead seed → fall back to recent" path is needed.
 */
import { describe, expect, it } from "vitest";
import { filterOrphanSaves } from "../../src/lib/recipes/filterOrphanSaves";

describe("filterOrphanSaves (F-8)", () => {
  it("returns all save IDs as valid when every save has a live recipe", () => {
    const r = filterOrphanSaves(["a", "b", "c"], ["a", "b", "c", "d"]);
    expect(r.validIds).toEqual(["a", "b", "c"]);
    expect(r.orphanIds).toEqual([]);
  });

  it("flags save IDs whose recipe has been deleted as orphans", () => {
    const r = filterOrphanSaves(["alive", "ghost"], ["alive"]);
    expect(r.validIds).toEqual(["alive"]);
    expect(r.orphanIds).toEqual(["ghost"]);
  });

  it("when every save references a deleted recipe, all are orphans (validIds empty)", () => {
    // This is the "fall back" scenario called out in F-8 — the loader
    // uses this to short-circuit to an empty library rather than
    // render synthetic cards, and the Discover feed itself falls back
    // to whatever is still `published=true` via its own query.
    const r = filterOrphanSaves(["dead1", "dead2", "dead3"], ["unrelated"]);
    expect(r.validIds).toEqual([]);
    expect(r.orphanIds).toEqual(["dead1", "dead2", "dead3"]);
  });

  it("preserves save-order within each partition (stable partition)", () => {
    // The library relies on save-date-desc ordering; the filter must
    // not reshuffle the input.
    const r = filterOrphanSaves(
      ["newest", "dead", "mid", "dead2", "oldest"],
      ["oldest", "mid", "newest"],
    );
    expect(r.validIds).toEqual(["newest", "mid", "oldest"]);
    expect(r.orphanIds).toEqual(["dead", "dead2"]);
  });

  it("handles empty input without throwing", () => {
    const r = filterOrphanSaves([], []);
    expect(r.validIds).toEqual([]);
    expect(r.orphanIds).toEqual([]);
  });

  it("treats duplicate save IDs independently (doesn't collapse them)", () => {
    // Unlikely in practice (unique index on (user_id, recipe_id) on
    // most schemas) but pin the behaviour: the filter is a straight
    // partition, not a dedupe.
    const r = filterOrphanSaves(["same", "same", "ghost"], ["same"]);
    expect(r.validIds).toEqual(["same", "same"]);
    expect(r.orphanIds).toEqual(["ghost"]);
  });
});
