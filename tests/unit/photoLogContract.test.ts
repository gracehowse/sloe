/**
 * F-108 (`ABM2nBZTJf9W`, 2026-05-06) — pin the photo-log error
 * contract so a future agent can't accidentally regress to the
 * pre-fix shape (Vercel timeout + swallowed catch + collapsed
 * error message → user sees only "Photo logging failed").
 *
 * The route MUST:
 *   - export `maxDuration` >= 30 so OpenAI vision has room to run.
 *   - emit a structured `{ ok: false, error: "openai_timeout" }`
 *     on slow-OpenAI (the new `AbortController` path).
 *
 * The mobile + web clients MUST:
 *   - import `AbortController` (or use a client-side timeout).
 *   - branch on the server's `error` code into differentiated
 *     user-facing messages (the `fallbackByCode` map).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("F-108 photo-log route contract", () => {
  it("exports maxDuration >= 30 (vision needs >10s headroom)", () => {
    const src = read("app/api/nutrition/photo-log/route.ts");
    const m = src.match(/export\s+const\s+maxDuration\s*=\s*(\d+)/);
    expect(m, "route must export maxDuration to override Vercel's 10s default").not.toBeNull();
    if (m) expect(Number(m[1])).toBeGreaterThanOrEqual(30);
  });

  it("uses an explicit AbortController on the AI vision fetch", () => {
    const src = read("app/api/nutrition/photo-log/route.ts");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).toMatch(/new AbortController\s*\(\)/);
  });

  it("AI timeout branch is intact (in route source OR shared aiProvider helper)", () => {
    // 2026-05-08: route migrated to Claude via the shared `callAiVision`
    // helper. The `ai_timeout` error code now lives in the helper, not
    // the route — so we assert it appears in either source so the
    // pin survives the helper extraction.
    const route = read("app/api/nutrition/photo-log/route.ts");
    const helper = read("src/lib/server/aiProvider.ts");
    const all = (route + helper).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(all).toMatch(/ai_timeout|openai_timeout/);
  });
});

describe("F-108 photo-log clients differentiate server error codes", () => {
  const CLIENTS = [
    "apps/mobile/components/PhotoLogSheet.tsx",
    "src/app/components/suppr/photo-log-dialog.tsx",
  ];
  it.each(CLIENTS)("%s maps ai_timeout / ai_http_error / file_too_large to user copy", (rel) => {
    const src = read(rel);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Vendor-neutral codes are required (Claude path). Legacy `openai_*`
    // aliases stay during the transition window but are not asserted —
    // their disappearance shouldn't break the test once cutover lands.
    for (const errCode of [
      "ai_timeout",
      "ai_network_error",
      "ai_http_error",
      "model_unparseable",
      "file_too_large",
    ]) {
      expect(code, `${rel}: missing branch for ${errCode}`).toContain(errCode);
    }
  });

  it.each(CLIENTS)("%s catches errors with a named binding (not `catch {}`)", (rel) => {
    const src = read(rel);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // Pre-fix shape was `catch {}` (no parameter, swallowed error).
    // Post-fix uses `catch (err)` so the failure is logged + named.
    expect(code).toMatch(/catch\s*\(\s*err\b/);
  });
});
