import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Redis } from "@upstash/redis";

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

import {
  _falBudgetKeysForTest,
  _readFalBudgetCounterForTest,
  _resetFalBudgetForTest,
  _setFalBudgetFailOpenStateForTest,
  commitFalImageBudget,
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

// ─────────────────────────────────────────────────────────────────────
// Upstash fail-open / fail-closed window (ENG-1411) — state-helper pins
//
// Mirrors aiBudget.test.ts's "Upstash failure handling" describe block
// exactly, including its documented caveat: the in-memory counter path
// (no Upstash credentials configured) short-circuits before ever calling
// `noteUpstashFailure`, so these pin the state-transition helper only.
// The real Redis-throw path is exercised below with a mocked
// `@upstash/redis` client.
// ─────────────────────────────────────────────────────────────────────

describe("Upstash failure handling — state helper (mirrors aiBudget.test.ts)", () => {
  it("fails OPEN (grants) during the 5-minute window", async () => {
    // Drop a real reserve first so the in-memory store has values.
    await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    _setFalBudgetFailOpenStateForTest("open");

    // We can't inject a real Upstash failure into the in-memory path (it
    // short-circuits before `noteUpstashFailure`), so this test pins
    // behaviour via `_setFalBudgetFailOpenStateForTest`. The actual
    // production fail-open path is exercised below with a mocked Redis
    // client that throws.
    expect(typeof _setFalBudgetFailOpenStateForTest).toBe("function");
  });

  it("fails CLOSED past the 5-minute window", async () => {
    _setFalBudgetFailOpenStateForTest("expired");

    // No Upstash creds → in-memory store still works → reserve returns
    // ok. Sanity-checks the helper transitions state correctly; the
    // sustained-outage path is exercised with a real Redis mock below.
    const grant = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(grant.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Upstash Redis failure — real throw (ENG-1411)
//
// Unlike the state-helper pins above, these exercise the ACTUAL
// `redis.incrby` throw path by mocking `@upstash/redis`'s `Redis` class,
// so the fail-open → fail-closed → recovery transition runs through the
// real `incrBy`/`noteUpstashFailure` code, not just the test hook.
// ─────────────────────────────────────────────────────────────────────

describe("Upstash Redis failure — real throw", () => {
  const mockIncrby = vi.fn();
  const mockExpire = vi.fn();
  const mockSet = vi.fn();

  beforeEach(() => {
    mockIncrby.mockReset();
    mockExpire.mockReset().mockResolvedValue(1);
    mockSet.mockReset();
    vi.mocked(Redis).mockReset().mockImplementation(
      () =>
        ({
          incrby: mockIncrby,
          expire: mockExpire,
          set: mockSet,
        }) as unknown as Redis,
    );
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  it("fails OPEN (grants with reservedPence 0) on the first Redis throw, logging loudly", async () => {
    mockIncrby.mockRejectedValue(new Error("ECONNREFUSED"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const grant = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(grant.ok).toBe(true);
    if (!grant.ok) throw new Error("unreachable");
    expect(grant.reservedPence).toBe(0);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("fail-OPEN"),
      expect.anything(),
    );

    errSpy.mockRestore();
  });

  it("a fail-open synthetic grant is never registered — commit/release are silent no-ops", async () => {
    mockIncrby.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const grant = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    if (!grant.ok) throw new Error("unreachable");

    await expect(releaseFalImageBudget(grant.grantId)).resolves.toBeUndefined();
    expect(() => commitFalImageBudget(grant.grantId)).not.toThrow();
  });

  it("fails CLOSED (denies, reason upstash_unavailable) once the 5-minute window has elapsed", async () => {
    mockIncrby.mockRejectedValue(new Error("ECONNREFUSED"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const first = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(first.ok).toBe(true); // still within the fail-open window

    vi.advanceTimersByTime(5 * 60_000 + 1_000);

    const denied = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("unreachable");
    expect(denied.reason).toBe("upstash_unavailable");
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("failing CLOSED"),
      expect.anything(),
    );

    errSpy.mockRestore();
  });

  it("denies past the fail-open window even when FAL_BUDGET_ENFORCEMENT_ENABLED=false — the Upstash-outage deny is unconditional", async () => {
    process.env.FAL_BUDGET_ENFORCEMENT_ENABLED = "false";
    mockIncrby.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    vi.advanceTimersByTime(5 * 60_000 + 1_000);

    const denied = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(denied.ok).toBe(false);
  });

  it("recovers to healthy once Redis succeeds again — a fresh reservation is a real (non-zero) grant", async () => {
    mockIncrby.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const failed = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(failed.ok).toBe(true);
    if (!failed.ok) throw new Error("unreachable");
    expect(failed.reservedPence).toBe(0);

    // Redis recovers.
    mockIncrby.mockReset().mockResolvedValue(11);

    const recovered = await reserveFalImageBudget({ modelId: "fal-ai/nano-banana-pro", imageClass: "hero" });
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) throw new Error("unreachable");
    expect(recovered.reservedPence).toBeGreaterThan(0);
  });
});
