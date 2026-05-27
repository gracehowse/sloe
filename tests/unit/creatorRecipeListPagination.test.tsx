/**
 * ENG-748 #14 (2026-05-27) — Creator profile recipe list pagination (web).
 *
 * The creator page used to hard-cap the recipe list at 50 rows, so
 * creators with >50 published recipes had older recipes silently
 * invisible. `CreatorRecipeList` renders the server-fetched first page
 * and appends further pages via the same public query on "Load more".
 *
 * These tests pin the user-observable behaviour:
 *   1. The first page renders; "Load more" shows only when the first
 *      page came back full (there may be more).
 *   2. Tapping "Load more" appends the next page via a `.range(from, to)`
 *      query offset by the number of rows already loaded.
 *   3. "Load more" disappears once a short (non-full) page comes back —
 *      i.e. the back-catalogue is exhausted.
 *   4. A failed page fetch surfaces a retry line and keeps the button
 *      (never silently drops the tap).
 *   5. No "Load more" when the first page was short (≤ page size).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CreatorRecipeList,
  CREATOR_RECIPES_PAGE_SIZE,
  type CreatorRecipeRow,
} from "../../src/app/components/creator/CreatorRecipeList";

// --- supabase browserClient mock --------------------------------------------
//
// The route query is `.from("recipes").select(...).eq().eq().order()
// .range(from, to).returns<T>()`. We make every chain method return the
// builder and resolve `.range()` to the next queued page. `rangeCalls`
// records the (from, to) tuples so the offset math can be asserted.

const rangeCalls: Array<[number, number]> = [];
let pageQueue: Array<{ data: CreatorRecipeRow[] | null; error: unknown }> = [];

function makeRow(id: string): CreatorRecipeRow {
  return {
    id,
    title: `Recipe ${id}`,
    image_url: null,
    calories: 500,
    protein: 30,
    carbs: 40,
    cook_time_min: 20,
    prep_time_min: 10,
  };
}

function makePage(prefix: string, n: number): CreatorRecipeRow[] {
  return Array.from({ length: n }, (_, i) => makeRow(`${prefix}-${i}`));
}

vi.mock("../../src/lib/supabase/browserClient", () => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  // The component's terminal call is `.range(from, to).returns<T>()`.
  // `.range()` records the offset tuple and stays chainable; `.returns()`
  // resolves the next queued page (it returns a thenable so `await` works).
  builder.range = vi.fn((from: number, to: number) => {
    rangeCalls.push([from, to]);
    return builder;
  });
  builder.returns = vi.fn(() =>
    Promise.resolve(pageQueue.shift() ?? { data: [], error: null }),
  );
  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  };
});

afterEach(() => {
  rangeCalls.length = 0;
  pageQueue = [];
  vi.clearAllMocks();
});

describe("CreatorRecipeList — pagination", () => {
  it("renders the first page and shows Load more only when the page is full", () => {
    render(
      <CreatorRecipeList
        creatorId="creator-1"
        initialRecipes={makePage("first", CREATOR_RECIPES_PAGE_SIZE)}
        initialHasMore
      />,
    );
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
    expect(screen.getByText("Recipe first-0")).toBeTruthy();
  });

  it("does NOT show Load more when the first page was short", () => {
    render(
      <CreatorRecipeList
        creatorId="creator-1"
        initialRecipes={makePage("first", 3)}
        initialHasMore={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("appends the next page on tap, offset by rows already loaded", async () => {
    pageQueue = [{ data: makePage("second", CREATOR_RECIPES_PAGE_SIZE), error: null }];
    render(
      <CreatorRecipeList
        creatorId="creator-1"
        initialRecipes={makePage("first", CREATOR_RECIPES_PAGE_SIZE)}
        initialHasMore
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getByText("Recipe second-0")).toBeTruthy());
    // Offset = number of rows already loaded (the full first page).
    expect(rangeCalls[0]).toEqual([
      CREATOR_RECIPES_PAGE_SIZE,
      CREATOR_RECIPES_PAGE_SIZE * 2 - 1,
    ]);
    // Both pages now visible.
    expect(screen.getByText("Recipe first-0")).toBeTruthy();
    expect(screen.getByText("Recipe second-0")).toBeTruthy();
  });

  it("hides Load more once a short (non-full) page comes back", async () => {
    pageQueue = [{ data: makePage("second", 5), error: null }];
    render(
      <CreatorRecipeList
        creatorId="creator-1"
        initialRecipes={makePage("first", CREATOR_RECIPES_PAGE_SIZE)}
        initialHasMore
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Recipe second-4")).toBeTruthy());
    // Back-catalogue exhausted → button gone.
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("de-dupes rows that overlap the loaded set", async () => {
    // Page 2 includes one id already present in page 1 (a newly
    // published recipe shifted the newest-first window). It must not
    // render twice.
    const overlap = makeRow("first-0");
    pageQueue = [{ data: [overlap, makeRow("second-0")], error: null }];
    render(
      <CreatorRecipeList
        creatorId="creator-1"
        initialRecipes={makePage("first", CREATOR_RECIPES_PAGE_SIZE)}
        initialHasMore
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Recipe second-0")).toBeTruthy());
    // Only one render of the overlapping row.
    expect(screen.getAllByText("Recipe first-0")).toHaveLength(1);
  });

  it("surfaces a retry line and keeps the button on fetch error", async () => {
    pageQueue = [{ data: null, error: { message: "boom" } }];
    render(
      <CreatorRecipeList
        creatorId="creator-1"
        initialRecipes={makePage("first", CREATOR_RECIPES_PAGE_SIZE)}
        initialHasMore
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(screen.getByText(/Couldn.t load more recipes/i)).toBeTruthy(),
    );
    // Button still present so the user can retry.
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
  });
});
