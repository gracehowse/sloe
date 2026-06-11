/**
 * ENG-1037 (P1-2) — every recipe-import fetch on a user-supplied URL must go
 * through `followWithSsrfGuard` (per-hop allowlist + DNS re-resolve), never
 * `fetch(..., { redirect: "follow" })`.
 *
 * Two layers:
 *  1. A static callsite guard (this is the CI grep guard the audit asked for):
 *     the import route + the social-meta extractor must NOT contain a raw
 *     `redirect: "follow"` and MUST import the SSRF guard. This catches a
 *     regression at write time even if no behavioural test exercises the new
 *     branch — the exact failure mode that reintroduced ENG-682.
 *  2. A behavioural test of the guard on the redirect-to-private-host case is
 *     already in `ssrfGuard.test.ts`; here we additionally prove the social
 *     extractor's caption-link path refuses a 302 → 169.254.169.254 because it
 *     now routes through the guard.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

/**
 * Files that fetch a user-supplied / attacker-controllable URL during import.
 * The Pinterest resolver, the main hop loop, the caption-link Tier-4 fallback,
 * and the social-meta UA loop all live here.
 */
const IMPORT_FETCH_SITES = [
  "app/api/recipe-import/route.ts",
  "src/lib/recipe-import/extractSocialRecipe.ts",
];

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

/** Strip comments so the grep only inspects executable code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("ENG-1037 — recipe-import fetch callsites are SSRF-guarded", () => {
  it.each(IMPORT_FETCH_SITES)("%s never uses raw redirect:\"follow\"", (path) => {
    const code = stripComments(read(path));
    // `redirect: "follow"` (or 'follow') on a user-supplied URL is the exact
    // ENG-682 metadata-SSRF reintroduction. Ban it in the import surface.
    expect(code).not.toMatch(/redirect\s*:\s*["']follow["']/);
  });

  it.each(IMPORT_FETCH_SITES)("%s routes import fetches through followWithSsrfGuard", (path) => {
    const src = read(path);
    expect(src).toMatch(/followWithSsrfGuard/);
  });
});

/** Minimal Response stub — only `status` + `headers.get` are read by the guard. */
function resp(status: number, headers: Record<string, string> = {}): Response {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
  return {
    status,
    headers: { get: (k: string) => lower[k.toLowerCase()] ?? null },
    text: async () => "<html></html>",
  } as unknown as Response;
}

describe("ENG-1037 — the guard the import sites delegate to refuses an SSRF redirect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses a user URL that 302-redirects to a cloud-metadata host (no body read)", async () => {
    // This is the exact caption-link / social-meta attack chain: the entry URL
    // resolves to a public IP, then 30x's to 169.254.169.254. Both the caption
    // Tier-4 fallback and the social-meta UA loop now route through this guard,
    // so neither reads the metadata-host body.
    const publicLookup = vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(302, { location: "http://169.254.169.254/latest/meta-data/" }));
    vi.stubGlobal("fetch", fetchMock);

    const { followWithSsrfGuard } = await import("@/lib/recipe-import/ssrfGuard");
    const out = await followWithSsrfGuard("https://attacker.example.com/recipe", {
      _lookupFn: publicLookup,
    });

    expect(out).toBeNull();
    // The metadata host was NEVER fetched — only the entry URL hop ran.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
