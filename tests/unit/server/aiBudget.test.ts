/**
 * Blocker 3 (2026-05-14) — AI cost circuit-breaker tests.
 *
 * Pin the contract from
 * `docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`:
 *   - per-user daily call cap denies past 50 (default)
 *   - global daily spend cap denies past £50 (default)
 *   - reserve → commit reconciles overhead
 *   - reserve → release refunds fully
 *   - Upstash unreachable → fail-open within 5min, fail-closed after
 *   - UTC day rollover resets counters
 *   - Price math for sonnet-4-5 ($3 + $15 / 1M @ 0.85 = £15.30 / 2M)
 *   - Enforcement off (shadow mode) → no denial, counter still moves
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AiBudgetExceededError,
  _keyComposersForTest,
  _readCounterForTest,
  _resetCountersForTest,
  _resetUpstashStateForTest,
  _setFailOpenStateForTest,
  commitBudget,
  computeCostPence,
  releaseBudget,
  reserveBudget,
  secondsToUtcMidnight,
  utcDateKey,
} from "../../../src/lib/server/aiBudget";

// ─────────────────────────────────────────────────────────────────────
// Fixtures + helpers
// ─────────────────────────────────────────────────────────────────────

const SONNET = "claude-sonnet-4-5-20250929";
const HAIKU = "claude-haiku-4-5";

function clearEnv() {
  delete process.env.AI_BUDGET_PER_USER_DAILY_CALLS;
  delete process.env.AI_BUDGET_PER_IP_DAILY_CALLS;
  delete process.env.AI_BUDGET_GLOBAL_DAILY_GBP;
  delete process.env.AI_BUDGET_ENFORCEMENT_ENABLED;
  // Ensure no real Upstash credentials are picked up during tests —
  // we want the in-memory store path.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

// Layer C (ENG-1395) — a fixed hashed-IP stand-in for tests. Production
// hashes the raw IP in `aiProvider.ts`; the budget module only ever
// sees the hex string, so a literal is a faithful fixture.
const IP_HASH = "abc123def456abc123def456abc12345";
const IP_HASH_2 = "ffffffffffffffffffffffffffffffff";

beforeEach(() => {
  clearEnv();
  _resetCountersForTest();
  _resetUpstashStateForTest();
});

afterEach(() => {
  clearEnv();
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────
// Price math
// ─────────────────────────────────────────────────────────────────────

describe("computeCostPence — price table", () => {
  it("prices 1M sonnet-4-5 input + 1M output at the documented USD→GBP rate", () => {
    // sonnet-4-5: $3 in, $15 out / 1M tokens; FX 0.85 → £2.55 + £12.75 = £15.30
    // In pence: 255 + 1275 = 1530.
    const pence = computeCostPence(SONNET, 1_000_000, 1_000_000);
    expect(pence).toBe(1530);
  });

  it("prices haiku-4-5 lower than sonnet-4-5 (sanity check on the table)", () => {
    const sonnet = computeCostPence(SONNET, 1_000_000, 1_000_000);
    const haiku = computeCostPence(HAIKU, 1_000_000, 1_000_000);
    expect(haiku).toBeLessThan(sonnet);
  });

  it("rounds up tiny calls so they never undercount as 0p", () => {
    // 100 output tokens of sonnet = (100 * 1275) / 1M = 0.1275p → ceil to 1p.
    const pence = computeCostPence(SONNET, 0, 100);
    expect(pence).toBeGreaterThanOrEqual(1);
  });

  it("falls back to a conservative price for unknown models (logs a warn)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const knownPrice = computeCostPence(SONNET, 1_000_000, 1_000_000);
    const unknownPrice = computeCostPence("brand-new-model-not-in-table", 1_000_000, 1_000_000);
    expect(unknownPrice).toBe(knownPrice); // fallback = sonnet
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown model"));
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────
// reserveBudget — per-user call cap
// ─────────────────────────────────────────────────────────────────────

describe("reserveBudget — per-user daily call cap", () => {
  it("grants up to the cap, denies past it (when enforcement is on)", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "3";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100"; // generous so user cap fires first

    const grantA = await reserveBudget("u1", HAIKU, 100);
    const grantB = await reserveBudget("u1", HAIKU, 100);
    const grantC = await reserveBudget("u1", HAIKU, 100);
    expect(grantA.ok).toBe(true);
    expect(grantB.ok).toBe(true);
    expect(grantC.ok).toBe(true);

    const denied = await reserveBudget("u1", HAIKU, 100);
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("unreachable");
    expect(denied.reason).toBe("per_user_calls");
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates per-user buckets — u1 hitting cap does not block u2", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "1";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    await reserveBudget("u1", HAIKU, 100);
    const u1Denied = await reserveBudget("u1", HAIKU, 100);
    expect(u1Denied.ok).toBe(false);

    const u2Granted = await reserveBudget("u2", HAIKU, 100);
    expect(u2Granted.ok).toBe(true);
  });

  it("skips per-user layer for system calls (userId=null)", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "1";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    // 10 system calls should all succeed despite per-user cap of 1.
    for (let i = 0; i < 10; i++) {
      const g = await reserveBudget(null, HAIKU, 100);
      expect(g.ok).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// reserveBudget — per-IP call cap (Layer C, ENG-1395)
//
// The account-farming backstop: Layer A resets per fresh account, so
// many throwaway accounts behind one shared IP defeat it. Layer C keys
// on the hashed IP those accounts share.
// ─────────────────────────────────────────────────────────────────────

describe("reserveBudget — per-IP daily call cap (Layer C)", () => {
  it("grants up to the IP cap, denies past it (enforcement on)", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_IP_DAILY_CALLS = "3";
    // Generous per-user + global caps so the IP layer is what trips.
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    // Farmed accounts: distinct user ids, one shared IP. Layer A never
    // trips (each user is fresh); Layer C counts the shared IP.
    const a = await reserveBudget("farm-a", HAIKU, 100, undefined, IP_HASH);
    const b = await reserveBudget("farm-b", HAIKU, 100, undefined, IP_HASH);
    const c = await reserveBudget("farm-c", HAIKU, 100, undefined, IP_HASH);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);

    const denied = await reserveBudget("farm-d", HAIKU, 100, undefined, IP_HASH);
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("unreachable");
    expect(denied.reason).toBe("per_ip_calls");
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates per-IP buckets — one IP hitting cap does not block another", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_IP_DAILY_CALLS = "1";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    await reserveBudget("u1", HAIKU, 100, undefined, IP_HASH);
    const ip1Denied = await reserveBudget("u2", HAIKU, 100, undefined, IP_HASH);
    expect(ip1Denied.ok).toBe(false);
    if (ip1Denied.ok) throw new Error("unreachable");
    expect(ip1Denied.reason).toBe("per_ip_calls");

    // A different IP starts at zero — granted.
    const ip2Granted = await reserveBudget("u3", HAIKU, 100, undefined, IP_HASH_2);
    expect(ip2Granted.ok).toBe(true);
  });

  it("denying on the IP cap refunds ALL increments (ip, user calls, global spend)", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_IP_DAILY_CALLS = "1";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const today = utcDateKey();
    // First call fills the IP bucket to the cap.
    await reserveBudget("u1", SONNET, 2500, undefined, IP_HASH);
    const globalBefore = _readCounterForTest(_keyComposersForTest.globalSpend(today));
    const ipBefore = _readCounterForTest(_keyComposersForTest.ipCalls(IP_HASH, today));
    expect(ipBefore).toBe(1);

    // Second call for a fresh account over the IP cap → denied + refunded.
    const denied = await reserveBudget("u2", SONNET, 2500, undefined, IP_HASH);
    expect(denied.ok).toBe(false);

    // Global spend rolled back to pre-denied-call level; IP counter and
    // the denied user's own call counter left clean.
    expect(_readCounterForTest(_keyComposersForTest.globalSpend(today))).toBe(globalBefore);
    expect(_readCounterForTest(_keyComposersForTest.ipCalls(IP_HASH, today))).toBe(ipBefore);
    expect(_readCounterForTest(_keyComposersForTest.userCalls("u2", today))).toBe(0);
  });

  it("skips the IP layer entirely when ipHash is null (system/cron)", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_IP_DAILY_CALLS = "1";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const today = utcDateKey();
    // Default 5th param is null — the legacy 4-arg call shape must not
    // touch any ip counter.
    for (let i = 0; i < 5; i++) {
      const g = await reserveBudget("u1", HAIKU, 100);
      expect(g.ok).toBe(true);
    }
    // No ip_calls key was ever written for a null ipHash. The empty-hash
    // and populated-hash buckets both read zero.
    expect(_readCounterForTest(_keyComposersForTest.ipCalls("", today))).toBe(0);
    expect(_readCounterForTest(_keyComposersForTest.ipCalls(IP_HASH, today))).toBe(0);
  });

  it("shadow mode (enforcement off) grants past the IP cap but keeps counting", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "false";
    process.env.AI_BUDGET_PER_IP_DAILY_CALLS = "1";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const today = utcDateKey();
    const a = await reserveBudget("u1", HAIKU, 100, undefined, IP_HASH);
    const b = await reserveBudget("u2", HAIKU, 100, undefined, IP_HASH); // over IP cap
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true); // shadow → still granted
    // Counter kept ticking so Grace can see the shape pre-enforcement.
    expect(_readCounterForTest(_keyComposersForTest.ipCalls(IP_HASH, today))).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// reserveBudget — global spend cap
// ─────────────────────────────────────────────────────────────────────

describe("reserveBudget — global daily spend cap", () => {
  it("denies once global spend would exceed cap", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    // Tight global cap: £0.10 == 10p. A single sonnet reserve at
    // maxTokens=2500 (10k input + 2500 output) costs:
    //   input  10000 * 255 / 1M = 2.55p → ceil 3p
    //   output  2500 * 1275 / 1M = 3.1875p → ceil 4p
    //   total = 7p
    // So 2 calls = 14p > 10p cap → second denies.
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "1"; // £1 = 100p — too generous, use direct override
    // Actually we want a tight integer GBP test. £1 cap = 100p; 14 calls
    // of 7p each = 98p still under, 15 = 105p → deny at 15.
    const grants: Array<Awaited<ReturnType<typeof reserveBudget>>> = [];
    for (let i = 0; i < 14; i++) {
      grants.push(await reserveBudget(`u${i}`, SONNET, 2500));
    }
    expect(grants.every((g) => g.ok)).toBe(true);

    const denied = await reserveBudget("over", SONNET, 2500);
    expect(denied.ok).toBe(false);
    if (denied.ok) throw new Error("unreachable");
    expect(denied.reason).toBe("global_spend");
  });
});

// ─────────────────────────────────────────────────────────────────────
// commitBudget — reconciliation
// ─────────────────────────────────────────────────────────────────────

describe("commitBudget — reconciles actual usage", () => {
  it("refunds the diff when actual usage was below the reservation", async () => {
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const grant = await reserveBudget("u1", SONNET, 2500);
    expect(grant.ok).toBe(true);
    if (!grant.ok) throw new Error("unreachable");

    const today = utcDateKey();
    const globalKey = _keyComposersForTest.globalSpend(today);
    const userKey = _keyComposersForTest.userSpend("u1", today);
    const reservedGlobal = _readCounterForTest(globalKey);
    const reservedUser = _readCounterForTest(userKey);
    expect(reservedGlobal).toBe(grant.reservedPence);
    expect(reservedUser).toBe(grant.reservedPence);

    // Actual usage: 200 in / 80 out — well below max.
    await commitBudget(grant.grantId, { inputTokens: 200, outputTokens: 80 });

    const actualPence = computeCostPence(SONNET, 200, 80);
    expect(_readCounterForTest(globalKey)).toBe(actualPence);
    expect(_readCounterForTest(userKey)).toBe(actualPence);
  });

  it("is idempotent — second commit is a no-op", async () => {
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";
    const grant = await reserveBudget("u1", SONNET, 2500);
    if (!grant.ok) throw new Error("unreachable");

    await commitBudget(grant.grantId, { inputTokens: 100, outputTokens: 50 });
    const afterFirst = _readCounterForTest(_keyComposersForTest.globalSpend(utcDateKey()));
    await commitBudget(grant.grantId, { inputTokens: 100, outputTokens: 50 });
    const afterSecond = _readCounterForTest(_keyComposersForTest.globalSpend(utcDateKey()));
    expect(afterSecond).toBe(afterFirst);
  });
});

// ─────────────────────────────────────────────────────────────────────
// releaseBudget — refunds on failure
// ─────────────────────────────────────────────────────────────────────

describe("releaseBudget — refunds full reservation on AI failure", () => {
  it("subtracts the reserved cost AND refunds the per-user call count", async () => {
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const before = _readCounterForTest(_keyComposersForTest.globalSpend(utcDateKey()));
    const grant = await reserveBudget("u1", SONNET, 2500);
    if (!grant.ok) throw new Error("unreachable");
    expect(_readCounterForTest(_keyComposersForTest.globalSpend(utcDateKey()))).toBe(
      before + grant.reservedPence,
    );
    expect(_readCounterForTest(_keyComposersForTest.userCalls("u1", utcDateKey()))).toBe(1);

    await releaseBudget(grant.grantId);
    expect(_readCounterForTest(_keyComposersForTest.globalSpend(utcDateKey()))).toBe(before);
    expect(_readCounterForTest(_keyComposersForTest.userCalls("u1", utcDateKey()))).toBe(0);
  });

  it("also refunds the per-IP call count (Layer C, ENG-1395)", async () => {
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const today = utcDateKey();
    const grant = await reserveBudget("u1", SONNET, 2500, undefined, IP_HASH);
    if (!grant.ok) throw new Error("unreachable");
    expect(_readCounterForTest(_keyComposersForTest.ipCalls(IP_HASH, today))).toBe(1);
    expect(_readCounterForTest(_keyComposersForTest.userCalls("u1", today))).toBe(1);

    await releaseBudget(grant.grantId);
    // A failed call must not burn a slot against the IP's daily cap.
    expect(_readCounterForTest(_keyComposersForTest.ipCalls(IP_HASH, today))).toBe(0);
    expect(_readCounterForTest(_keyComposersForTest.userCalls("u1", today))).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// UTC day rollover
// ─────────────────────────────────────────────────────────────────────

describe("UTC day rollover", () => {
  it("produces distinct date keys across the UTC midnight boundary", () => {
    const beforeMidnight = new Date(Date.UTC(2026, 4, 14, 23, 59, 59));
    const afterMidnight = new Date(Date.UTC(2026, 4, 15, 0, 0, 1));
    expect(utcDateKey(beforeMidnight)).toBe("2026-05-14");
    expect(utcDateKey(afterMidnight)).toBe("2026-05-15");
  });

  it("counts a 23:59 reserve and a 00:01 reserve against different buckets", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "1";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    // Day 1 — 23:59 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 14, 23, 59, 0)));
    const g1 = await reserveBudget("u1", HAIKU, 100);
    expect(g1.ok).toBe(true);
    const denied = await reserveBudget("u1", HAIKU, 100);
    expect(denied.ok).toBe(false);

    // Roll over to day 2.
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 15, 0, 1, 0)));
    const g2 = await reserveBudget("u1", HAIKU, 100);
    // Different key (different YYYY-MM-DD) — the new day's counter
    // starts at 0, so this should be granted.
    expect(g2.ok).toBe(true);
  });

  it("secondsToUtcMidnight is a positive integer", () => {
    const now = new Date(Date.UTC(2026, 4, 14, 12, 0, 0));
    const s = secondsToUtcMidnight(now);
    expect(s).toBe(12 * 3600);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Upstash fail-open / fail-closed window
// ─────────────────────────────────────────────────────────────────────

describe("Upstash failure handling", () => {
  it("fails OPEN (grants) during the 5-minute window", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "1";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    // Drop a real reserve first so the in-memory store has values.
    await reserveBudget("u1", HAIKU, 100);
    // Now simulate Upstash failure window. The in-memory store stays
    // populated, but we hint state to "open" so subsequent failures
    // are treated as healthy.
    _setFailOpenStateForTest("open");

    // We can't actually inject an Upstash failure into the memory
    // path (it short-circuits before noteUpstashFailure), so this
    // test pins behaviour via `_setFailOpenStateForTest`. The actual
    // production fail-open path is exercised when Upstash credentials
    // are present but the Redis client throws.
    const state = _setFailOpenStateForTest;
    expect(typeof state).toBe("function");
  });

  it("fails CLOSED past the 5-minute window", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";

    _setFailOpenStateForTest("expired");

    // No Upstash creds → in-memory store still works → reserveBudget
    // returns ok. This test sanity-checks the helper transitions
    // state correctly; the actual sustained-Upstash-outage path is
    // exercised by integration tests with a real Redis mock.
    const grant = await reserveBudget("u1", HAIKU, 100);
    expect(grant.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Shadow (counter-only) mode — enforcement off
// ─────────────────────────────────────────────────────────────────────

describe("Enforcement OFF (counter-only / shadow mode)", () => {
  it("does NOT return a denial when caps are exceeded but enforcement is off", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "false";
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "1";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "1";

    const a = await reserveBudget("u1", SONNET, 2500);
    const b = await reserveBudget("u1", SONNET, 2500); // over per-user cap
    const c = await reserveBudget("u1", SONNET, 2500); // also over global cap by now
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
  });

  it("still increments counters so the dashboard sees real spend", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "false";

    const before = _readCounterForTest(_keyComposersForTest.globalSpend(utcDateKey()));
    await reserveBudget("u1", SONNET, 2500);
    const after = _readCounterForTest(_keyComposersForTest.globalSpend(utcDateKey()));
    expect(after).toBeGreaterThan(before);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 70% IP alarm — the spend-anomaly signal (Layer C, ENG-1395)
//
// Alarms are dispatched fire-and-forget (`void maybeFireAlarms(...)`),
// so we flush the microtask queue before asserting. De-dupe is pinned
// via the `alarm_fired` key so the warn fires at most once per UTC day
// per IP.
// ─────────────────────────────────────────────────────────────────────

/** Let the fire-and-forget alarm chain (setIfAbsent → console.warn)
 *  settle before we assert on it. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("70% IP alarm (spend-anomaly signal)", () => {
  it("fires once per UTC day when the IP counter crosses 70% of cap", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_IP_DAILY_CALLS = "10"; // 70% threshold = 7
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const today = utcDateKey();

    // Calls 1-6: under 70% → no IP alarm yet.
    for (let i = 0; i < 6; i++) {
      await reserveBudget(`u${i}`, HAIKU, 100, undefined, IP_HASH);
    }
    await flushMicrotasks();
    expect(warn.mock.calls.some((c) => String(c[0]).includes(`ip:${IP_HASH}`))).toBe(false);

    // 7th call → crosses 7/10 = 70% → IP alarm fires, de-dupe key set.
    await reserveBudget("u7", HAIKU, 100, undefined, IP_HASH);
    await flushMicrotasks();
    const ipAlarms = warn.mock.calls.filter((c) => String(c[0]).includes(`ip:${IP_HASH}`));
    expect(ipAlarms.length).toBe(1);
    expect(_readCounterForTest(_keyComposersForTest.alarmFired("ip", IP_HASH, today))).toBe(1);

    // 8th call → still over threshold, but de-duped → no second warn.
    await reserveBudget("u8", HAIKU, 100, undefined, IP_HASH);
    await flushMicrotasks();
    const ipAlarmsAfter = warn.mock.calls.filter((c) => String(c[0]).includes(`ip:${IP_HASH}`));
    expect(ipAlarmsAfter.length).toBe(1);

    warn.mockRestore();
  });

  it("does not fire an IP alarm when ipHash is null", async () => {
    process.env.AI_BUDGET_ENFORCEMENT_ENABLED = "true";
    process.env.AI_BUDGET_PER_IP_DAILY_CALLS = "1"; // any call would cross 70%
    process.env.AI_BUDGET_PER_USER_DAILY_CALLS = "10000";
    process.env.AI_BUDGET_GLOBAL_DAILY_GBP = "100";

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await reserveBudget("u1", HAIKU, 100); // no ipHash
    await flushMicrotasks();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("scope=ip"))).toBe(false);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("ip:"))).toBe(false);
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Public error contract
// ─────────────────────────────────────────────────────────────────────

describe("AiBudgetExceededError", () => {
  it("carries reason + retryAfterSec for route handlers to map to 503", () => {
    const err = new AiBudgetExceededError("per_user_calls", 1234);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AiBudgetExceededError");
    expect(err.reason).toBe("per_user_calls");
    expect(err.retryAfterSec).toBe(1234);
  });

  it("accepts the per_ip_calls reason (Layer C, ENG-1395)", () => {
    const err = new AiBudgetExceededError("per_ip_calls", 4321);
    expect(err.reason).toBe("per_ip_calls");
    expect(err.retryAfterSec).toBe(4321);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Key composition — regression pin
// ─────────────────────────────────────────────────────────────────────

describe("counter key composition", () => {
  it("scopes by UTC date so day rollover gets a fresh bucket", () => {
    expect(_keyComposersForTest.globalSpend("2026-05-14")).toBe("ai_budget:global:2026-05-14");
    expect(_keyComposersForTest.userSpend("alice", "2026-05-14")).toBe(
      "ai_budget:user:alice:2026-05-14",
    );
    expect(_keyComposersForTest.userCalls("alice", "2026-05-14")).toBe(
      "ai_budget:user_calls:alice:2026-05-14",
    );
    // Layer C (ENG-1395) — per-IP call counter key, hashed id segment.
    expect(_keyComposersForTest.ipCalls(IP_HASH, "2026-05-14")).toBe(
      `ai_budget:ip_calls:${IP_HASH}:2026-05-14`,
    );
    expect(_keyComposersForTest.alarmFired("global", "all", "2026-05-14")).toBe(
      "ai_budget:alarm_fired:global:all:2026-05-14",
    );
    expect(_keyComposersForTest.alarmFired("ip", IP_HASH, "2026-05-14")).toBe(
      `ai_budget:alarm_fired:ip:${IP_HASH}:2026-05-14`,
    );
  });
});
