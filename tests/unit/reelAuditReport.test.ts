/**
 * Unit tests for the Reel parse-rate audit harness's pure helpers
 * (ENG-7 / ENG-670). Covers aggregation (happy + failure roll-up + empty
 * list), response classification (the route's stable contract + every
 * synthetic transport code), and report rendering (gate banner + tables).
 *
 * The runner (`scripts/audit-tiktok-reels.ts`) is the I/O shell; all the
 * deterministic logic the gate depends on lives in the module under test, so
 * a regression here fails before a manual audit run produces a wrong number.
 */
import { describe, expect, it } from "vitest";

import {
  aggregateAttempts,
  classifyResponse,
  renderReport,
  runMeetsGateThreshold,
  GATE_SUCCESS_THRESHOLD_PCT,
  SAMPLE_URLS_PER_MODE,
  type ReelAttempt,
} from "../../scripts/_lib/reelAuditReport";

function ok(url: string, durationMs = 1000, imageUsed: boolean | null = true): ReelAttempt {
  return { url, ok: true, errorCode: null, imageUsed, durationMs };
}
function fail(url: string, errorCode: string, durationMs = 1000): ReelAttempt {
  return { url, ok: false, errorCode, imageUsed: null, durationMs };
}

describe("aggregateAttempts", () => {
  it("rolls up a healthy run (happy path)", () => {
    const summary = aggregateAttempts([
      ok("a", 800),
      ok("b", 1200, false),
      ok("c", 1000),
      fail("d", "timeout", 50_000),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(1);
    expect(summary.successRatePct).toBe(75); // 3/4 rounds to 75
    expect(summary.imageUsedCount).toBe(2); // only the two successes with imageUsed === true
    expect(summary.maxDurationMs).toBe(50_000);
    expect(summary.avgDurationMs).toBe(Math.round((800 + 1200 + 1000 + 50_000) / 4));
    expect(summary.failureModes).toEqual([
      { errorCode: "timeout", count: 1, sampleUrls: ["d"] },
    ]);
  });

  it("aggregates failure modes, sorts by count desc then code asc, and caps samples", () => {
    const attempts: ReelAttempt[] = [
      fail("u1", "social_no_caption"),
      fail("u2", "social_no_caption"),
      fail("u3", "social_no_caption"),
      fail("u4", "social_no_caption"), // 4th sample must be dropped (cap is 3)
      fail("v1", "timeout"),
      fail("v2", "timeout"),
      fail("w1", "ai_capacity_reached"), // count 1 — ties broken alphabetically vs nothing
    ];
    const summary = aggregateAttempts(attempts);
    expect(summary.successRatePct).toBe(0);
    expect(summary.failureModes.map((m) => m.errorCode)).toEqual([
      "social_no_caption", // count 4
      "timeout", // count 2
      "ai_capacity_reached", // count 1
    ]);
    const top = summary.failureModes[0];
    expect(top.count).toBe(4);
    expect(top.sampleUrls).toHaveLength(SAMPLE_URLS_PER_MODE);
    expect(top.sampleUrls).toEqual(["u1", "u2", "u3"]);
  });

  it("breaks count ties by error code ascending", () => {
    const summary = aggregateAttempts([fail("a", "zzz_code"), fail("b", "aaa_code")]);
    expect(summary.failureModes.map((m) => m.errorCode)).toEqual(["aaa_code", "zzz_code"]);
  });

  it("buckets a null error code under 'unknown'", () => {
    const summary = aggregateAttempts([
      { url: "x", ok: false, errorCode: null, imageUsed: null, durationMs: 10 },
    ]);
    expect(summary.failureModes).toEqual([{ errorCode: "unknown", count: 1, sampleUrls: ["x"] }]);
  });

  it("returns a well-formed zero summary for an empty list (no NaN)", () => {
    const summary = aggregateAttempts([]);
    expect(summary).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      successRatePct: 0,
      failureModes: [],
      imageUsedCount: 0,
      avgDurationMs: 0,
      maxDurationMs: 0,
    });
    expect(Number.isNaN(summary.successRatePct)).toBe(false);
  });
});

