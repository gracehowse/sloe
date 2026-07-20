/**
 * ENG-1590 — SupprCard / SupprButton cross-platform primitive parity.
 *
 * SupprCard and SupprButton are documented on both platforms as mirrored
 * primitives, but the padding/size maps were authored independently and had
 * drifted a full tier apart (web SupprCard's `paddingClasses` sat one step
 * below mobile's `paddingValues`; web SupprButton had no `size` prop at all;
 * the paywall primary CTA rendered a 10px rounded-rect + 13px label on web
 * vs a full 9999px pill + 16px label on mobile). Because the divergence
 * lived in the primitive, every consumer passing an explicit prop inherited
 * it silently — see the confirmed instances at `TodayDashboardMacroBars`
 * (padding="md") and `ProgressTrajectoryHero` (padding="lg").
 *
 * This file pins both platforms' source text against each other (same
 * text-parsing pattern as `crossPlatformThemeTokens.test.ts` for colour
 * tokens) so a future edit to either file that reintroduces drift fails CI
 * immediately, without needing to import React Native into the web test
 * runner.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const WEB_CARD = readFileSync(
  resolve(ROOT, "src/app/components/ui/suppr-card.tsx"),
  "utf8",
);
const MOBILE_CARD = readFileSync(
  resolve(ROOT, "apps/mobile/components/ui/SupprCard.tsx"),
  "utf8",
);
const WEB_BUTTON = readFileSync(
  resolve(ROOT, "src/app/components/suppr/suppr-button.tsx"),
  "utf8",
);
const MOBILE_BUTTON = readFileSync(
  resolve(ROOT, "apps/mobile/components/ui/SupprButton.tsx"),
  "utf8",
);
const WEB_PAYWALL_DIALOG = readFileSync(
  resolve(ROOT, "src/app/components/suppr/upgrade-paywall-dialog.tsx"),
  "utf8",
);
const MOBILE_PAYWALL_CTA = readFileSync(
  resolve(ROOT, "apps/mobile/components/paywall/PaywallCta.tsx"),
  "utf8",
);
const MOBILE_THEME = readFileSync(
  resolve(ROOT, "apps/mobile/constants/theme.ts"),
  "utf8",
);

/** Extract a top-level `const <name> = { ... };` (or `export const`)
 *  object-literal body. */
