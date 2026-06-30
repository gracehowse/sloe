/**
 * CookMode — step text must use foreground tokens on bg-background
 * (2026-05-21). White copy on the light cream background was invisible.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK = readFileSync(
  resolve(__dirname, "../../src/app/components/CookMode.tsx"),
  "utf8",
);
const MOBILE_COOK = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/cook.tsx"),
  "utf8",
);

describe("Cook mode readable text", () => {
  it("web step instructions use text-foreground on the default light shell", () => {
    expect(COOK).toMatch(/bg-background text-foreground/);
    expect(COOK).toMatch(/leading-relaxed text-foreground/);
    expect(COOK).not.toMatch(/leading-relaxed text-white/);
    expect(COOK).not.toMatch(/bg-background text-white/);
  });

  it("web CookMode gates immersive primary-deep shell behind recipe_detail_v3_conformance", () => {
    expect(COOK).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    expect(COOK).toContain("primary-deep");
    expect(COOK).toContain("cook-mode-v3");
  });

  it("mobile cook surfaces gate v3 dark shell behind recipe_detail_v3_conformance", () => {
    expect(MOBILE_COOK).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    expect(MOBILE_COOK).toContain("Accent.primaryDeep");
    const RECIPE_DETAIL = readFileSync(
      resolve(__dirname, "../../apps/mobile/app/recipe/[id].tsx"),
      "utf8",
    );
    expect(RECIPE_DETAIL).toContain("cook-mode-v3");
    expect(RECIPE_DETAIL).toContain("Accent.primaryDeep");
  });

  it("mobile cook step text uses theme colors.text on the default path", () => {
    expect(MOBILE_COOK).toMatch(/stepText:[\s\S]*?color: cookV3 \? Accent\.frostBright : colors\.text/);
  });
});
