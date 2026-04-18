import { describe, expect, it } from "vitest";
import { favoriteKey } from "@/lib/nutrition/favoriteFoods";

describe("favoriteKey", () => {
  it("lowercases, trims, and rounds to match the DB unique index", () => {
    expect(favoriteKey("Oatmeal", 350)).toBe("oatmeal|350");
    expect(favoriteKey("  Oatmeal  ", 350)).toBe("oatmeal|350");
    expect(favoriteKey("OATMEAL", 350.4)).toBe("oatmeal|350");
    expect(favoriteKey("oatmeal", 350.6)).toBe("oatmeal|351");
  });

  it("treats NaN / negative / undefined calories as 0", () => {
    // @ts-expect-error — testing runtime coercion of bad input
    expect(favoriteKey("Thing", undefined)).toBe("thing|0");
    expect(favoriteKey("Thing", Number.NaN)).toBe("thing|0");
    expect(favoriteKey("Thing", -50)).toBe("thing|0");
  });

  it("handles missing / empty titles defensively", () => {
    // @ts-expect-error — testing runtime coercion
    expect(favoriteKey(undefined, 100)).toBe("|100");
    expect(favoriteKey("", 100)).toBe("|100");
  });

  it("matches the canonical key from foodHistory so star state stays in sync", async () => {
    const { foodHistoryKey } = await import("@/lib/nutrition/foodHistory");
    expect(favoriteKey("Oatmeal", 350.4)).toBe(foodHistoryKey("Oatmeal", 350.4));
    expect(favoriteKey("CHICKEN SALAD", 425.7)).toBe(foodHistoryKey("CHICKEN SALAD", 425.7));
  });
});

// NOTE: Supabase integration tests for listFavorites / addFavorite /
// removeFavorite / isFavorite are intentionally deferred. They require a
// Supabase mock shaped to match the chained query-builder pattern (`from()
// .select().eq().order()`, `from().insert().select().single()`, etc.) and
// are best written alongside the broader `nutrition_entries` CRUD mocks
// we haven't stood up yet. Tracked for `qa-lead`. The key-building logic
// above is the piece that can silently drift the unique index, so it is
// the critical thing to lock in with unit tests today.
