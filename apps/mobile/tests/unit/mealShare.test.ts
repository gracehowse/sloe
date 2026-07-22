/**
 * ENG-1642 — mobile `lib/mealShare.ts` tests.
 *
 * Covers the two pure helpers (`journalMealToShareInput`,
 * `buildMobileMealShareUrl`) plus the link-vs-text orchestration in
 * `shareJournalMeal`/`shareJournalMealAsLink` — the event-ordering +
 * single-sheet contract from the adversarial review: `meal_share_link_created`
 * must fire BEFORE the native Share sheet opens, and a link that's already
 * been created must never fall through to a second (legacy text-only)
 * share sheet, even if the native sheet itself throws.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("react-native", () => ({
  Share: { share: vi.fn(), dismissedAction: "dismissedAction", sharedAction: "sharedAction" },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}));

import { Share } from "react-native";
import { supabase } from "@/lib/supabase";
import { track, isFeatureEnabled } from "@/lib/analytics";
import {
  buildMobileMealShareUrl,
  journalMealToShareInput,
  listMealShares,
  revokeMealShare,
  shareJournalMeal,
} from "../../lib/mealShare";
import type { JournalMeal } from "../../lib/nutritionJournal";

/**
 * Minimal chainable stub for the ONE query shape `listMealShares` issues —
 * `.from("meal_shares").select(cols).eq("created_by", id).order(...).limit(n)`.
 * Mirrors the web-side stub in `tests/unit/mealShareClient.test.ts`.
 */
function stubSelect(result: { data: unknown; error: { message: string } | null }) {
  const filters: Record<string, unknown> = {};
  const self: any = {
    select(_cols?: string) {
      return self;
    },
    eq(col: string, val: unknown) {
      filters[`eq:${col}`] = val;
      return self;
    },
    order(col: string, opts?: unknown) {
      filters[`order:${col}`] = opts ?? true;
      return self;
    },
    limit(n: number) {
      filters["limit"] = n;
      return self;
    },
    then(resolve: (r: typeof result) => void) {
      resolve(result);
    },
  };
  vi.mocked(supabase.from).mockReturnValue(self);
  return { filters };
}

function makeMeal(overrides: Partial<JournalMeal> = {}): JournalMeal {
  return {
    id: "meal-1",
    name: "Lunch",
    recipeTitle: "Chicken burrito bowl",
    time: "12:30 PM",
    calories: 620,
    protein: 42,
    carbs: 55,
    fat: 20,
    ...overrides,
  };
}

describe("journalMealToShareInput", () => {
  it("maps a well-formed JournalMeal to a single-item share input", () => {
    const result = journalMealToShareInput(makeMeal());
    expect(result).toEqual({
      title: "Chicken burrito bowl",
      mealSlot: "Lunch",
      items: [
        {
          recipe_title: "Chicken burrito bowl",
          calories: 620,
          protein: 42,
          carbs: 55,
          fat: 20,
        },
      ],
    });
  });

  it("returns a single-item array — never batches multiple meals", () => {
    const result = journalMealToShareInput(makeMeal());
    expect(result?.items).toHaveLength(1);
  });

  it("normalises the legacy 'Snack' slot name to 'Snacks'", () => {
    const result = journalMealToShareInput(makeMeal({ name: "Snack" }));
    expect(result?.mealSlot).toBe("Snacks");
  });

  it("carries optional fields through when present", () => {
    const result = journalMealToShareInput(
      makeMeal({ fiberG: 8, waterMl: 250, portionMultiplier: 1.5, source: "usda", recipeId: "r-1" }),
    );
    expect(result?.items[0]).toMatchObject({
      fiber_g: 8,
      water_ml: 250,
      portion_multiplier: 1.5,
      source: "usda",
      recipe_id: "r-1",
    });
  });

  it("drops junk (non-finite macros) — returns null so the caller falls back to text share", () => {
    expect(journalMealToShareInput(makeMeal({ calories: Number.NaN }))).toBeNull();
  });

  it("returns null when recipeTitle is entirely empty (no fallback slot title on the item itself)", () => {
    // recipe_title is required by the wire item — a meal with no title at
    // all (not even whitespace) still fails `mealToShareItem`'s own check.
    expect(journalMealToShareInput(makeMeal({ recipeTitle: "" }))).toBeNull();
  });

  it("returns null for a meal missing a macro entirely (undefined, not just NaN)", () => {
    const meal = makeMeal();
    // @ts-expect-error — simulating a malformed runtime object.
    delete meal.protein;
    expect(journalMealToShareInput(meal)).toBeNull();
  });
});

