/**
 * Mobile-side smoke test on the shared platform-detector re-export.
 *
 * `apps/mobile/lib/sourcePlatform.ts` re-exports from
 * `src/lib/recipes/resolveImportUrl.ts` so mobile and web stay in lockstep
 * on IG/TT/YouTube classification (see decision doc
 * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`). This
 * test fails if a future refactor accidentally desyncs the export
 * surface — the share-extension forwarder in `app/_layout.tsx` and the
 * caption preview screen in `app/import-shared.tsx` both rely on the
 * same classification.
 */

import { describe, it, expect } from "vitest";
import {
  detectSourcePlatform,
  isCaptionTextPlatform,
} from "../../lib/sourcePlatform";

describe("apps/mobile/lib/sourcePlatform — re-export of shared detector", () => {
  it("classifies the four canonical share-sheet platforms", () => {
    expect(detectSourcePlatform("https://www.instagram.com/p/ABC")).toBe("instagram");
    expect(detectSourcePlatform("https://www.tiktok.com/@u/video/1")).toBe("tiktok");
    expect(detectSourcePlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectSourcePlatform("https://example.com/recipe")).toBe("blog");
  });

  it("only flags caption-text platforms as caption-eligible", () => {
    expect(isCaptionTextPlatform(detectSourcePlatform("https://www.instagram.com/p/x"))).toBe(true);
    expect(isCaptionTextPlatform(detectSourcePlatform("https://www.tiktok.com/@u/video/1"))).toBe(true);
    expect(isCaptionTextPlatform(detectSourcePlatform("https://youtu.be/x"))).toBe(true);
    expect(isCaptionTextPlatform(detectSourcePlatform("https://example.com/recipe"))).toBe(false);
  });
});
