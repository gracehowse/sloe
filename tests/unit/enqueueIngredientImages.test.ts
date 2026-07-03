/**
 * `enqueueIngredientImages` — shared lazy generate-on-miss enqueue (Sloe
 * image system §4, 2026-06-08). Used identically by web + mobile; the
 * behaviour (dedupe by canonical key, session in-flight guard, fire-and-
 * forget, never-throw, release-on-failure) lives here so it can't drift.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  enqueueIngredientImages,
  __resetEnqueuedKeysForTest,
} from "../../src/lib/recipe/enqueueIngredientImages";
import { canonicalImageKey } from "../../src/lib/recipe/canonicalImageKey";

beforeEach(() => {
  __resetEnqueuedKeysForTest();
});

describe("enqueueIngredientImages", () => {
  it("posts the raw names and returns the canonical keys enqueued", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const newKeys = enqueueIngredientImages(["120g spinach", "fine salt"], post);
    expect(newKeys).toContain(canonicalImageKey("spinach"));
    expect(newKeys).toContain(canonicalImageKey("salt"));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({ names: ["120g spinach", "fine salt"] });
  });

  it("dedupes quantity/brand variants into one canonical key", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const newKeys = enqueueIngredientImages(
      ["120g spinach", "120 grams spinach", "baby spinach"],
      post,
    );
    // three variants → one key, one name sent
    expect(newKeys).toEqual([canonicalImageKey("spinach")]);
    const sent = post.mock.calls[0]![0] as { names: string[] };
    expect(sent.names.length).toBe(1);
  });

  it("does not re-post a key already enqueued this session", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    enqueueIngredientImages(["120g spinach"], post);
    // second call for the same canonical key → no new post
    const second = enqueueIngredientImages(["baby spinach", "fine salt"], post);
    expect(second).toEqual([canonicalImageKey("salt")]); // only salt is new
    expect(post).toHaveBeenCalledTimes(2);
    const secondSent = post.mock.calls[1]![0] as { names: string[] };
    expect(secondSent.names).toEqual(["fine salt"]);
  });

  it("no-ops (does not call post) when nothing is new", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    enqueueIngredientImages(["spinach"], post);
    post.mockClear();
    const out = enqueueIngredientImages(["spinach", "  ", "", null], post);
    expect(out).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it("never throws when post rejects, and releases the keys for a retry", async () => {
    const post = vi.fn().mockRejectedValue(new Error("network"));
    // synchronous call must not throw even though post rejects
    expect(() => enqueueIngredientImages(["spinach"], post)).not.toThrow();
    // let the rejection settle + the release run
    await new Promise((r) => setTimeout(r, 0));
    // after a failed post, the key is released → a later enqueue retries
    const retryPost = vi.fn().mockResolvedValue(undefined);
    const out = enqueueIngredientImages(["spinach"], retryPost);
    expect(out).toEqual([canonicalImageKey("spinach")]);
    expect(retryPost).toHaveBeenCalledTimes(1);
  });

  it("skips empty / letterless names", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const out = enqueueIngredientImages(["", "   ", null, undefined], post);
    expect(out).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  // ── ENG-1276 alias forwarding ──

  it("omits the aliases field entirely when none are passed (unchanged body)", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    enqueueIngredientImages(["spinach"], post);
    expect(post).toHaveBeenCalledWith({ names: ["spinach"] });
  });

  it("forwards aliases for names being sent, deduped by alias key", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    enqueueIngredientImages(
      ["120g baby spinach", "chicken breast"],
      post,
      [
        { name: "120g baby spinach", aliasKey: "fatsecret:4001" },
        { name: "chicken breast", aliasKey: "usda:999" },
      ],
    );
    const body = post.mock.calls[0]![0] as {
      names: string[];
      aliases?: Array<{ name: string; aliasKey: string }>;
    };
    expect(body.aliases).toEqual([
      { name: "120g baby spinach", aliasKey: "fatsecret:4001" },
      { name: "chicken breast", aliasKey: "usda:999" },
    ]);
  });

  it("drops aliases whose name is not in this call's send set", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    // Only "spinach" is new/sent; the "salt" alias must be filtered out.
    enqueueIngredientImages(
      ["spinach"],
      post,
      [
        { name: "spinach", aliasKey: "fatsecret:4001" },
        { name: "salt", aliasKey: "fatsecret:5000" },
      ],
    );
    const body = post.mock.calls[0]![0] as {
      aliases?: Array<{ name: string; aliasKey: string }>;
    };
    expect(body.aliases).toEqual([{ name: "spinach", aliasKey: "fatsecret:4001" }]);
  });

  it("omits the aliases field when the provided aliases are all empty/blank", () => {
    const post = vi.fn().mockResolvedValue(undefined);
    enqueueIngredientImages(["spinach"], post, [
      { name: "spinach", aliasKey: "  " },
      { name: "", aliasKey: "fatsecret:1" },
    ]);
    expect(post).toHaveBeenCalledWith({ names: ["spinach"] });
  });
});
