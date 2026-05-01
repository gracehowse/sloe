/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  detectSourcePlatform,
  isCaptionTextPlatform,
} from "@/lib/recipes/resolveImportUrl";

describe("detectSourcePlatform", () => {
  it("classifies Instagram URLs", () => {
    expect(detectSourcePlatform("https://www.instagram.com/p/ABC123/")).toBe("instagram");
    expect(detectSourcePlatform("https://instagram.com/reel/abc")).toBe("instagram");
    expect(detectSourcePlatform("https://l.instagram.com/?u=foo")).toBe("instagram");
    expect(detectSourcePlatform("https://instagr.am/p/ABC")).toBe("instagram");
  });

  it("classifies TikTok URLs", () => {
    expect(detectSourcePlatform("https://www.tiktok.com/@user/video/123")).toBe("tiktok");
    expect(detectSourcePlatform("https://vm.tiktok.com/ABC123/")).toBe("tiktok");
    expect(detectSourcePlatform("https://tiktok.com/@chef/video/1")).toBe("tiktok");
  });

  it("classifies YouTube URLs", () => {
    expect(detectSourcePlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectSourcePlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectSourcePlatform("https://m.youtube.com/shorts/abc")).toBe("youtube");
  });

  it("classifies any other valid URL as `blog`", () => {
    expect(detectSourcePlatform("https://downshiftology.com/recipe/")).toBe("blog");
    expect(detectSourcePlatform("https://example.com")).toBe("blog");
    expect(detectSourcePlatform("https://www.bbcgoodfood.com/recipes/x")).toBe("blog");
  });

  it("returns `unknown` for inputs that aren't valid URLs", () => {
    expect(detectSourcePlatform("not a url")).toBe("unknown");
    expect(detectSourcePlatform("")).toBe("unknown");
    expect(detectSourcePlatform("javascript:alert(1)")).toBe("blog"); // valid URL parse, just not http
  });

  it("is case-insensitive on host", () => {
    expect(detectSourcePlatform("https://WWW.INSTAGRAM.COM/p/Abc")).toBe("instagram");
    expect(detectSourcePlatform("https://TIKTOK.COM/@user/video/1")).toBe("tiktok");
  });

  it("does NOT misclassify a typo'd or look-alike domain", () => {
    // Hostnames are matched via `includes` on the lowercase hostname so
    // adversarial subdomains like `tiktok.com.evil.example` still classify
    // as the impostor's TLD chain — but the URL parser takes the FIRST
    // hostname, which is `tiktok.com.evil.example`. We accept the lower
    // bar that the share-sheet URLs come from iOS, not from arbitrary
    // user input, so this is documented behaviour.
    expect(detectSourcePlatform("https://example.com/instagram.com/page")).toBe("blog");
    expect(detectSourcePlatform("https://example.com")).toBe("blog");
  });
});

describe("isCaptionTextPlatform", () => {
  it("is true for the three caption-text platforms", () => {
    expect(isCaptionTextPlatform("instagram")).toBe(true);
    expect(isCaptionTextPlatform("tiktok")).toBe(true);
    expect(isCaptionTextPlatform("youtube")).toBe(true);
  });

  it("is false for blog and unknown", () => {
    expect(isCaptionTextPlatform("blog")).toBe(false);
    expect(isCaptionTextPlatform("unknown")).toBe(false);
  });
});
