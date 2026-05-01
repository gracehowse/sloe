/**
 * Recime parity quick-win — hero image fallback ladder + video host
 * classifier (2026-04-30).
 *
 * Pins the contract of `src/lib/recipes/heroImageFallback.ts`:
 *
 *   - `pickHeroImageUrl(recipe)` returns the recipe's own image when
 *     present, falls back to a YouTube `maxresdefault` thumbnail when
 *     the source URL is a YouTube watch / shorts / youtu.be URL, and
 *     returns `null` for unsupported video hosts so the deterministic
 *     gradient renderer can take over.
 *   - `extractVideoHost(url)` classifies arbitrary URLs into
 *     `youtube | instagram | tiktok | other`, tolerating subdomain
 *     variants (`m.`, `www.`, `vt.tiktok.com`, `youtu.be` ...) and
 *     never throwing on malformed input.
 *
 * Both helpers are pure + sync. No network. Safe in render.
 */
import { describe, expect, it } from "vitest";
import {
  extractVideoHost,
  extractYoutubeThumbnail,
  extractYoutubeVideoId,
  pickHeroImageUrl,
} from "../../src/lib/recipes/heroImageFallback";

describe("pickHeroImageUrl — fallback ladder", () => {
  it("returns recipe.image_url when present (rung 1 wins)", () => {
    const got = pickHeroImageUrl({
      image_url: "https://cdn.example.com/photo.jpg",
      source_url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(got).toBe("https://cdn.example.com/photo.jpg");
  });

  it("trims-and-checks empty string image_url before falling through", () => {
    const got = pickHeroImageUrl({
      image_url: "   ",
      source_url: "https://youtu.be/dQw4w9WgXcQ",
    });
    // Empty image_url → falls through to source_url (YT) → thumbnail
    expect(got).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  });

  it("falls back to YouTube thumbnail when source_video_url is a YouTube URL", () => {
    const got = pickHeroImageUrl({
      image_url: null,
      source_video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(got).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  });

  it("falls back to YouTube thumbnail via source_url when source_video_url is absent", () => {
    // Common case until we add a separate `source_video_url` column —
    // the importer drops the YT watch URL into `source_url` itself.
    const got = pickHeroImageUrl({
      image_url: null,
      source_url: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(got).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  });

  it("prefers source_video_url over source_url when both are set", () => {
    const got = pickHeroImageUrl({
      image_url: null,
      source_video_url: "https://youtu.be/aaaaaaaaaaa",
      source_url: "https://youtube.com/watch?v=bbbbbbbbbbb",
    });
    expect(got).toBe("https://img.youtube.com/vi/aaaaaaaaaaa/maxresdefault.jpg");
  });

  it("returns null for Instagram source URLs (no inferable thumbnail)", () => {
    const got = pickHeroImageUrl({
      image_url: null,
      source_url: "https://www.instagram.com/reel/Cabc123Xyz/",
    });
    // IG / TT thumbnails live behind signed CDN tokens — caller falls
    // through to the deterministic gradient renderer when null.
    expect(got).toBeNull();
  });

  it("returns null for TikTok source URLs (no inferable thumbnail)", () => {
    const got = pickHeroImageUrl({
      image_url: null,
      source_url: "https://www.tiktok.com/@chef/video/7300000000000000000",
    });
    expect(got).toBeNull();
  });

  it("returns null for arbitrary blog source URLs", () => {
    const got = pickHeroImageUrl({
      image_url: null,
      source_url: "https://recipes.example.com/best-cookies",
    });
    expect(got).toBeNull();
  });

  it("returns null when nothing is set", () => {
    expect(pickHeroImageUrl({})).toBeNull();
    expect(pickHeroImageUrl({ image_url: null, source_url: null })).toBeNull();
  });

  it("handles youtube /shorts/ URLs", () => {
    const got = pickHeroImageUrl({
      image_url: null,
      source_url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    });
    expect(got).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  });

  it("ignores malformed YouTube URLs (id wrong length)", () => {
    expect(extractYoutubeVideoId("https://youtu.be/short")).toBeNull();
    expect(extractYoutubeVideoId("https://youtu.be/way_too_long_for_yt_id"))
      .toBeNull();
  });
});

describe("extractYoutubeThumbnail", () => {
  it("emits maxresdefault for watch?v= URLs", () => {
    expect(extractYoutubeThumbnail("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
      .toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYoutubeThumbnail("https://example.com/foo")).toBeNull();
    expect(extractYoutubeThumbnail("")).toBeNull();
  });
});

describe("extractVideoHost — host classification", () => {
  it("classifies YouTube watch + shorts + youtu.be as youtube", () => {
    expect(extractVideoHost("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
      .toBe("youtube");
    expect(extractVideoHost("https://m.youtube.com/watch?v=dQw4w9WgXcQ"))
      .toBe("youtube");
    expect(extractVideoHost("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(extractVideoHost("https://www.youtube-nocookie.com/embed/abc"))
      .toBe("youtube");
  });

  it("classifies Instagram URLs as instagram", () => {
    expect(extractVideoHost("https://www.instagram.com/reel/Cabc123/"))
      .toBe("instagram");
    expect(extractVideoHost("https://instagram.com/p/Cabc123/"))
      .toBe("instagram");
  });

  it("classifies TikTok URLs (incl. short links) as tiktok", () => {
    expect(extractVideoHost("https://www.tiktok.com/@chef/video/7300"))
      .toBe("tiktok");
    expect(extractVideoHost("https://vm.tiktok.com/abc")).toBe("tiktok");
    expect(extractVideoHost("https://vt.tiktok.com/abc")).toBe("tiktok");
  });

  it("classifies unknown / arbitrary hosts as other", () => {
    expect(extractVideoHost("https://recipes.example.com/cookies"))
      .toBe("other");
    expect(extractVideoHost("https://vimeo.com/123456")).toBe("other");
    // `business.tiktok.com` is NOT the consumer surface — keep it
    // as `other` so analytics doesn't conflate the two.
    expect(extractVideoHost("https://business.tiktok.com/foo"))
      .toBe("other");
  });

  it("never throws on malformed / empty input — falls back to other", () => {
    expect(extractVideoHost(undefined)).toBe("other");
    expect(extractVideoHost(null)).toBe("other");
    expect(extractVideoHost("")).toBe("other");
    expect(extractVideoHost("   ")).toBe("other");
    expect(extractVideoHost("not a url")).toBe("other");
    expect(extractVideoHost("javascript:alert(1)")).toBe("other");
  });

  it("tolerates protocol-less URLs (`youtube.com/...`)", () => {
    expect(extractVideoHost("youtube.com/watch?v=dQw4w9WgXcQ"))
      .toBe("youtube");
    expect(extractVideoHost("instagram.com/reel/abc")).toBe("instagram");
  });
});
