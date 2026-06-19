import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _falBudgetKeysForTest,
  _readFalBudgetCounterForTest,
  _resetFalBudgetForTest,
  falImageCostPence,
  releaseFalImageBudget,
  reserveFalImageBudget,
} from "../../../src/lib/server/falBudget";

function clearEnv() {
  delete process.env.FAL_BUDGET_DAILY_GBP;
  delete process.env.FAL_BUDGET_MONTHLY_GBP;
  delete process.env.FAL_BUDGET_ENFORCEMENT_ENABLED;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

beforeEach(() => {
  clearEnv();
  _resetFalBudgetForTest();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-19T12:00:00.000Z"));
});

afterEach(() => {
  clearEnv();
  vi.useRealTimers();
});

describe("falImageCostPence", () => {
  it("models Nano as roughly 5x FLUX for tiering decisions", () => {
    expect(falImageCostPence("fal-ai/nano-banana-pro")).toBeGreaterThan(
      falImageCostPence("fal-ai/flux-pro/v2") * 3,
    );
  });
});

describe("reserveFalImageBudget", () => {
  it("enforces the hard daily cap before a fal request can run", async () => {
    process.env.FAL_BUDGET_DAILY_GBP = "1";
    process.env.FAL_BUDGET_MONTHLY_GBP = "100";

    for (let i = 0; i < 9; i++) {
      const grant = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
      expect(grant.ok).toBe(true);
    }

    const denied = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("unreachable");
    expect(denied.reason).toBe("daily_spend");
  });

  it("enforces the monthly cap independently of the daily cap", async () => {
    process.env.FAL_BUDGET_DAILY_GBP = "100";
    process.env.FAL_BUDGET_MONTHLY_GBP = "1";

    for (let i = 0; i < 9; i++) {
      const grant = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
      expect(grant.ok).toBe(true);
    }

    const denied = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("unreachable");
    expect(denied.reason).toBe("monthly_spend");
  });

  it("refunds reservations when generation fails before a billable success", async () => {
    const grant = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(grant.ok).toBe(true);
    if (!grant.ok) throw new Error("unreachable");

    expect(_readFalBudgetCounterForTest(_falBudgetKeysForTest.spend("daily", "2026-06-19"))).toBe(
      grant.reservedPence,
    );
    await releaseFalImageBudget(grant.grantId);
    expect(_readFalBudgetCounterForTest(_falBudgetKeysForTest.spend("daily", "2026-06-19"))).toBe(0);
  });
});
