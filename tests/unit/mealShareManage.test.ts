import { describe, expect, it } from "vitest";
import {
  deriveOwnMealShareLinkState,
  type OwnMealShareRow,
} from "../../src/lib/share/mealShareLink.ts";
import { listOwnMealShares, revokeMealShare } from "../../src/lib/share/mealShareClient.ts";

describe("deriveOwnMealShareLinkState (ENG-1648)", () => {
  const base: OwnMealShareRow = {
    id: "a",
    title: "Lunch",
    mealSlot: "lunch",
    createdAt: "2026-07-01T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    revokedAt: null,
  };

  it("returns active when not revoked and not expired", () => {
    expect(deriveOwnMealShareLinkState(base, Date.parse("2026-07-22T00:00:00.000Z"))).toBe(
      "active",
    );
  });

  it("returns expired when past expiresAt", () => {
    expect(
      deriveOwnMealShareLinkState(
        { ...base, expiresAt: "2026-01-01T00:00:00.000Z" },
        Date.parse("2026-07-22T00:00:00.000Z"),
      ),
    ).toBe("expired");
  });

  it("returns revoked when revokedAt is set (even if unexpired)", () => {
    expect(
      deriveOwnMealShareLinkState(
        { ...base, revokedAt: "2026-07-10T00:00:00.000Z" },
        Date.parse("2026-07-22T00:00:00.000Z"),
      ),
    ).toBe("revoked");
  });
});

describe("listOwnMealShares / revokeMealShare (ENG-1648)", () => {
  it("maps RLS rows into OwnMealShareRow", async () => {
    const rows = await listOwnMealShares({
      from: () => ({
        select: () => ({
          order: async () => ({
            data: [
              {
                id: "id-1",
                title: "Dinner",
                meal_slot: "dinner",
                created_at: "2026-07-20T12:00:00.000Z",
                expires_at: "2026-07-27T12:00:00.000Z",
                revoked_at: null,
              },
            ],
            error: null,
          }),
        }),
      }),
    });
    expect(rows).toEqual([
      {
        id: "id-1",
        title: "Dinner",
        mealSlot: "dinner",
        createdAt: "2026-07-20T12:00:00.000Z",
        expiresAt: "2026-07-27T12:00:00.000Z",
        revokedAt: null,
      },
    ]);
  });

  it("returns [] on select error", async () => {
    const rows = await listOwnMealShares({
      from: () => ({
        select: () => ({
          order: async () => ({ data: null, error: { message: "nope" } }),
        }),
      }),
    });
    expect(rows).toEqual([]);
  });

  it("revokeMealShare passes share id to RPC", async () => {
    const calls: unknown[] = [];
    const result = await revokeMealShare(
      {
        rpc: async (fn, args) => {
          calls.push([fn, args]);
          return { data: { status: "revoked" }, error: null };
        },
      },
      "  share-uuid  ",
    );
    expect(result).toEqual({ status: "revoked" });
    expect(calls).toEqual([["revoke_meal_share", { p_share_id: "share-uuid" }]]);
  });
});
