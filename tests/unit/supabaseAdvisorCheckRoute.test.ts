/**
 * `app/api/cron/supabase-advisor-check` — alarm 6 route tests (ENG-509).
 *
 * Pins the auth gate, the level filter (ERROR / WARN only), the
 * Sentry fingerprinting contract (cache_key drives dedupe), and the
 * project-ref derivation from `NEXT_PUBLIC_SUPABASE_URL`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  deriveProjectRef,
  runAdvisorCheck,
  type AdvisorLint,
} from "../../app/api/cron/supabase-advisor-check/route";

// Sentry — replace captureMessage / captureException so we can assert
// what was emitted without touching the real transport.
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

function buildReq(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/supabase-advisor-check", {
    method: "POST",
    headers,
  });
}

const SAMPLE_SECURITY: AdvisorLint[] = [
  {
    name: "rls_enabled_no_policy",
    title: "RLS Enabled No Policy",
    level: "INFO",
    categories: ["SECURITY"],
    facing: "EXTERNAL",
    detail: "Table `public.revenuecat_events` has RLS enabled, but no policies exist",
    cache_key: "rls_no_policy_revenuecat",
  },
  {
    name: "function_search_path_mutable",
    title: "Function Search Path Mutable",
    level: "WARN",
    categories: ["SECURITY"],
    facing: "EXTERNAL",
    detail: "Function `public.set_updated_at` has a role mutable search_path",
    cache_key: "search_path_mutable_set_updated_at",
  },
  {
    name: "auth_leaked_password_protection",
    title: "Leaked Password Protection Disabled",
    level: "ERROR",
    categories: ["SECURITY"],
    facing: "EXTERNAL",
    detail: "...",
    cache_key: "auth_leaked_password_protection",
  },
];

const SAMPLE_PERFORMANCE: AdvisorLint[] = [
  {
    name: "unused_index",
    title: "Unused Index",
    level: "INFO",
    categories: ["PERFORMANCE"],
    cache_key: "unused_index_x",
  },
  {
    name: "unindexed_foreign_keys",
    title: "Unindexed Foreign Keys",
    level: "WARN",
    categories: ["PERFORMANCE"],
    cache_key: "fk_no_index_y",
  },
];

describe("supabase-advisor-check — auth + config gates", () => {
  beforeEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    delete process.env.SUPPR_CRON_SECRET;
    delete process.env.SUPABASE_PAT;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("503 when SUPPR_CRON_SECRET is unset", async () => {
    const res = await runAdvisorCheck(buildReq());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("server_misconfigured");
    expect(json.message).toMatch(/SUPPR_CRON_SECRET/);
  });

  it("401 when secret is wrong", async () => {
    process.env.SUPPR_CRON_SECRET = "expected-secret";
    const res = await runAdvisorCheck(buildReq({ "x-cron-secret": "wrong" }));
    expect(res.status).toBe(401);
  });

  it("503 when SUPABASE_PAT is unset", async () => {
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    const res = await runAdvisorCheck(buildReq({ "x-cron-secret": "ok-secret" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.message).toMatch(/SUPABASE_PAT/);
  });

  it("503 when NEXT_PUBLIC_SUPABASE_URL is missing or malformed", async () => {
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    process.env.SUPABASE_PAT = "sk_test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not a url";

    const res = await runAdvisorCheck(buildReq({ "x-cron-secret": "ok-secret" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.message).toMatch(/project ref/);
  });
});

describe("supabase-advisor-check — happy path", () => {
  beforeEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    process.env.SUPABASE_PAT = "sk_test_pat";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fnfgxsignmuepshbebrl.supabase.co";
  });

  it("derives project ref from the public URL", () => {
    expect(deriveProjectRef("https://fnfgxsignmuepshbebrl.supabase.co")).toBe(
      "fnfgxsignmuepshbebrl",
    );
    expect(deriveProjectRef("https://abcdef.supabase.co/")).toBe("abcdef");
    expect(deriveProjectRef(undefined)).toBeNull();
    expect(deriveProjectRef("not a url")).toBeNull();
  });

  it("emits ERROR + WARN findings; skips INFO; returns summary", async () => {
    const fetchAdvisors = vi
      .fn()
      .mockImplementation(async (_ref: string, _pat: string, type: "security" | "performance") =>
        type === "security" ? SAMPLE_SECURITY : SAMPLE_PERFORMANCE,
      );
    const emitted: AdvisorLint[] = [];
    const emit = (f: AdvisorLint) => { emitted.push(f); };

    const res = await runAdvisorCheck(
      buildReq({ "x-cron-secret": "ok-secret" }),
      fetchAdvisors,
      emit,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.securityCount).toBe(3);
    expect(json.performanceCount).toBe(2);
    expect(json.emittedCount).toBe(3); // 1 ERROR + 2 WARN
    expect(json.skippedInfoCount).toBe(2); // 2 INFOs

    // Emitted findings preserve the cache_key for fingerprinting.
    const cacheKeys = emitted.map((f) => f.cache_key).sort();
    expect(cacheKeys).toEqual(
      ["auth_leaked_password_protection", "fk_no_index_y", "search_path_mutable_set_updated_at"].sort(),
    );
  });

  it("502 when advisor fetch fails", async () => {
    const fetchAdvisors = vi.fn().mockRejectedValue(new Error("upstream 500"));
    const res = await runAdvisorCheck(
      buildReq({ "x-cron-secret": "ok-secret" }),
      fetchAdvisors,
      () => {},
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("advisor_fetch_failed");
  });

  it("continues emitting other findings if one emit throws", async () => {
    const fetchAdvisors = vi
      .fn()
      .mockImplementation(async (_ref: string, _pat: string, type: "security" | "performance") =>
        type === "security" ? SAMPLE_SECURITY : [],
      );
    let calls = 0;
    const emit = (f: AdvisorLint) => {
      calls++;
      if (f.level === "WARN") throw new Error("sentry transport boom");
    };
    const res = await runAdvisorCheck(
      buildReq({ "x-cron-secret": "ok-secret" }),
      fetchAdvisors,
      emit,
    );
    expect(res.status).toBe(200);
    expect(calls).toBe(2); // 1 WARN (threw) + 1 ERROR (ok)
    const json = await res.json();
    // Only the successful emit increments the counter — defensive count.
    expect(json.emittedCount).toBe(1);
  });
});
