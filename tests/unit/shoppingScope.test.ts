/**
 * Honeydew parity (2026-04-30) — shopping scope helper tests.
 *
 * Pins the rules in `src/lib/household/shoppingScope.ts` that drive
 * household-aware shopping reads/writes/realtime. The helper is the
 * single contract both web (`useShoppingListState`) and mobile
 * (`apps/mobile/app/shopping.tsx`, `apps/mobile/app/(tabs)/planner.tsx`)
 * call through, so a regression here is a regression on both
 * platforms.
 */
import { describe, expect, it } from "vitest";
import {
  shoppingScopeFor,
  shoppingScopeReadFilters,
  shoppingScopeInsertStamp,
  shoppingScopeRealtimeFilter,
  shoppingScopeClearFilters,
} from "@/lib/household/shoppingScope";

describe("shoppingScopeFor", () => {
  it("returns solo scope when householdId is null", () => {
    const s = shoppingScopeFor({ userId: "u1", householdId: null });
    expect(s.kind).toBe("solo");
    expect((s as { userId: string }).userId).toBe("u1");
  });

  it("returns household scope when householdId is set", () => {
    const s = shoppingScopeFor({ userId: "u1", householdId: "h1" });
    expect(s.kind).toBe("household");
    expect((s as { householdId: string }).householdId).toBe("h1");
    expect((s as { userId: string }).userId).toBe("u1");
  });
});

describe("shoppingScopeReadFilters", () => {
  it("solo: filters by user_id AND household_id IS NULL", () => {
    const filters = shoppingScopeReadFilters({ kind: "solo", userId: "u1" });
    expect(filters).toEqual([
      ["user_id", "eq", "u1"],
      ["household_id", "is", null],
    ]);
  });

  it("household: filters only by household_id (members see each other)", () => {
    const filters = shoppingScopeReadFilters({
      kind: "household",
      userId: "u1",
      householdId: "h1",
    });
    expect(filters).toEqual([["household_id", "eq", "h1"]]);
  });
});

describe("shoppingScopeInsertStamp", () => {
  it("solo stamps user_id only, household_id null", () => {
    const stamp = shoppingScopeInsertStamp({ kind: "solo", userId: "u1" });
    expect(stamp).toEqual({ user_id: "u1", household_id: null });
  });

  it("household stamps both user_id (audit) AND household_id (scope)", () => {
    const stamp = shoppingScopeInsertStamp({
      kind: "household",
      userId: "u1",
      householdId: "h1",
    });
    expect(stamp).toEqual({ user_id: "u1", household_id: "h1" });
  });
});

describe("shoppingScopeRealtimeFilter", () => {
  it("solo subscribes by user_id (cross-device sync for the caller)", () => {
    expect(
      shoppingScopeRealtimeFilter({ kind: "solo", userId: "u1" }),
    ).toBe("user_id=eq.u1");
  });

  it("household subscribes by household_id (every member's edits)", () => {
    expect(
      shoppingScopeRealtimeFilter({
        kind: "household",
        userId: "u1",
        householdId: "h1",
      }),
    ).toBe("household_id=eq.h1");
  });
});

describe("shoppingScopeClearFilters", () => {
  it("solo clear targets user's per-user rows ONLY (household_id null)", () => {
    const f = shoppingScopeClearFilters({ kind: "solo", userId: "u1" });
    expect(f).toEqual({ user_id: "u1", household_id: null });
  });

  it("household clear targets the whole shared list (no user_id filter)", () => {
    const f = shoppingScopeClearFilters({
      kind: "household",
      userId: "u1",
      householdId: "h1",
    });
    expect(f).toEqual({ household_id: "h1" });
  });
});
