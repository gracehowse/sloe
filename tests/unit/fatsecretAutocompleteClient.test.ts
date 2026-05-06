/**
 * Tests for the shared FatSecret-autocomplete fetch helper used by
 * both web + mobile FoodSearchPanels.
 *
 * Behaviour pins:
 *   - Empty query → resolves immediately to { tier: "basic", suggestions: [] }
 *   - Premier-tier 200 → tier passes through, suggestions filtered to
 *     non-empty strings only.
 *   - Basic-tier 200 → suggestions stays empty (server short-circuits).
 *   - 4xx / 5xx / network error → falls back silently to
 *     { tier: "basic", suggestions: [] } (never throws).
 *   - URL encoding of the query.
 *   - max_results clamping at the helper layer (1..10).
 *   - AbortSignal cancels the in-flight request.
 */
import { describe, expect, it, vi } from "vitest";
import { fetchFatSecretAutocomplete } from "../../src/lib/nutrition/fatsecretAutocompleteClient";

describe("fetchFatSecretAutocomplete", () => {
  it("returns empty result without calling fetch on empty query", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchFatSecretAutocomplete("   ", { fetchImpl });
    expect(result).toEqual({ tier: "basic", suggestions: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns Premier suggestions on 200 + tier=premier", async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            tier: "premier",
            suggestions: ["whole milk", "skim milk", "almond milk"],
          }),
        }) as Response,
    );
    const result = await fetchFatSecretAutocomplete("milk", { fetchImpl });
    expect(result.tier).toBe("premier");
    expect(result.suggestions).toEqual(["whole milk", "skim milk", "almond milk"]);
  });

  it("filters non-string entries", async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            tier: "premier",
             
            suggestions: ["whole milk", 42, null, "skim milk", ""] as any,
          }),
        }) as Response,
    );
    const result = await fetchFatSecretAutocomplete("milk", { fetchImpl });
    expect(result.suggestions).toEqual(["whole milk", "skim milk"]);
  });

  it("returns empty list on Basic tier", async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, tier: "basic", suggestions: [] }),
        }) as Response,
    );
    const result = await fetchFatSecretAutocomplete("milk", { fetchImpl });
    expect(result).toEqual({ tier: "basic", suggestions: [] });
  });

  it("falls back to basic+empty on a 5xx response", async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 502, json: async () => ({}) }) as Response,
    );
    const result = await fetchFatSecretAutocomplete("milk", { fetchImpl });
    expect(result).toEqual({ tier: "basic", suggestions: [] });
  });

  it("falls back to basic+empty when fetch throws (network error)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await fetchFatSecretAutocomplete("milk", { fetchImpl });
    expect(result).toEqual({ tier: "basic", suggestions: [] });
  });

  it("URL-encodes the query and includes max param", async () => {
    let capturedUrl = "";
    const fetchImpl = vi.fn(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, tier: "basic", suggestions: [] }),
      } as Response;
    });
    await fetchFatSecretAutocomplete("dark chocolate & cocoa", {
      fetchImpl,
      maxResults: 5,
    });
    expect(capturedUrl).toContain("q=dark%20chocolate%20%26%20cocoa");
    expect(capturedUrl).toContain("max=5");
  });

  it("clamps maxResults to [1, 10]", async () => {
    const captured: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      captured.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, tier: "basic", suggestions: [] }),
      } as Response;
    });
    await fetchFatSecretAutocomplete("milk", { fetchImpl, maxResults: 100 });
    expect(captured.at(-1)!).toContain("max=10");
    await fetchFatSecretAutocomplete("milk", { fetchImpl, maxResults: 0 });
    expect(captured.at(-1)!).toContain("max=1");
  });

  it("propagates AbortSignal through the fetch call", async () => {
    const ctl = new AbortController();
    let signalSeen: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      signalSeen = init?.signal as AbortSignal | undefined;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, tier: "basic", suggestions: [] }),
      } as Response;
    });
    await fetchFatSecretAutocomplete("milk", { fetchImpl, signal: ctl.signal });
    expect(signalSeen).toBe(ctl.signal);
  });

  it("falls back when ok: false envelope returned with status 200", async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ ok: false, error: "missing_q" }),
        }) as Response,
    );
    const result = await fetchFatSecretAutocomplete("milk", { fetchImpl });
    expect(result).toEqual({ tier: "basic", suggestions: [] });
  });
});
