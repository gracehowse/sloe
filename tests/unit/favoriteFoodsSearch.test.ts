import { describe, expect, it } from "vitest";
import {
  matchFavoriteFoods,
  favoriteFoodKeySet,
  orderRecentWithFavoritesFirst,
  isFavoriteRow,
  FAVORITE_MATCH_CAP,
  type FavoriteSearchItem,
} from "@/lib/nutrition/favoriteFoodsSearch";
import { favoriteKey } from "@/lib/nutrition/favoriteFoods";

/** Helper: build a favourite item quickly. */
function fav(
  recipeTitle: string,
  calories: number,
  extras: Partial<FavoriteSearchItem> = {},
): FavoriteSearchItem {
  return {
    id: extras.id ?? `id-${recipeTitle}-${calories}`,
    recipeTitle,
    calories,
    protein: extras.protein ?? 10,
    carbs: extras.carbs ?? 20,
    fat: extras.fat ?? 5,
    ...extras,
  };
}

describe("matchFavoriteFoods — query matching", () => {
  const items = [
    fav("Sourdough", 180),
    fav("Smartfood popcorn", 160),
    fav("Greek yogurt", 120),
  ];

  it("returns [] for an empty / whitespace query", () => {
    expect(matchFavoriteFoods(items, "")).toEqual([]);
    expect(matchFavoriteFoods(items, "   ")).toEqual([]);
  });

  it("returns [] for empty favourites", () => {
    expect(matchFavoriteFoods([], "sour")).toEqual([]);
  });

  it("matches a partial-word substring the token scorer alone would miss (sour → Sourdough)", () => {
    const out = matchFavoriteFoods(items, "sour");
    expect(out.map((m) => m.item.recipeTitle)).toContain("Sourdough");
  });

  it("is case-insensitive", () => {
    const upper = matchFavoriteFoods(items, "GREEK").map((m) => m.item.recipeTitle);
    const lower = matchFavoriteFoods(items, "greek").map((m) => m.item.recipeTitle);
    expect(upper).toEqual(lower);
    expect(lower).toContain("Greek yogurt");
  });

  it("excludes genuinely unrelated favourites (no recall)", () => {
    const out = matchFavoriteFoods(items, "quinoa");
    expect(out).toEqual([]);
  });

  it("carries the favourite id + dedupe key on each match", () => {
    const out = matchFavoriteFoods(items, "sour");
    const m = out.find((x) => x.item.recipeTitle === "Sourdough")!;
    expect(m.item.id).toBe("id-Sourdough-180");
    expect(m.key).toBe(favoriteKey("Sourdough", 180));
  });

  it("caps the group at FAVORITE_MATCH_CAP", () => {
    const many = Array.from({ length: FAVORITE_MATCH_CAP + 3 }, (_, i) =>
      fav(`Protein bar ${i}`, 200 + i),
    );
    const out = matchFavoriteFoods(many, "protein");
    expect(out.length).toBe(FAVORITE_MATCH_CAP);
  });

  it("de-dupes identical (title, kcal) favourites to one row", () => {
    const dupes = [fav("Sourdough", 180, { id: "a" }), fav("Sourdough", 180, { id: "b" })];
    const out = matchFavoriteFoods(dupes, "sour");
    expect(out.length).toBe(1);
  });

  it("ranks an exact-name match above a looser substring hit", () => {
    const mixed = [fav("Sourdough crackers", 130), fav("Sourdough", 180)];
    const out = matchFavoriteFoods(mixed, "sourdough");
    expect(out[0]!.item.recipeTitle).toBe("Sourdough");
  });
});

describe("favoriteFoodKeySet + isFavoriteRow", () => {
  const favs = [fav("Sourdough", 180), fav("Greek yogurt", 120)];

  it("builds a key set matching the DB unique index (lower title + rounded kcal)", () => {
    const set = favoriteFoodKeySet(favs);
    expect(set.has(favoriteKey("sourdough", 180))).toBe(true);
    expect(set.has(favoriteKey("Greek Yogurt", 120))).toBe(true);
    expect(set.has(favoriteKey("Quinoa", 200))).toBe(false);
  });

  it("isFavoriteRow checks membership with the same casing/rounding rule", () => {
    const set = favoriteFoodKeySet(favs);
    expect(isFavoriteRow(set, "SOURDOUGH", 180.4)).toBe(true);
    expect(isFavoriteRow(set, "Quinoa", 200)).toBe(false);
  });
});

describe("orderRecentWithFavoritesFirst", () => {
  const recent = [
    { recipeTitle: "Banana", calories: 105 },
    { recipeTitle: "Sourdough", calories: 180 },
    { recipeTitle: "Coffee", calories: 5 },
    { recipeTitle: "Greek yogurt", calories: 120 },
  ];

  it("returns [] for empty recents", () => {
    expect(orderRecentWithFavoritesFirst([], new Set())).toEqual([]);
  });

  it("returns a copy unchanged when there are no favourites", () => {
    const out = orderRecentWithFavoritesFirst(recent, new Set());
    expect(out.map((r) => r.recipeTitle)).toEqual([
      "Banana",
      "Sourdough",
      "Coffee",
      "Greek yogurt",
    ]);
    expect(out).not.toBe(recent);
  });

  it("moves favourites to the front, preserving recency order within each group", () => {
    const keys = favoriteFoodKeySet([fav("Sourdough", 180), fav("Greek yogurt", 120)]);
    const out = orderRecentWithFavoritesFirst(recent, keys);
    expect(out.map((r) => r.recipeTitle)).toEqual([
      "Sourdough",
      "Greek yogurt",
      "Banana",
      "Coffee",
    ]);
  });

  it("never mutates the input array", () => {
    const keys = favoriteFoodKeySet([fav("Sourdough", 180)]);
    const snapshot = recent.map((r) => r.recipeTitle);
    orderRecentWithFavoritesFirst(recent, keys);
    expect(recent.map((r) => r.recipeTitle)).toEqual(snapshot);
  });
});
