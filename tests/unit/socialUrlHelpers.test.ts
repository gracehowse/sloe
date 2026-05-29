import { describe, expect, it } from "vitest";

import {
  instagramHandleFromPostUrl,
  stripSectionPrefix,
  tiktokHandleFromPostUrl,
} from "../../src/lib/recipe-import/socialUrlHelpers";

describe("instagramHandleFromPostUrl", () => {
  it("extracts @handle from /HANDLE/reel/… URLs", () => {
    expect(instagramHandleFromPostUrl("https://www.instagram.com/chefmaria/reel/ABC123/")).toBe(
      "@chefmaria",
    );
  });

  it("returns null for reserved path segments", () => {
    expect(instagramHandleFromPostUrl("https://www.instagram.com/explore/tags/food/")).toBeNull();
  });
});

describe("tiktokHandleFromPostUrl", () => {
  it("extracts @handle from TikTok video URLs", () => {
    expect(tiktokHandleFromPostUrl("https://www.tiktok.com/@weeknightcook/video/7300")).toBe(
      "@weeknightcook",
    );
  });

  it("returns null for invalid URLs", () => {
    expect(tiktokHandleFromPostUrl("not-a-url")).toBeNull();
  });
});

describe("stripSectionPrefix", () => {
  it("removes a leading For …: section prefix", () => {
    expect(stripSectionPrefix("For the sauce: 2 tbsp olive oil")).toBe("2 tbsp olive oil");
  });

  it("leaves strings without the prefix unchanged", () => {
    expect(stripSectionPrefix("2 tbsp olive oil")).toBe("2 tbsp olive oil");
  });
});
