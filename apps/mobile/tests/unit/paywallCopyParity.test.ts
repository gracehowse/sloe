/**
 * Mobile paywall copy parity (round-6, 2026-04-19).
 *
 * `/pricing` (web) and the mobile paywall both render a dismiss CTA
 * for users who want to stay on Free. The SSOT across the product is
 * `"Continue for free"` — that's what the landing page, `/pricing`
 * grid, and the `planner.tsx` cancel-alert all use. The mobile paywall
 * previously rendered `"Continue on free plan"` which created cross-
 * platform drift (legal overrode sync-enforcer on the copy direction
 * in round-6 — SSOT wins here).
 *
 * This is a structural source-level check so the assertion survives
 * without having to mount the full React Native tree (the paywall
 * pulls `react-native-purchases` + Expo router + safe-area-context
 * which aren't viable in vitest).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");

describe("mobile paywall — dismiss CTA parity", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it('uses "Continue for free" as the dismiss CTA label', () => {
    // Match the rendered `<Text>` literal and the accessibility label.
    expect(src).toContain("<Text style={styles.freeBtnText}>Continue for free</Text>");
    expect(src).toContain('accessibilityLabel="Continue for free"');
  });

  it('does not carry the retired "Continue on free plan" wording', () => {
    // Round-5 shipped the variant; round-6 aligned to the web SSOT.
    expect(src).not.toContain("Continue on free plan");
  });
});
