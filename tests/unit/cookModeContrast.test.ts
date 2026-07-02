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
const MISE = readFileSync(
  resolve(__dirname, "../../src/app/components/cook/CookMiseEnPlace.tsx"),
  "utf8",
);
const MOBILE_MISE = readFileSync(
  resolve(__dirname, "../../apps/mobile/components/cook/CookMiseEnPlace.tsx"),
  "utf8",
);

/** WCAG relative luminance + contrast ratio for #rrggbb pairs. */
function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [hi, lo] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

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

  it("mobile cook screen gates v3 dark shell behind recipe_detail_v3_conformance", () => {
    expect(MOBILE_COOK).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    expect(MOBILE_COOK).toContain("Accent.primaryDeep");
    expect(MOBILE_COOK).toContain("cookV3");
  });

  it("mobile cook step text uses theme colors.text on the default path", () => {
    expect(MOBILE_COOK).toMatch(/stepText:[\s\S]*?color: cookV3 \? Accent\.frostBright : colors\.text/);
  });
});

describe('ENG-1311 — "Gather your ingredients" readable on the v3 dark shell', () => {
  it("web mise H1 swaps to the on-dark frost-bright token when cookV3 is on", () => {
    expect(MISE).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    expect(MISE).toMatch(/cookV3 \? "text-\[var\(--accent-frost-bright\)\]" : "text-foreground"/);
    // The muted lines follow the shell's frost treatment, never a fixed
    // light-theme ink on the dark ground.
    expect(MISE).toMatch(/cookV3 \? "text-\[var\(--accent-frost\)\]" : "text-muted-foreground"/);
    // No unconditional light-shell ink remains on the heading.
    expect(MISE).not.toMatch(/font-semibold text-foreground/);
  });

  it("mobile mise title swaps to Accent.frostBright when cookV3 is on", () => {
    expect(MOBILE_MISE).toContain('isFeatureEnabled("recipe_detail_v3_conformance")');
    expect(MOBILE_MISE).toMatch(/styles\.title, \{ color: cookV3 \? Accent\.frostBright : colors\.text \}/);
    expect(MOBILE_MISE).toMatch(/cookV3 \? Accent\.frost : colors\.textTertiary/);
  });

  it("the stated pair clears WCAG AA: frost-bright + frost on primary-deep", () => {
    // #efe9f2 (frostBright) / #c9c2d6 (frost) on #241733 (primaryDeep) —
    // pinned as literals so a token drift that kills contrast fails here.
    expect(contrastRatio("#efe9f2", "#241733")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#c9c2d6", "#241733")).toBeGreaterThanOrEqual(4.5);
  });

  it("web + mobile tokens still resolve to the pinned pair", () => {
    const themeCss = readFileSync(resolve(__dirname, "../../src/styles/theme.css"), "utf8");
    const mobileTheme = readFileSync(
      resolve(__dirname, "../../apps/mobile/constants/theme.ts"),
      "utf8",
    );
    expect(themeCss).toMatch(/--accent-frost-bright:\s*#efe9f2/i);
    expect(themeCss).toMatch(/--primary-deep:\s*#241733/i);
    expect(mobileTheme).toMatch(/frostBright:\s*'#efe9f2'/i);
    expect(mobileTheme).toMatch(/primaryDeep:\s*'#241733'/i);
  });
});
