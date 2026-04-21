/**
 * Mobile paywall gradient hero (M3, 2026-04-21).
 *
 * Prototype `docs/ux/claude-design-bundles/prototype/project/flows.jsx:555`
 * opens the paywall with a 135deg brand gradient banner
 * (`#4c6ce0 → #e04888`). Brand gradient is explicitly sanctioned on
 * paywall surfaces per the design-system doc, so the mobile paywall
 * must carry the gradient hero to stay in parity with the prototype.
 *
 * This is a structural source-level check (same pattern as
 * `paywallCopyParity.test.ts`) — the full paywall tree pulls
 * `react-native-purchases` + safe-area-context + expo-router which
 * aren't mountable under vitest.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");

describe("mobile paywall — brand gradient hero", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("imports react-native-svg LinearGradient primitives", () => {
    expect(src).toMatch(
      /from\s+"react-native-svg"/
    );
    expect(src).toContain("LinearGradient as SvgLinearGradient");
    expect(src).toContain("Stop");
    expect(src).toContain("Rect");
  });

  it("renders the brand-gradient hero stops (Accent.primary → Accent.magenta)", () => {
    expect(src).toContain('id="paywall-hero-grad"');
    expect(src).toMatch(/stopColor=\{Accent\.primary\}/);
    expect(src).toMatch(/stopColor=\{Accent\.magenta\}/);
  });

  it("uses a 135deg diagonal gradient (x1=0 y1=0 x2=1 y2=1)", () => {
    // Prototype `linear-gradient(135deg, …)` maps to top-left → bottom-right.
    expect(src).toMatch(
      /id="paywall-hero-grad"\s+x1="0"\s+y1="0"\s+x2="1"\s+y2="1"/
    );
  });

  it("renders header copy in white for contrast over the gradient", () => {
    // All three hero strings sit on top of the gradient; colour must be
    // white, not the theme foreground, or they vanish in light mode.
    expect(src).toContain('color: "#ffffff"');
  });
});
