/**
 * ENG-949 — cook-mode text scale helpers + wiring.
 *
 * The pure helpers drive the in-cook A−/A+ control on web (`CookMode.tsx`)
 * and the mobile cook overlay (`apps/mobile/app/recipe/[id].tsx`). The
 * source-pin assertions at the bottom protect the integration so a future
 * refactor can't silently drop the control or the persisted size.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COOK_TEXT_SCALE_DEFAULT,
  COOK_TEXT_SCALE_STEPS,
  canDecreaseCookTextScale,
  canIncreaseCookTextScale,
  clampCookTextScale,
  cookStepFontSize,
  cookTextScaleStorageKey,
  stepCookTextScale,
} from "../../src/lib/nutrition/cookTextScale.ts";

describe("cookTextScale helpers", () => {
  it("default size is present in the step set", () => {
    expect(COOK_TEXT_SCALE_STEPS).toContain(COOK_TEXT_SCALE_DEFAULT);
    expect(COOK_TEXT_SCALE_DEFAULT).toBe(1);
  });

  it("clamps non-finite / non-positive input to the default", () => {
    expect(clampCookTextScale(Number.NaN)).toBe(1);
    expect(clampCookTextScale(0)).toBe(1);
    expect(clampCookTextScale(-2)).toBe(1);
    expect(clampCookTextScale("1.3" as unknown)).toBe(1);
  });

  it("snaps an arbitrary stored value to the nearest legible step", () => {
    expect(clampCookTextScale(1.31)).toBe(1.3);
    expect(clampCookTextScale(0.95)).toBe(0.9);
    expect(clampCookTextScale(1.18)).toBe(1.15);
    // Above the ceiling snaps to the max, not the default.
    expect(clampCookTextScale(99)).toBe(1.5);
  });

  it("steps up and down within the bounds", () => {
    expect(stepCookTextScale(1, 1)).toBe(1.15);
    expect(stepCookTextScale(1, -1)).toBe(0.9);
    expect(stepCookTextScale(1.15, 1)).toBe(1.3);
  });

  it("clamps stepping at the ends (no-op past the bounds)", () => {
    const max = COOK_TEXT_SCALE_STEPS[COOK_TEXT_SCALE_STEPS.length - 1]!;
    const min = COOK_TEXT_SCALE_STEPS[0]!;
    expect(stepCookTextScale(max, 1)).toBe(max);
    expect(stepCookTextScale(min, -1)).toBe(min);
  });

  it("reports whether the controls can step further", () => {
    const max = COOK_TEXT_SCALE_STEPS[COOK_TEXT_SCALE_STEPS.length - 1]!;
    const min = COOK_TEXT_SCALE_STEPS[0]!;
    expect(canIncreaseCookTextScale(max)).toBe(false);
    expect(canIncreaseCookTextScale(1)).toBe(true);
    expect(canDecreaseCookTextScale(min)).toBe(false);
    expect(canDecreaseCookTextScale(1)).toBe(true);
  });

  it("keys storage per user (anon fallback)", () => {
    expect(cookTextScaleStorageKey("user-123")).toBe(
      "suppr-cook-text-scale-v1:user-123",
    );
    expect(cookTextScaleStorageKey(null)).toBe("suppr-cook-text-scale-v1:anon");
    expect(cookTextScaleStorageKey("   ")).toBe("suppr-cook-text-scale-v1:anon");
  });

  it("scales + rounds a base font size, with a safe fallback", () => {
    expect(cookStepFontSize(24, 1)).toBe(24);
    expect(cookStepFontSize(24, 1.5)).toBe(36);
    expect(cookStepFontSize(24, 0.9)).toBe(22);
    // Non-positive base falls back to 16 so a bad call never yields 0.
    expect(cookStepFontSize(0, 1)).toBe(16);
  });
});

describe("ENG-949 cook text-size control wiring", () => {
  const WEB = readFileSync(
    resolve(__dirname, "../../src/app/components/CookMode.tsx"),
    "utf8",
  );
  const MOBILE = readFileSync(
    resolve(__dirname, "../../apps/mobile/app/recipe/[id].tsx"),
    "utf8",
  );

  it("web cook mode renders the A−/A+ control with accessible labels", () => {
    expect(WEB).toMatch(/Increase text size/);
    expect(WEB).toMatch(/Decrease text size/);
    expect(WEB).toMatch(/handleTextScaleStep/);
    expect(WEB).toMatch(/cookStepFontSize/);
  });

  it("mobile cook overlay renders the A−/A+ control with accessible labels", () => {
    expect(MOBILE).toMatch(/Increase text size/);
    expect(MOBILE).toMatch(/Decrease text size/);
    expect(MOBILE).toMatch(/handleCookTextScaleStep/);
    // Base 24 scaled (matches the standalone screen; the overlay used 22).
    expect(MOBILE).toMatch(/cookStepFontSize\(24, cookTextScale\)/);
  });
});