describe("buildMobileMealShareUrl", () => {
  it("falls back to https://suppr-club.com when supprApiUrl is unset", () => {
    expect(buildMobileMealShareUrl("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
      "https://suppr-club.com/m/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });
});

describe("shareJournalMeal — link vs text orchestration", () => {
  const TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  beforeEach(() => {
    vi.mocked(Share.share).mockReset().mockResolvedValue({ action: "sharedAction" });
    vi.mocked(supabase.rpc).mockReset();
    vi.mocked(track).mockReset();
    vi.mocked(isFeatureEnabled).mockReset().mockReturnValue(false);
  });

  it("flag off: exactly one legacy text-only sheet — no url field, mode \"text\"", async () => {
    await shareJournalMeal(makeMeal(), "today_meal_row_longpress");

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(Share.share).toHaveBeenCalledTimes(1);
    const call = vi.mocked(Share.share).mock.calls[0]![0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("url");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("meal_share_invoked", {
      surface: "today_meal_row_longpress",
      outcome: "shared",
      mode: "text",
    });
  });

  it("flag on, RPC doesn't return \"created\": falls back to the single legacy text-only sheet", async () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    // Only `{data, error}` is read by `createMealShare`/`getMealShare` — the
    // rest of the real `PostgrestSingleResponse` shape (count/status/etc.)
    // is irrelevant here, so the mock is intentionally partial and cast
    // rather than fabricating fields nothing under test reads.
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { status: "rate_limited" },
      error: null,
    } as Awaited<ReturnType<typeof supabase.rpc>>);

    await shareJournalMeal(makeMeal(), "today_meal_row_longpress");

    expect(Share.share).toHaveBeenCalledTimes(1);
    const call = vi.mocked(Share.share).mock.calls[0]![0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("url");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("meal_share_invoked", {
      surface: "today_meal_row_longpress",
      outcome: "shared",
      mode: "text",
    });
  });

  it("flag on, RPC created: meal_share_link_created fires BEFORE the (single) native Share sheet opens", async () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { status: "created", token: TOKEN, share_id: "share-1" },
      error: null,
    } as Awaited<ReturnType<typeof supabase.rpc>>);
    vi.mocked(Share.share).mockImplementation(async () => {
      // The event-ordering assertion the review flagged: by the time the
      // native sheet opens, the create-success event must already have
      // fired (`src/lib/analytics/events.ts` contract: "fires once per
      // successful create, before the share sheet / clipboard write").
      expect(track).toHaveBeenCalledWith("meal_share_link_created", {
        surface: "today_meal_row_longpress",
        itemCount: 1,
      });
      return { action: "sharedAction" };
    });

    await shareJournalMeal(makeMeal(), "today_meal_row_longpress");

    expect(Share.share).toHaveBeenCalledTimes(1);
    const call = vi.mocked(Share.share).mock.calls[0]![0] as { message: string; url?: string };
    // Link goes ONLY in the `url` field — never duplicated into `message`
    // (iOS renders both, so appending it to the text too would show twice).
    expect(call.url).toBe("https://suppr-club.com/m/" + TOKEN);
    expect(call.message).not.toContain("https://");
    // Exactly two track calls total: creation + one invoke. No legacy
    // text-mode event, because the flow never fell through to it.
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith("meal_share_invoked", {
      surface: "today_meal_row_longpress",
      outcome: "shared",
      mode: "link",
    });
  });

  it("flag on, RPC created, native Share sheet throws: does NOT open a second (legacy) share sheet", async () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { status: "created", token: TOKEN, share_id: "share-2" },
      error: null,
    } as Awaited<ReturnType<typeof supabase.rpc>>);
    vi.mocked(Share.share).mockRejectedValueOnce(new Error("native module boom"));

    await shareJournalMeal(makeMeal(), "today_meal_row_longpress");

    // The critical assertion: ONE sheet attempt total, not a link sheet
    // followed by a legacy text fallback (a link already exists server-side
    // by this point — a second sheet would just be confusing duplicate UI).
    expect(Share.share).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith("meal_share_link_created", {
      surface: "today_meal_row_longpress",
      itemCount: 1,
    });
    expect(track).toHaveBeenCalledWith("meal_share_invoked", {
      surface: "today_meal_row_longpress",
      outcome: "error",
      mode: "link",
    });
  });
});

describe("listMealShares (ENG-1648)", () => {
  it("maps snake_case rows to camelCase MealShareListRow", async () => {
    const { filters } = stubSelect({
      data: [
        {
          id: "share-1",
          title: "Dinner",
          meal_slot: "Dinner",
          created_at: "2026-07-20T00:00:00Z",
          expires_at: "2026-08-19T00:00:00Z",
          revoked_at: null,
        },
      ],
      error: null,
    });

    const result = await listMealShares("user-1");

    expect(result).toEqual({
      status: "ok",
      rows: [
        {
          id: "share-1",
          title: "Dinner",
          mealSlot: "Dinner",
          createdAt: "2026-07-20T00:00:00Z",
          expiresAt: "2026-08-19T00:00:00Z",
          revokedAt: null,
        },
      ],
    });
    expect(filters["eq:created_by"]).toBe("user-1");
    expect(filters["limit"]).toBe(200);
  });

  it("preserves a real revoked_at value (not coerced to null)", async () => {
    stubSelect({
      data: [
        {
          id: "share-2",
          title: "Lunch",
          meal_slot: "Lunch",
          created_at: "2026-07-15T00:00:00Z",
          expires_at: "2026-08-14T00:00:00Z",
          revoked_at: "2026-07-18T00:00:00Z",
        },
      ],
      error: null,
    });
    const result = await listMealShares("user-1");
    expect(result.status === "ok" && result.rows[0].revokedAt).toBe("2026-07-18T00:00:00Z");
  });

  it("collapses a Supabase error to status 'error'", async () => {
    stubSelect({ data: null, error: { message: "boom" } });
    expect(await listMealShares("user-1")).toEqual({ status: "error" });
  });
});

describe("revokeMealShare (ENG-1648)", () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  it.each(["revoked", "not_found", "not_authenticated"] as const)(
    "passes through status '%s' from the RPC",
    async (status) => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { status },
        error: null,
      } as Awaited<ReturnType<typeof supabase.rpc>>);

      const result = await revokeMealShare("share-1");

      expect(result).toEqual({ status });
      expect(supabase.rpc).toHaveBeenCalledWith("revoke_meal_share", { p_share_id: "share-1" });
    },
  );

  it("collapses an RPC error to status 'error'", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "boom" },
    } as Awaited<ReturnType<typeof supabase.rpc>>);
    expect(await revokeMealShare("share-1")).toEqual({ status: "error" });
  });

  it("collapses an unrecognised status to 'error' rather than passing it through", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { status: "something_new" },
      error: null,
    } as Awaited<ReturnType<typeof supabase.rpc>>);
    expect(await revokeMealShare("share-1")).toEqual({ status: "error" });
  });
});
