/**
 * ENG-981 — shared URL-import job builder + multi-link extraction.
 *
 * `urlImportJob.ts` is the single source of truth for (a) pulling EVERY link
 * out of a paste/share blob (`extractAllHttpUrls`) and (b) the one-URL-per-job
 * `EnqueueSpec` (`buildUrlImportJob`) that BOTH web (`RecipeUpload`) and mobile
 * (`import-shared`) enqueue. These tests protect the web side of the contract
 * and the cross-platform job shape:
 *   • extraction handles N links, scheme-less known hosts, trailing-punct
 *     strip, de-dupe, and the `BULK_PHOTO_IMPORT_MAX` cap
 *   • the built job seeds a host title, runs extracting→organizing, lands the
 *     recipe, and resolves with the recipe title
 *   • N extracted URLs → N enqueued jobs; a duplicate id is a no-op
 */
import { describe, it, expect } from "vitest";

import { BULK_PHOTO_IMPORT_MAX } from "@/lib/recipes/photoImport";
import { buildUrlImportJob, extractAllHttpUrls, seedTitleForUrl } from "@/lib/recipes/urlImportJob";
import {
  RecipeImportScheduler,
  type ImportRunnerControls,
} from "@/lib/recipes/recipeImportScheduler";

describe("extractAllHttpUrls (web)", () => {
  it("returns [] for empty / no-url text", () => {
    expect(extractAllHttpUrls("")).toEqual([]);
    expect(extractAllHttpUrls("no links here")).toEqual([]);
  });

  it("extracts N links in first-seen order", () => {
    expect(
      extractAllHttpUrls("https://a.com/1 https://b.com/2 https://c.com/3"),
    ).toEqual(["https://a.com/1", "https://b.com/2", "https://c.com/3"]);
  });

  it("strips trailing punctuation and de-dupes", () => {
    expect(
      extractAllHttpUrls("(https://a.com/r), https://a.com/r. https://b.com/x!"),
    ).toEqual(["https://a.com/r", "https://b.com/x"]);
  });

  it("normalises scheme-less known hosts to https", () => {
    expect(extractAllHttpUrls("instagram.com/reel/abc tiktok.com/@c/video/9")).toEqual([
      "https://instagram.com/reel/abc",
      "https://tiktok.com/@c/video/9",
    ]);
  });

  it("caps at BULK_PHOTO_IMPORT_MAX", () => {
    const many = Array.from({ length: BULK_PHOTO_IMPORT_MAX + 4 }, (_, i) => `https://x.com/${i}`);
    expect(extractAllHttpUrls(many.join(" "))).toHaveLength(BULK_PHOTO_IMPORT_MAX);
  });
});

describe("seedTitleForUrl", () => {
  it("uses the bare host (www stripped)", () => {
    expect(seedTitleForUrl("https://www.example.com/r")).toBe("example.com");
  });
  it("falls back to 'Recipe' for an unparseable url", () => {
    expect(seedTitleForUrl("not a url")).toBe("Recipe");
  });
});

describe("buildUrlImportJob — job shape", () => {
  it("runs extracting→organizing, lands the recipe, resolves with its title", async () => {
    const stages: string[] = [];
    const landed: string[] = [];
    const spec = buildUrlImportJob<{ title?: string }>("https://example.com/r", {
      fetchRecipe: async () => ({ recipe: { title: "Tomato soup" }, imageUsed: true }),
      land: async (recipe) => {
        landed.push(recipe.title ?? "");
      },
      titleOf: (r) => r.title,
    });

    expect(spec.kind).toBe("url");
    expect(spec.title).toBe("example.com");

    const controls: ImportRunnerControls = {
      setStage: (s) => stages.push(s),
      setTitle: () => {},
      signal: new AbortController().signal,
      isCancelled: () => false,
    };
    const result = await spec.run(controls);

    expect(stages).toEqual(["extracting", "organizing"]);
    expect(landed).toEqual(["Tomato soup"]);
    expect(result.title).toBe("Tomato soup");
  });
});

describe("multi-URL → one enqueued job per link (web)", () => {
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));
  const jobFor = (url: string) =>
    buildUrlImportJob<{ title?: string }>(url, {
      fetchRecipe: async () => ({ recipe: { title: "r" } }),
      land: async () => {},
      titleOf: (r) => r.title,
    });

  it("enqueues N jobs for N URLs", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 2 });
    const urls = extractAllHttpUrls("https://a.com/1 https://b.com/2 https://c.com/3");
    expect(urls).toHaveLength(3);

    const added = urls.map((u) => scheduler.enqueue(jobFor(u)));
    expect(added).toEqual([true, true, true]);
    expect(scheduler.activeCount() + scheduler.queuedCount()).toBe(3);

    await flush();
    expect(scheduler.getSnapshot()).toHaveLength(3);
  });

  it("a duplicate url id is a no-op", async () => {
    const scheduler = new RecipeImportScheduler({ concurrency: 2 });
    expect(scheduler.enqueue(jobFor("https://a.com/1"))).toBe(true);
    expect(scheduler.enqueue(jobFor("https://a.com/1"))).toBe(false);
    await flush();
    expect(scheduler.getSnapshot()).toHaveLength(1);
  });
});
