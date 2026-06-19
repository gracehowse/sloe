/** Shared viewport presets for Playwright visual regression specs. */

export const visualViewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/** Marketing routes — allow Linux vs macOS font raster drift in CI (see VISUAL_REGRESSION.md). */
export const marketingScreenshotOptions = { maxDiffPixelRatio: 0.1 } as const;
