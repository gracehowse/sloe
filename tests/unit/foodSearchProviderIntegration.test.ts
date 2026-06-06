/**
 * Provider integration smoke (2026-06-04 nutrition search audit).
 *
 * Hits live search routes when credentials exist; skips otherwise so CI
 * stays green without FatSecret / USDA / Edamam secrets.
 */
import { describe, expect, it } from "vitest";

import { hasFatSecretEnv } from "@/lib/env/integrationEnv";

const hasFatSecret = hasFatSecretEnv();
const hasUsda = Boolean(process.env.USDA_FDC_API_KEY);
const hasEdamam =
  Boolean(process.env.EDAMAM_APP_ID) && Boolean(process.env.EDAMAM_APP_KEY);
/** Routes require Clerk/session auth — skip live HTTP smoke without a bearer. */
const hasLiveApiAuth = Boolean(process.env.SUPPR_TEST_AUTH_BEARER?.trim());

const brandedQuery = "starbucks latte";

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
  it.skipIf(!hasFatSecret || !hasLiveApiAuth)(
    "FatSecret returns branded hits for chain query",
    async () => {
      const { status, body } = await fetchSearch("/api/fatsecret/search", brandedQuery);
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect((body.hits ?? []).length).toBeGreaterThan(0);
    },
    15_000,
  );

  it.skipIf(!hasUsda || !hasLiveApiAuth)(
    "USDA returns hits for generic query",
    async () => {
      const { status, body } = await fetchSearch("/api/usda/search", "salmon");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect((body.hits ?? []).length).toBeGreaterThan(0);
    },
    15_000,
  );

  it.skipIf(!hasEdamam || !hasLiveApiAuth)(
    "Edamam returns hits for generic query",
    async () => {
      const { status, body } = await fetchSearch("/api/edamam/search", "banana");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect((body.hits ?? []).length).toBeGreaterThan(0);
    },
    15_000,
  );
});
