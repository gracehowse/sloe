/**
 * D7 parity pin (2026-04-21) — web Profile (More tab) avatars must
 * paint the canonical brand gradient `linear-gradient(135deg, #4c6ce0
 * 0%, #e04888 100%)` on BOTH the 40×40 top-right button and the 52×52
 * profile-card avatar.
 *
 * Mobile parity: `apps/mobile/components/GradientAvatar.tsx` +
 * `apps/mobile/tests/unit/gradientAvatar.test.tsx`. If either side
 * softens away from these two hex endpoints (previous regression was
 * `var(--primary) → color-mix(...)`), this test fails.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROFILE_PATH = join(__dirname, "../../src/app/components/Profile.tsx");
const EXPECTED_GRADIENT = "linear-gradient(135deg, #4c6ce0 0%, #e04888 100%)";

describe("web Profile More-tab avatars — D7 brand gradient parity", () => {
  const source = readFileSync(PROFILE_PATH, "utf8");

  it("declares the canonical brand gradient as avatarGradient", () => {
    expect(source).toContain(EXPECTED_GRADIENT);
  });

  it("applies avatarGradient to both avatars (40×40 + 52×52)", () => {
    const matches = source.match(/background: avatarGradient/g) ?? [];
    // Two usages: top-right 40×40 button + 52×52 profile-card avatar.
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT regress to the softer color-mix blend", () => {
    // Previous shipped gradient used `color-mix(in oklab, var(--primary)
    // 45%, var(--macro-fat))` — keep this explicit regression guard so a
    // future "soften the avatar" drift can't land silently.
    expect(source).not.toMatch(/color-mix\(in oklab,\s*var\(--primary\)\s*45%/);
  });
});
