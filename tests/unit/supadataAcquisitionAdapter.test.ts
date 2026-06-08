/**
 * Tests for the swappable recipe-import acquisition adapter (ENG-994).
 *
 * All fetch is mocked via the `fetchImpl` injection point — NO live API calls.
 * Behaviour pins:
 *   - platform routing: youtube/tiktok/instagram → transcript; blog → scrape
 *   - IG/TT transcript acquisition is BLOCKED (`blocked_by_policy`) while the
 *     `IG_TT_IMPORT_ENABLED` legal flag is off (legal posture 2026-04-30);
 *     allowed when the flag is on
 *   - YouTube transcript is NOT gated by the IG/TT flag
 *   - error mapping (rate_limited / empty / error / not_configured)
 *   - SSRF allowlist rejects private hosts before hitting the vendor
 *   - the adapter is swappable (`setAcquisitionAdapter`) and resettable
 *   - `acquireRecipeSource` short-circuits when the adapter isn't configured
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireRecipeSource,
  setAcquisitionAdapter,
  resetAcquisitionAdapter,
  supadataAdapter,
  type AcquisitionAdapter,
} from "../../src/lib/server/supadata/acquisitionAdapter";
import type { FetchLike } from "../../src/lib/server/supadata/client";

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return {
    status: init?.status ?? 200,
    headers: { get: (k: string) => init?.headers?.[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

const ORIGINAL_KEY = process.env.SUPADATA_KEY;
const ORIGINAL_FLAG = process.env.IG_TT_IMPORT_ENABLED;

beforeEach(() => {
  process.env.SUPADATA_KEY = "sd_test_key";
  delete process.env.IG_TT_IMPORT_ENABLED; // legal flag OFF by default
  resetAcquisitionAdapter();
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SUPADATA_KEY;
  else process.env.SUPADATA_KEY = ORIGINAL_KEY;
  if (ORIGINAL_FLAG === undefined) delete process.env.IG_TT_IMPORT_ENABLED;
  else process.env.IG_TT_IMPORT_ENABLED = ORIGINAL_FLAG;
  resetAcquisitionAdapter();
  vi.restoreAllMocks();
});

describe("acquireRecipeSource — platform routing", () => {
  it("blog URL → scrape", async () => {
    let seenUrl = "";
    const fetchImpl: FetchLike = vi.fn(async (url) => {
      seenUrl = url;
      return jsonResponse({ content: "200g flour", title: "Bread" });
    });
    const res = await acquireRecipeSource("https://smittenkitchen.com/bread", { fetchImpl });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.kind).toBe("scrape");
    expect(res.data.platform).toBe("blog");
    expect(res.data.content).toBe("200g flour");
    expect(seenUrl).toContain("/web/scrape");
  });

  it("YouTube URL → transcript (not gated by IG/TT flag)", async () => {
    let seenUrl = "";
    const fetchImpl: FetchLike = vi.fn(async (url) => {
      seenUrl = url;
      return jsonResponse({ content: "mix and bake", lang: "en" });
    });
    const res = await acquireRecipeSource("https://youtu.be/abc123", { fetchImpl });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.kind).toBe("transcript");
    expect(res.data.platform).toBe("youtube");
    expect(seenUrl).toContain("/youtube/transcript");
  });
});

describe("acquireRecipeSource — IG/TT legal gating", () => {
  it("TikTok transcript BLOCKED while IG_TT_IMPORT_ENABLED off", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ content: "x" }));
    const res = await acquireRecipeSource("https://www.tiktok.com/@u/video/1", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("blocked_by_policy");
    expect(fetchImpl).not.toHaveBeenCalled(); // never hits the vendor
  });

  it("Instagram transcript BLOCKED while flag off", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ content: "x" }));
    const res = await acquireRecipeSource("https://www.instagram.com/reel/abc/", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("blocked_by_policy");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("TikTok transcript ALLOWED when flag on", async () => {
    process.env.IG_TT_IMPORT_ENABLED = "true";
    let seenUrl = "";
    const fetchImpl: FetchLike = vi.fn(async (url) => {
      seenUrl = url;
      return jsonResponse({ content: "step one", lang: "en" });
    });
    const res = await acquireRecipeSource("https://www.tiktok.com/@u/video/1", { fetchImpl });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.kind).toBe("transcript");
    expect(res.data.platform).toBe("tiktok");
    expect(seenUrl).toMatch(/\/v1\/transcript\?/); // generic endpoint, not /youtube/
  });
});

describe("acquireRecipeSource — error mapping + guards", () => {
  it("vendor 429 → rate_limited with retryAfter", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({}, { status: 429, headers: { "retry-after": "60" } }),
    );
    const res = await acquireRecipeSource("https://example.com/recipe", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("rate_limited");
    expect(res.retryAfterSec).toBe(60);
  });

  it("vendor 5xx → error", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}, { status: 502 }));
    const res = await acquireRecipeSource("https://example.com/recipe", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("error");
  });

  it("empty scrape → empty", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}));
    const res = await acquireRecipeSource("https://example.com/recipe", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("empty");
  });

  it("missing key → not_configured, no fetch", async () => {
    delete process.env.SUPADATA_KEY;
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}));
    const res = await acquireRecipeSource("https://example.com/recipe", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("private/SSRF host → error, never hits vendor", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ content: "x" }));
    const res = await acquireRecipeSource("http://169.254.169.254/latest/meta-data", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("acquisition adapter is swappable", () => {
  it("setAcquisitionAdapter routes acquire to the injected adapter", async () => {
    const stub: AcquisitionAdapter = {
      name: "supadata",
      isConfigured: () => true,
      acquire: vi.fn(async () => ({
        ok: true as const,
        data: {
          content: "from stub",
          source: "supadata" as const,
          kind: "scrape" as const,
          platform: "blog" as const,
          title: null,
          description: null,
          image: null,
        },
      })),
    };
    setAcquisitionAdapter(stub);
    const res = await acquireRecipeSource("https://example.com/recipe");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.content).toBe("from stub");
    expect(stub.acquire).toHaveBeenCalledOnce();
  });

  it("short-circuits to not_configured when the active adapter is unconfigured", async () => {
    setAcquisitionAdapter({
      name: "supadata",
      isConfigured: () => false,
      acquire: vi.fn(),
    });
    const res = await acquireRecipeSource("https://example.com/recipe");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_configured");
  });

  it("the default adapter is the Supadata adapter", () => {
    expect(supadataAdapter.name).toBe("supadata");
  });
});
