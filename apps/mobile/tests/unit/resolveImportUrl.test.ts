/**
 * ENG-981 — multi-link recipe import.
 *
 * Locks the extraction + enqueue contract for the multi-URL import path:
 *   • `extractAllHttpUrls` pulls EVERY link out of a paste/share blob, handles
 *     N links, scheme-less known hosts, trailing-punctuation strip, de-dupe,
 *     and the `BULK_PHOTO_IMPORT_MAX` cap (so one paste can't fan out unbounded
 *     paid import jobs).
 *   • `multiUrlsFromRouterParams` / `multiUrlsFromDeepLink` mirror the single
 *     resolvers but return the full deduped/capped list.
 *   • N extracted URLs → N enqueued jobs (one `url` job per link), and a
 *     duplicate link is a scheduler no-op (deterministic id), so a single and
 *     a batched import behave identically.
 *
 * `expo-linking.parse` is stubbed (same shape as `deepLinkRouting.test.ts`) so
 * the resolver runs in node/vitest without the native runtime.
 */
import { describe, expect, it, vi } from "vitest";

import {
  extractAllHttpUrls,
  multiUrlsFromDeepLink,
  multiUrlsFromRouterParams,
} from "../../lib/resolveImportUrl";
import { BULK_PHOTO_IMPORT_MAX } from "@suppr/shared/recipes/photoImport";
import { buildUrlImportJob } from "@suppr/shared/recipes/urlImportJob";
import { RecipeImportScheduler } from "@suppr/shared/recipes/recipeImportScheduler";

// `lib/resolveImportUrl` imports `expo-linking`; stub `parse` with a minimal
// URL-parser-shaped implementation (custom schemes normalise to https:).
// `vi.mock` is hoisted above the imports by Vitest, so the stub is in place
// before `resolveImportUrl` loads.
vi.mock("expo-linking", () => ({
  parse: (href: string) => {
    try {
      const normalised = href.replace(/^[a-z][a-z0-9+.-]*:/i, "https:");
      const u = new URL(normalised);
      const queryParams: Record<string, string> = {};
      u.searchParams.forEach((v, k) => {
        queryParams[k] = v;
      });
      return {
        scheme: href.split(":")[0] ?? null,
        hostname: u.hostname || null,
        path: u.pathname.replace(/^\//, "") || null,
        queryParams,
      };
    } catch {
      return { scheme: null, hostname: null, path: null, queryParams: {} };
    }
  },
}));

describe("extractAllHttpUrls", () => {
  it("returns [] for empty / whitespace / no-url text", () => {
    expect(extractAllHttpUrls("")).toEqual([]);
    expect(extractAllHttpUrls("   \n  ")).toEqual([]);
    expect(extractAllHttpUrls("just some words, no links here")).toEqual([]);
  });

  it("extracts a single http(s) URL", () => {
    expect(extractAllHttpUrls("check this https://example.com/recipe out")).toEqual([
      "https://example.com/recipe",
    ]);
  });

  it("extracts N links from one blob (in first-seen order)", () => {
    const blob = `Three to try:
      https://a.com/1
      https://b.com/2
      https://c.com/3`;
    expect(extractAllHttpUrls(blob)).toEqual([
      "https://a.com/1",
      "https://b.com/2",
      "https://c.com/3",
    ]);
  });

  it("strips trailing punctuation a share/caption blob appends", () => {
    expect(
      extractAllHttpUrls("Loved (https://example.com/r), and https://other.com/x!"),
    ).toEqual(["https://example.com/r", "https://other.com/x"]);
  });

  it("de-dupes the same link (after trailing-punct strip)", () => {
    const blob = "https://example.com/r https://example.com/r, https://example.com/r.";
    expect(extractAllHttpUrls(blob)).toEqual(["https://example.com/r"]);
  });

  it("recognises scheme-less known hosts and normalises them to https", () => {
    expect(extractAllHttpUrls("instagram.com/reel/abc and tiktok.com/@chef/video/9")).toEqual([
      "https://instagram.com/reel/abc",
      "https://tiktok.com/@chef/video/9",
    ]);
  });

  it("caps the result at BULK_PHOTO_IMPORT_MAX", () => {
    const many = Array.from({ length: BULK_PHOTO_IMPORT_MAX + 5 }, (_, i) => `https://x.com/${i}`);
    const out = extractAllHttpUrls(many.join("\n"));
    expect(out).toHaveLength(BULK_PHOTO_IMPORT_MAX);
    expect(out[0]).toBe("https://x.com/0");
    expect(out[BULK_PHOTO_IMPORT_MAX - 1]).toBe(`https://x.com/${BULK_PHOTO_IMPORT_MAX - 1}`);
  });
});

describe("multiUrlsFromRouterParams", () => {
  it("returns every link across the recognised keys, deduped", () => {
    expect(
      multiUrlsFromRouterParams({
        url: "https://a.com/1",
        text: "https://b.com/2 https://a.com/1",
      }),
    ).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("returns multiple links carried inside a single `text` blob", () => {
    expect(
      multiUrlsFromRouterParams({ text: "https://a.com/1\nhttps://b.com/2" }),
    ).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("returns [] when no recognised key carries a URL", () => {
    expect(multiUrlsFromRouterParams({ foo: "bar" })).toEqual([]);
  });
});

describe("multiUrlsFromDeepLink", () => {
  it("extracts every link from a query param blob", () => {
    const href = `suppr://import-shared?text=${encodeURIComponent(
      "https://a.com/1 https://b.com/2",
    )}`;
    expect(multiUrlsFromDeepLink(href)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("returns [] for an empty href", () => {
    expect(multiUrlsFromDeepLink("")).toEqual([]);
    expect(multiUrlsFromDeepLink(null)).toEqual([]);
  });
});

describe("multi-URL → one enqueued job per link", () => {
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));

  const land = async () => {};
  const jobFor = (url: string) =>
    buildUrlImportJob<{ title?: string }>(url, {
      fetchRecipe: async () => ({ recipe: { title: "r" } }),
      land,
      titleOf: (r) => r.title,
    });

  it("enqueues N jobs for N distinct URLs", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 2 });
    const urls = extractAllHttpUrls("https://a.com/1 https://b.com/2 https://c.com/3");
    expect(urls).toHaveLength(3);

    // Snapshot BEFORE any runner settles: 2 occupy slots, 1 queued = 3 live.
    let added = 0;
    for (const u of urls) if (scheduler.enqueue(jobFor(u))) added += 1;
    expect(added).toBe(3);
    expect(scheduler.activeCount() + scheduler.queuedCount()).toBe(3);

    // After the runners settle, all 3 remain listed (now terminal).
    await flush();
    expect(scheduler.getSnapshot()).toHaveLength(3);
  });

  it("a duplicate link is a scheduler no-op (deterministic id)", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 2 });
    const urls = extractAllHttpUrls("https://a.com/1 https://a.com/1, https://a.com/1.");
    expect(urls).toHaveLength(1); // extract already de-dupes

    // Even if a caller enqueues the same URL twice, the id dedupes it.
    const first = scheduler.enqueue(jobFor("https://a.com/1"));
    const second = scheduler.enqueue(jobFor("https://a.com/1"));
    await flush();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(scheduler.getSnapshot()).toHaveLength(1);
  });
});
