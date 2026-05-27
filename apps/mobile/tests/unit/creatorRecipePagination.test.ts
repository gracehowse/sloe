import { describe, expect, it } from "vitest";
import {
  CREATOR_RECIPES_PAGE_SIZE,
  mergeRecipePage,
  nextPageRange,
  pageHasMore,
} from "@suppr/shared/recipes/creatorRecipePagination";

/**
 * ENG-748 #14 (2026-05-27) — Creator recipe pagination, shared helpers.
 *
 * The mobile creator screen (`apps/mobile/app/creator/[id].tsx`) and the
 * web list component both load the recipe back-catalogue in pages via
 * these helpers. Web behaviour is covered by an integration render test
 * (`tests/unit/creatorRecipeListPagination.test.tsx`); this pins the
 * shared offset / dedupe / has-more contract that mobile relies on, so a
 * regression here breaks BOTH platforms loudly.
 */

type Row = { id: string; title?: string };

describe("creatorRecipePagination — nextPageRange", () => {
  it("returns the first page range from a loaded count of 0", () => {
    expect(nextPageRange(0)).toEqual([0, CREATOR_RECIPES_PAGE_SIZE - 1]);
  });

  it("offsets the next range by the number of rows already loaded", () => {
    expect(nextPageRange(CREATOR_RECIPES_PAGE_SIZE)).toEqual([
      CREATOR_RECIPES_PAGE_SIZE,
      CREATOR_RECIPES_PAGE_SIZE * 2 - 1,
    ]);
  });

  it("never produces a negative `from`", () => {
    expect(nextPageRange(-5)[0]).toBe(0);
  });

  it("honours a custom page size", () => {
    expect(nextPageRange(10, 5)).toEqual([10, 14]);
  });
});

describe("creatorRecipePagination — pageHasMore", () => {
  it("is true when the page came back full", () => {
    expect(pageHasMore(CREATOR_RECIPES_PAGE_SIZE)).toBe(true);
  });

  it("is false when the page was short (back-catalogue exhausted)", () => {
    expect(pageHasMore(CREATOR_RECIPES_PAGE_SIZE - 1)).toBe(false);
    expect(pageHasMore(0)).toBe(false);
  });
});

describe("creatorRecipePagination — mergeRecipePage", () => {
  it("appends a clean (non-overlapping) page in order", () => {
    const existing: Row[] = [{ id: "a" }, { id: "b" }];
    const page: Row[] = [{ id: "c" }, { id: "d" }];
    expect(mergeRecipePage(existing, page).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("drops rows whose id is already loaded (no duplicate render)", () => {
    const existing: Row[] = [{ id: "a" }, { id: "b" }];
    // 'b' overlaps — a newly published recipe shifted the newest-first
    // window so the next page re-served it.
    const page: Row[] = [{ id: "b" }, { id: "c" }];
    expect(mergeRecipePage(existing, page).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("does not mutate the input arrays", () => {
    const existing: Row[] = [{ id: "a" }];
    const page: Row[] = [{ id: "b" }];
    const result = mergeRecipePage(existing, page);
    expect(existing).toHaveLength(1);
    expect(result).not.toBe(existing);
  });

  it("de-dupes within the incoming page too", () => {
    const existing: Row[] = [];
    const page: Row[] = [{ id: "x" }, { id: "x" }, { id: "y" }];
    expect(mergeRecipePage(existing, page).map((r) => r.id)).toEqual(["x", "y"]);
  });
});