describe("runMeetsGateThreshold", () => {
  it("passes at exactly the threshold", () => {
    const attempts = Array.from({ length: 10 }, (_, i) =>
      i < 9 ? ok(`ok${i}`) : fail(`f${i}`, "timeout"),
    );
    const summary = aggregateAttempts(attempts);
    expect(summary.successRatePct).toBe(GATE_SUCCESS_THRESHOLD_PCT);
    expect(runMeetsGateThreshold(summary)).toBe(true);
  });

  it("fails below the threshold", () => {
    const summary = aggregateAttempts([ok("a"), ok("b"), ok("c"), ok("d"), fail("e", "timeout")]);
    expect(summary.successRatePct).toBe(80);
    expect(runMeetsGateThreshold(summary)).toBe(false);
  });

  it("never passes on an empty run", () => {
    expect(runMeetsGateThreshold(aggregateAttempts([]))).toBe(false);
  });
});

describe("classifyResponse", () => {
  it("treats a 2xx { ok:true } as a parse, surfacing imageUsed", () => {
    expect(classifyResponse(200, { ok: true, imageUsed: true })).toEqual({
      ok: true,
      errorCode: null,
      imageUsed: true,
    });
    expect(classifyResponse(200, { ok: true, imageUsed: false })).toEqual({
      ok: true,
      errorCode: null,
      imageUsed: false,
    });
  });

  it("defaults imageUsed to null when the success body omits it", () => {
    expect(classifyResponse(200, { ok: true })).toEqual({
      ok: true,
      errorCode: null,
      imageUsed: null,
    });
  });

  it("surfaces the route's stable error code verbatim", () => {
    expect(classifyResponse(422, { ok: false, error: "social_no_caption" })).toEqual({
      ok: false,
      errorCode: "social_no_caption",
      imageUsed: null,
    });
    // Stable code is preferred even on a 2xx with ok:false.
    expect(classifyResponse(200, { ok: false, error: "duplicate_recipe" }).errorCode).toBe(
      "duplicate_recipe",
    );
  });

  it("synthesises http_<status> when a non-2xx has no error field", () => {
    expect(classifyResponse(503, null).errorCode).toBe("http_503");
    expect(classifyResponse(500, {}).errorCode).toBe("http_500");
  });

  it("marks a 2xx with an unexpected body as bad_response", () => {
    expect(classifyResponse(200, null).errorCode).toBe("bad_response");
    expect(classifyResponse(204, { something: "else" }).errorCode).toBe("bad_response");
  });
});

describe("renderReport", () => {
  const baseArgs = {
    dateIso: "2026-06-12",
    baseUrl: "http://localhost:3000",
    sampleFixture: false,
  };

  it("renders a passing run with no failure section noise", () => {
    const attempts = [ok("https://tiktok.com/a"), ok("https://tiktok.com/b")];
    const md = renderReport({ ...baseArgs, attempts, summary: aggregateAttempts(attempts) });
    expect(md).toContain("# TikTok / Reel parse-rate audit — 2026-06-12");
    expect(md).toContain("Parse rate: **100%** ✅ clears");
    expect(md).toContain("_No failures._");
    expect(md).not.toContain("Placeholder fixture in use");
  });

  it("renders the placeholder banner only when the sample fixture is used", () => {
    const attempts = [ok("a")];
    const summary = aggregateAttempts(attempts);
    expect(renderReport({ ...baseArgs, attempts, summary, sampleFixture: true })).toContain(
      "Placeholder fixture in use",
    );
    expect(renderReport({ ...baseArgs, attempts, summary, sampleFixture: false })).not.toContain(
      "Placeholder fixture in use",
    );
  });

  it("renders the failure table with codes + sample URLs and a below-threshold mark", () => {
    const attempts = [
      ok("https://tiktok.com/ok"),
      fail("https://tiktok.com/x", "timeout"),
      fail("https://tiktok.com/y", "timeout"),
      fail("https://tiktok.com/z", "social_no_caption"),
    ];
    const md = renderReport({ ...baseArgs, attempts, summary: aggregateAttempts(attempts) });
    expect(md).toContain("❌ below");
    expect(md).toContain("| `timeout` | 2 |");
    expect(md).toContain("`https://tiktok.com/x`");
    expect(md).toContain("| `social_no_caption` | 1 |");
    // Per-attempt detail row carries the result + code + ms.
    expect(md).toContain("| 1 | `https://tiktok.com/ok` | ok | — | yes |");
  });

  it("escapes pipe characters in URLs so the markdown table stays intact", () => {
    const attempts = [fail("https://t.co/a?x=1|2", "timeout")];
    const md = renderReport({ ...baseArgs, attempts, summary: aggregateAttempts(attempts) });
    expect(md).toContain("https://t.co/a?x=1\\|2");
  });
});
