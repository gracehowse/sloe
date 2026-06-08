/**
 * Tests for the Supadata acquisition client (ENG-994) — SERVER-ONLY.
 *
 * All fetch is mocked via the `fetchImpl` injection point — NO live Supadata
 * API calls. Behaviour pins:
 *   - scrape shape parsing (content/markdown/title/description/image/urls)
 *   - transcript shape parsing (string + segmented array, lang, availableLangs)
 *   - the `x-api-key` header carries `process.env.SUPADATA_KEY`
 *   - `lang=en` is pinned by default (API defaults to `de`); overridable
 *   - YouTube routes to `/youtube/transcript`, other to `/transcript`
 *   - 429 → typed `supadata_rate_limited`, NOT retried, Retry-After parsed
 *   - 5xx → retried then typed `supadata_http_error`
 *   - network error / timeout → retried then `supadata_network_error`
 *   - missing key → `supadata_not_configured`, no fetch
 *   - 2xx empty body → `supadata_empty`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  scrapeUrl,
  fetchTranscript,
  hasSupadataConfig,
  type FetchLike,
} from "../../src/lib/server/supadata/client";

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return {
    status: init?.status ?? 200,
    headers: {
      get: (k: string) => init?.headers?.[k.toLowerCase()] ?? init?.headers?.[k] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}

const ORIGINAL_KEY = process.env.SUPADATA_KEY;

beforeEach(() => {
  process.env.SUPADATA_KEY = "sd_test_key";
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SUPADATA_KEY;
  else process.env.SUPADATA_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
});

describe("hasSupadataConfig", () => {
  it("true when key set, false when empty/missing", () => {
    process.env.SUPADATA_KEY = "sd_x";
    expect(hasSupadataConfig()).toBe(true);
    process.env.SUPADATA_KEY = "   ";
    expect(hasSupadataConfig()).toBe(false);
    delete process.env.SUPADATA_KEY;
    expect(hasSupadataConfig()).toBe(false);
  });
});

describe("scrapeUrl", () => {
  it("sends x-api-key header and hits /web/scrape with the url", async () => {
    let seenUrl = "";
    let seenHeaders: Record<string, string> | undefined;
    const fetchImpl: FetchLike = vi.fn(async (url, init) => {
      seenUrl = url;
      seenHeaders = init?.headers;
      return jsonResponse({ content: "Recipe text", title: "Cake", description: "Yum" });
    });
    const res = await scrapeUrl("https://example.com/recipe", { fetchImpl });
    expect(res.ok).toBe(true);
    expect(seenUrl).toContain("https://api.supadata.ai/v1/web/scrape");
    expect(seenUrl).toContain("url=https%3A%2F%2Fexample.com%2Frecipe");
    expect(seenHeaders?.["x-api-key"]).toBe("sd_test_key");
  });

  it("normalises content/markdown/title/description/image/urls", async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse({
        markdown: "## Ingredients\n200g flour",
        name: "Bread",
        description: "Crusty",
        ogImage: "https://cdn/x.jpg",
        links: ["https://a.com", "  ", 42],
      }),
    );
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.content).toBe("## Ingredients\n200g flour");
    expect(res.data.title).toBe("Bread");
    expect(res.data.description).toBe("Crusty");
    expect(res.data.image).toBe("https://cdn/x.jpg");
    expect(res.data.urls).toEqual(["https://a.com"]);
  });

  it("2xx with no usable content → supadata_empty", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ urls: [] }));
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_empty");
  });

  it("429 → supadata_rate_limited, NOT retried, Retry-After parsed", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({}, { status: 429, headers: { "retry-after": "120" } }),
    );
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_rate_limited");
    expect(res.retryAfterSec).toBe(120);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no retry on 429
  });

  it("5xx is retried, then surfaces supadata_http_error", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}, { status: 503 }));
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_http_error");
    expect(res.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // 1 + 1 retry
  });

  it("4xx (non-429) is NOT retried → supadata_http_error", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}, { status: 400 }));
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_http_error");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("network error is retried, then surfaces supadata_network_error", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new Error("ECONNRESET");
    });
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_network_error");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("AbortError (timeout) maps to supadata_network_error", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_network_error");
    expect(res.detail).toContain("timed out");
  });

  it("missing key → supadata_not_configured, no fetch", async () => {
    delete process.env.SUPADATA_KEY;
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}));
    const res = await scrapeUrl("https://example.com", { fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("fetchTranscript", () => {
  it("pins lang=en by default and sends x-api-key", async () => {
    let seenUrl = "";
    let seenHeaders: Record<string, string> | undefined;
    const fetchImpl: FetchLike = vi.fn(async (url, init) => {
      seenUrl = url;
      seenHeaders = init?.headers;
      return jsonResponse({ content: "mix and bake", lang: "en", availableLangs: ["en", "de"] });
    });
    const res = await fetchTranscript("https://youtu.be/abc", { isYouTube: true, fetchImpl });
    expect(res.ok).toBe(true);
    expect(seenUrl).toContain("lang=en");
    expect(seenHeaders?.["x-api-key"]).toBe("sd_test_key");
  });

  it("YouTube routes to /youtube/transcript", async () => {
    let seenUrl = "";
    const fetchImpl: FetchLike = vi.fn(async (url) => {
      seenUrl = url;
      return jsonResponse({ content: "x" });
    });
    await fetchTranscript("https://youtube.com/watch?v=1", { isYouTube: true, fetchImpl });
    expect(seenUrl).toContain("/youtube/transcript");
    expect(seenUrl).not.toMatch(/\/v1\/transcript\?/); // not the bare generic endpoint
  });

  it("non-YouTube routes to /transcript", async () => {
    let seenUrl = "";
    const fetchImpl: FetchLike = vi.fn(async (url) => {
      seenUrl = url;
      return jsonResponse({ content: "x" });
    });
    await fetchTranscript("https://tiktok.com/@u/video/1", { isYouTube: false, fetchImpl });
    expect(seenUrl).toMatch(/\/v1\/transcript\?/);
  });

  it("allows a lang override (e.g. picked from availableLangs)", async () => {
    let seenUrl = "";
    const fetchImpl: FetchLike = vi.fn(async (url) => {
      seenUrl = url;
      return jsonResponse({ content: "x", lang: "es" });
    });
    await fetchTranscript("https://youtu.be/1", { isYouTube: true, lang: "es", fetchImpl });
    expect(seenUrl).toContain("lang=es");
  });

  it("flattens a segmented transcript array into one string", async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse({
        content: [{ text: "first" }, { text: "second" }, "third"],
        lang: "en",
        availableLangs: ["en"],
      }),
    );
    const res = await fetchTranscript("https://youtu.be/1", { isYouTube: true, fetchImpl });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.content).toBe("first second third");
    expect(res.data.lang).toBe("en");
    expect(res.data.availableLangs).toEqual(["en"]);
  });

  it("empty transcript → supadata_empty", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ content: "", availableLangs: ["en"] }));
    const res = await fetchTranscript("https://youtu.be/1", { isYouTube: true, fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_empty");
  });

  it("429 on transcript is not retried", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({}, { status: 429 }));
    const res = await fetchTranscript("https://youtu.be/1", { isYouTube: true, fetchImpl });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("supadata_rate_limited");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
