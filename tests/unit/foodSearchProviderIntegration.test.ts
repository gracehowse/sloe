/**
 * Provider integration smoke (2026-06-04 nutrition search audit).
 *
 * Hits live search routes when credentials exist; skips otherwise so CI
 * stays green without FatSecret / USDA / Edamam secrets.
 *
 * ENG-880 — env gates are evaluated at test-run time (not module import)
 * so CONSUMER_KEY + CLIENT_SECRET aliases match production wiring.
 */
import { describe, expect, it } from "vitest";

import { hasFatSecretEnv } from "@/lib/env/integrationEnv";

const brandedQuery = "starbucks latte";

function hasLiveApiAuth(): boolean {
  return Boolean(process.env.SUPPR_TEST_AUTH_BEARER?.trim());
}

function hasUsdaEnv(): boolean {
  return Boolean(process.env.USDA_FDC_API_KEY?.trim());
}

function hasEdamamEnv(): boolean {
  return Boolean(process.env.EDAMAM_APP_ID?.trim() && process.env.EDAMAM_APP_KEY?.trim());
}

async function fetchSearch(path: string, query: string) {
  const base = process.env.SUPPR_TEST_API_BASE ?? "http://localhost:3000";
  const url = `${base}${path}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: process.env.SUPPR_TEST_AUTH_BEARER
      ? { Authorization: `Bearer ${process.env.SUPPR_TEST_AUTH_BEARER}` }
      : {},
  });
  return { status: res.status, body: (await res.json()) as { ok?: boolean; hits?: unknown[] } };
}

describe("food search provider integration smoke", () => {
  it(
    "FatSecret returns branded hits for chain query",
    async (ctx) => {
      if (!hasFatSecretEnv() || !hasLiveApiAuth()) {
        ctx.skip();
        return;
      }
      const { status, body } = await fetchSearch("/api/fatsecret/search", brandedQuery);
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect((body.hits ?? []).length).toBeGreaterThan(0);
    },
    15_000,
  );

  it(
    "USDA returns hits for generic query",
    async (ctx) => {
      if (!hasUsdaEnv() || !hasLiveApiAuth()) {
        ctx.skip();
        return;
      }
      const { status, body } = await fetchSearch("/api/usda/search", "salmon");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect((body.hits ?? []).length).toBeGreaterThan(0);
    },
    15_000,
  );

  it(
    "Edamam returns hits for generic query",
    async (ctx) => {
      if (!hasEdamamEnv() || !hasLiveApiAuth()) {
        ctx.skip();
        return;
      }
      const { status, body } = await fetchSearch("/api/edamam/search", "banana");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect((body.hits ?? []).length).toBeGreaterThan(0);
    },
    15_000,
  );
});