function objectLiteralBody(src: string, exportName: string): string {
  const start = src.search(new RegExp(`(?:export\\s+)?const ${exportName}\\b`));
  expect(start, `${exportName} literal missing`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", start);
  let depth = 1;
  let i = open + 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return src.slice(open + 1, i - 1);
}

/** Mobile `Spacing.xs/sm/dense/md/lg/xl/xxl/xxxl` — the canonical scale both
 *  platforms' padding maps must resolve onto. */
const SPACING_BODY = objectLiteralBody(MOBILE_THEME, "Spacing");
function spacingPx(key: string): number {
  const m = SPACING_BODY.match(new RegExp(`\\b${key}:\\s*(\\d+)`));
  expect(m, `Spacing.${key}`).not.toBeNull();
  return Number(m![1]);
}

/** Resolve a Tailwind `p-N` / `py-N` / `px-N` utility to px (4px unit — the
 *  project's default, unmodified Tailwind v4 `--spacing` scale; confirmed by
 *  existing verbatim usage of e.g. `p-4`/`p-6` across `src/app/components/ui`). */
function tailwindUtilityPx(cls: string): number {
  const m = cls.match(/^p[xy]?-(\d+)$/);
  expect(m, `"${cls}" is not a plain p-N/py-N/px-N utility`).not.toBeNull();
  return Number(m![1]) * 4;
}

describe("SupprCard padding parity (ENG-1590)", () => {
  const webBody = objectLiteralBody(WEB_CARD, "paddingClasses");
  const mobileBody = objectLiteralBody(MOBILE_CARD, "paddingValues");

  function webPaddingPx(key: string): number {
    const m = webBody.match(new RegExp(`${key}:\\s*"([^"]*)"`));
    expect(m, `web paddingClasses.${key}`).not.toBeNull();
    const cls = m![1];
    if (cls === "") return 0; // `none`
    return tailwindUtilityPx(cls);
  }

  function mobilePaddingPx(key: string): number {
    const m = mobileBody.match(new RegExp(`${key}:\\s*([\\w.]+)`));
    expect(m, `mobile paddingValues.${key}`).not.toBeNull();
    const raw = m![1];
    if (raw === "0") return 0; // `none`
    const spacingRef = raw.match(/^Spacing\.(\w+)$/);
    expect(spacingRef, `mobile paddingValues.${key} = "${raw}" (expected a Spacing.* token)`).not.toBeNull();
    return spacingPx(spacingRef![1]);
  }

  it.each(["sm", "md", "lg", "xl"] as const)(
    "padding=\"%s\" resolves to the same px value on both platforms",
    (key) => {
      expect(webPaddingPx(key)).toBe(mobilePaddingPx(key));
    },
  );

  it("matches the documented mobile Spacing scale exactly (8/16/20/24)", () => {
    expect(mobilePaddingPx("sm")).toBe(8);
    expect(mobilePaddingPx("md")).toBe(16);
    expect(mobilePaddingPx("lg")).toBe(20);
    expect(mobilePaddingPx("xl")).toBe(24);
    expect(webPaddingPx("sm")).toBe(8);
    expect(webPaddingPx("md")).toBe(16);
    expect(webPaddingPx("lg")).toBe(20);
    expect(webPaddingPx("xl")).toBe(24);
  });
});

describe("SupprButton size parity (ENG-1590)", () => {
  it("web exposes a size prop mirroring mobile (md | sm)", () => {
    expect(WEB_BUTTON).toMatch(/export type SupprButtonSize = "md" \| "sm"/);
    expect(MOBILE_BUTTON).toMatch(/size\?:\s*"md" \| "sm"/);
  });

  it("size=\"sm\" is padding-driven and matches mobile's Spacing.sm/Spacing.md (8px/16px)", () => {
    const webSizeBody = objectLiteralBody(WEB_BUTTON, "SIZE_CLASSES");
    const smMatch = webSizeBody.match(/sm:\s*"([^"]+)"/);
    expect(smMatch, "web SIZE_CLASSES.sm").not.toBeNull();
    const smClasses = smMatch![1].split(/\s+/);

    const pyMatch = smClasses.find((c) => /^py-\d+$/.test(c));
    const pxMatch = smClasses.find((c) => /^px-\d+$/.test(c));
    expect(pyMatch, "web sm vertical padding class").toBeDefined();
    expect(pxMatch, "web sm horizontal padding class").toBeDefined();
    expect(smClasses).toContain("h-auto"); // padding drives height, not a fixed h-*

    const webVerticalPx = tailwindUtilityPx(pyMatch!);
    const webHorizontalPx = tailwindUtilityPx(pxMatch!);

    // Mobile: `size === "sm" ? { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md } : null`
    const mobileSmBlock = MOBILE_BUTTON.match(
      /size === "sm"\s*\n?\s*\?\s*\{([^}]+)\}/,
    );
    expect(mobileSmBlock, "mobile sm containerStyle block").not.toBeNull();
    const vMatch = mobileSmBlock![1].match(/paddingVertical:\s*Spacing\.(\w+)/);
    const hMatch = mobileSmBlock![1].match(/paddingHorizontal:\s*Spacing\.(\w+)/);
    expect(vMatch, "mobile sm paddingVertical").not.toBeNull();
    expect(hMatch, "mobile sm paddingHorizontal").not.toBeNull();

    expect(webVerticalPx).toBe(spacingPx(vMatch![1]));
    expect(webHorizontalPx).toBe(spacingPx(hMatch![1]));
    // Pin the actual numbers so a Spacing-scale rename can't quietly move both
    // sides in lockstep without anyone noticing the parity check still "passes".
    expect(webVerticalPx).toBe(8);
    expect(webHorizontalPx).toBe(16);
  });
});

describe("Paywall primary CTA — one radius + label-size spec (ENG-1590)", () => {
  function primaryCtaClassName(): string {
    const idx = WEB_PAYWALL_DIALOG.indexOf("onClick={handleStartCheckout}");
    expect(idx, "primary CTA onClick").toBeGreaterThanOrEqual(0);
    const classIdx = WEB_PAYWALL_DIALOG.indexOf("className=", idx);
    const m = WEB_PAYWALL_DIALOG.slice(classIdx).match(/className="([^"]+)"/);
    expect(m, "primary CTA className").not.toBeNull();
    return m![1];
  }

  it("web primary CTA is a full pill (rounded-full), not a rounded-rect", () => {
    const cls = primaryCtaClassName();
    expect(cls.split(/\s+/)).toContain("rounded-full");
    expect(cls).not.toMatch(/\brounded-xl\b/);
  });

  it("web primary CTA label is on the type ramp near mobile's 16px, not the 13px caption size", () => {
    const cls = primaryCtaClassName();
    expect(cls).not.toMatch(/text-\[13px\]/);
    expect(cls.split(/\s+/)).toContain("text-base"); // 15px — nearest legal rung to mobile's 16px
  });

  it("mobile PaywallCta is the reference spec: full pill + 16px label", () => {
    expect(MOBILE_PAYWALL_CTA).toMatch(/borderRadius:\s*Radius\.full/);
    expect(MOBILE_PAYWALL_CTA).toMatch(/fontSize:\s*16/);
  });

  it("mobile Radius.full is the canonical pill value (9999)", () => {
    const radiusBody = objectLiteralBody(MOBILE_THEME, "Radius");
    const m = radiusBody.match(/full:\s*(\d+)/);
    expect(m, "Radius.full").not.toBeNull();
    expect(Number(m![1])).toBe(9999);
  });
});
