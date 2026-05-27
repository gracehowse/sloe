/**
 * ENG-7 — Unit tests for extractFromTikTokEmbeddedJson.
 *
 * TikTok serves minimal og:description to non-browser UAs.  The full
 * caption lives in one of three embedded JSON script tags:
 *   __UNIVERSAL_DATA_FOR_REHYDRATION__ (TikTok web app 2024+)
 *   SIGI_STATE (older pages / some regions)
 *   __NEXT_DATA__ (some page variants)
 *
 * These tests exercise the pure extraction function with HTML fixtures
 * so we don't need to mock `fetch`.
 */

import { describe, it, expect } from "vitest";
import { extractFromTikTokEmbeddedJson } from "@/lib/recipe-import/extractSocialRecipe";

const RECIPE_DESC =
  "Easy garlic butter pasta 🧄 500g spaghetti, 6 cloves garlic, 80g butter, fresh parsley, salt + pepper. " +
  "Boil pasta, fry garlic in butter 2 min, toss. #pasta #easyrecipe";

// Build minimal HTML fixtures that mirror TikTok's actual script tag shapes.
function makeUniversalDataHtml(desc: string, cover?: string): string {
  const itemStruct = {
    desc,
    video: cover ? { cover } : {},
    author: { uniqueId: "pastaqueen" },
  };
  const json = {
    __DEFAULT_SCOPE__: {
      "webapp.video-detail": {
        itemInfo: { itemStruct },
      },
    },
  };
  return `<!DOCTYPE html><html><head></head><body>
    <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(json)}</script>
  </body></html>`;
}

function makeSigiStateHtml(desc: string, cover?: string): string {
  const itemId = "7312345678901234567";
  const json = {
    ItemModule: {
      [itemId]: {
        desc,
        video: cover ? { cover } : {},
      },
    },
  };
  return `<!DOCTYPE html><html><head></head><body>
    <script id="SIGI_STATE" type="application/json">${JSON.stringify(json)}</script>
  </body></html>`;
}

function makeNextDataHtml(desc: string): string {
  const json = {
    props: {
      pageProps: {
        itemInfo: {
          itemStruct: { desc },
        },
      },
    },
  };
  return `<!DOCTYPE html><html><head></head><body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(json)}</script>
  </body></html>`;
}

describe("extractFromTikTokEmbeddedJson", () => {
  describe("__UNIVERSAL_DATA_FOR_REHYDRATION__", () => {
    it("extracts desc from the itemStruct path", () => {
      const result = extractFromTikTokEmbeddedJson(makeUniversalDataHtml(RECIPE_DESC));
      expect(result).not.toBeNull();
      expect(result!.caption).toContain("garlic butter pasta");
      expect(result!.caption).toContain("500g spaghetti");
    });

    it("extracts cover image when present", () => {
      const cover = "https://p16-sign.tiktokcdn.com/image/cover.jpeg~tplv.jpeg";
      const result = extractFromTikTokEmbeddedJson(makeUniversalDataHtml(RECIPE_DESC, cover));
      expect(result!.imageUrl).toBe(cover);
    });

    it("returns null imageUrl when video.cover is absent", () => {
      const result = extractFromTikTokEmbeddedJson(makeUniversalDataHtml(RECIPE_DESC));
      expect(result!.imageUrl).toBeNull();
    });

    it("returns null for a desc shorter than 10 chars", () => {
      const result = extractFromTikTokEmbeddedJson(makeUniversalDataHtml("hi"));
      expect(result).toBeNull();
    });
  });

  describe("SIGI_STATE", () => {
    it("extracts desc from ItemModule", () => {
      const result = extractFromTikTokEmbeddedJson(makeSigiStateHtml(RECIPE_DESC));
      expect(result).not.toBeNull();
      expect(result!.caption).toContain("500g spaghetti");
    });

    it("extracts cover when present in SIGI_STATE", () => {
      const cover = "https://p19-sign.tiktokcdn.com/sigi-cover.jpeg";
      const result = extractFromTikTokEmbeddedJson(makeSigiStateHtml(RECIPE_DESC, cover));
      expect(result!.imageUrl).toBe(cover);
    });
  });

  describe("__NEXT_DATA__", () => {
    it("extracts desc via pageProps.itemInfo.itemStruct", () => {
      const result = extractFromTikTokEmbeddedJson(makeNextDataHtml(RECIPE_DESC));
      expect(result).not.toBeNull();
      expect(result!.caption).toContain("garlic butter");
    });
  });

  describe("broad desc scan (Strategy 4)", () => {
    it("extracts desc when no known script id is present", () => {
      // Simulate a page that embeds desc in an inline script without a known id
      const html = `<html><body>
        <script>
          window.__data = {"id":"123","desc":"${RECIPE_DESC.replace(/"/g, '\\"')}","likes":500};
        </script>
      </body></html>`;
      const result = extractFromTikTokEmbeddedJson(html);
      expect(result).not.toBeNull();
      expect(result!.caption).toContain("garlic butter pasta");
    });

    it("does not match desc values shorter than 20 chars", () => {
      const html = `<html><body><script>{"desc":"short text"}</script></body></html>`;
      const result = extractFromTikTokEmbeddedJson(html);
      expect(result).toBeNull();
    });
  });

  it("returns null for non-TikTok HTML with no desc field", () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:description" content="A great recipe" />
    </head><body></body></html>`;
    expect(extractFromTikTokEmbeddedJson(html)).toBeNull();
  });

  it("decodes HTML entities in the caption", () => {
    const descWithEntities = "Pasta &amp; garlic &#8212; the best combo &lt;3";
    const result = extractFromTikTokEmbeddedJson(makeUniversalDataHtml(descWithEntities));
    expect(result!.caption).toContain("Pasta & garlic");
    expect(result!.caption).toContain("—");
  });
});
