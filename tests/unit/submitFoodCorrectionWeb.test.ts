/**
 * Web submitFoodCorrection (ENG-1247) — the parity twin of mobile's user_foods
 * write. Protects: a plausible entry upserts to user_foods with the right payload
 * + conflict key; an implausible entry is BLOCKED without writing (shared
 * plausibility gate); a db/RLS error is surfaced.
 */
import { describe, expect, it, vi } from "vitest";

import { submitFoodCorrection } from "../../src/lib/foodCorrection/submitFoodCorrection";

function makeSupabase(upsertResult: { error: { message: string } | null } = { error: null }) {
  const upsert = vi.fn(async () => upsertResult);
  const from = vi.fn(() => ({ upsert }));
  return { client: { from }, from, upsert };
}

const VALID = {
  barcode: "5012345678900",
  name: "Cereal bar",
  calories: 200,
  protein: 10,
  carbs: 20,
  fat: 8,
};

describe("web submitFoodCorrection", () => {
  it("upserts a plausible entry to user_foods with the right payload + conflict key", async () => {
    const sb = makeSupabase();
    const res = await submitFoodCorrection(sb.client, "user-1", VALID);
    expect(res.ok).toBe(true);
    expect(sb.from).toHaveBeenCalledWith("user_foods");
    expect(sb.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        barcode: VALID.barcode,
        name: "Cereal bar",
        calories: 200,
        submitted_by: "user-1",
      }),
      { onConflict: "barcode,submitted_by" },
    );
  });

  it("BLOCKS an implausible entry WITHOUT writing (shared plausibility gate)", async () => {
    const sb = makeSupabase();
    // 5000 kcal claimed for ~17 kcal of macros — wildly inconsistent.
    const res = await submitFoodCorrection(sb.client, "user-1", {
      ...VALID,
      calories: 5000,
      protein: 1,
      carbs: 1,
      fat: 1,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("plausibility_blocked");
    expect(res.reasons?.length).toBeGreaterThan(0);
    expect(sb.upsert).not.toHaveBeenCalled();
  });

  it("surfaces a db/RLS error from the upsert", async () => {
    const sb = makeSupabase({ error: { message: "new row violates row-level security" } });
    const res = await submitFoodCorrection(sb.client, "user-1", VALID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/row-level security/);
  });
});
