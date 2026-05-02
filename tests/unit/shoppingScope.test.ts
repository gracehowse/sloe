/**
 * Shopping scope helpers — Honeydew parity (PR3 dependency).
 *
 * Foundation tests for `src/lib/household/shoppingScope.ts`. The
 * realtime + RLS layers all assume these helpers produce the right
 * filters, stamps, and channel inputs given a (userId, householdId)
 * pair. This file pins the contract so a future tweak to the
 * household scope semantics can't silently break the realtime
 * subscribe path.
 */

import { describe, expect, it } from "vitest";
import {
  shoppingScopeClearFilters,
  shoppingScopeFor,
  shoppingScopeInsertStamp,
  shoppingScopeReadFilters,
  shoppingScopeRealtimeFilter,
} from "../../src/lib/household/shoppingScope.ts";

describe("shoppingScopeFor", () => {
  it("returns household scope when householdId is present", () => {
    expect(shoppingScopeFor({ userId: "u1", householdId: "hh-1" })).toEqual({
      kind: "household",
      userId: "u1",
      householdId: "hh-1",
    });
  });

  it("returns solo scope when householdId is null", () => {
    expect(shoppingScopeFor({ userId: "u1", householdId: null })).toEqual({
      kind: "solo",
      userId: "u1",
    });
  });
});

describe("shoppingScopeReadFilters", () => {
  it("filters by household_id only in household scope", () => {
    const filters = shoppingScopeReadFilters({
      kind: "household",
      userId: "u1",
      householdId: "hh-1",
    });
    expect(filters).toEqual([["household_id", "eq", "hh-1"]]);
  });

  it("filters by user_id AND household_id IS NULL in solo scope", () => {
    const filters = shoppingScopeReadFilters({ kind: "solo", userId: "u1" });
    expect(filters).toEqual([
      ["user_id", "eq", "u1"],
      ["household_id", "is", null],
    ]);
  });
});

describe("shoppingScopeInsertStamp", () => {
  it("stamps user_id and household_id in household scope", () => {
    expect(
      shoppingScopeInsertStamp({
        kind: "household",
        userId: "u1",
        householdId: "hh-1",
      }),
    ).toEqual({ user_id: "u1", household_id: "hh-1" });
  });

  it("stamps user_id and null household_id in solo scope", () => {
    expect(
      shoppingScopeInsertStamp({ kind: "solo", userId: "u1" }),
    ).toEqual({ user_id: "u1", household_id: null });
  });
});

describe("shoppingScopeRealtimeFilter", () => {
  it("uses household_id=eq in household scope", () => {
    expect(
      shoppingScopeRealtimeFilter({
        kind: "household",
        userId: "u1",
        householdId: "hh-1",
      }),
    ).toBe("household_id=eq.hh-1");
  });

  it("uses user_id=eq in solo scope", () => {
    expect(
      shoppingScopeRealtimeFilter({ kind: "solo", userId: "u1" }),
    ).toBe("user_id=eq.u1");
  });
});

describe("shoppingScopeClearFilters", () => {
  it("scopes a clear-all to the active household when in household scope", () => {
    expect(
      shoppingScopeClearFilters({
        kind: "household",
        userId: "u1",
        householdId: "hh-1",
      }),
    ).toEqual({ household_id: "hh-1" });
  });

  it("scopes a clear-all to (user_id, household_id IS NULL) in solo scope", () => {
    expect(
      shoppingScopeClearFilters({ kind: "solo", userId: "u1" }),
    ).toEqual({ user_id: "u1", household_id: null });
  });
});
