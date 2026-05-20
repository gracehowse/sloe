/**
 * Profile / Settings avatars — premium chrome (2026-05-20).
 * Profile uses flat `bg-primary`; Settings uses a CSS gradient
 * (matching mobile's GradientAvatar treatment).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROFILE_PATH = join(__dirname, "../../src/app/components/Profile.tsx");
const SETTINGS_PATH = join(__dirname, "../../src/app/components/Settings.tsx");

describe("web Profile + Settings avatars — premium chrome", () => {
  const profile = readFileSync(PROFILE_PATH, "utf8");
  const settings = readFileSync(SETTINGS_PATH, "utf8");

  it("Profile avatars use bg-primary", () => {
    expect(profile).toMatch(/bg-primary text-primary-foreground/);
  });

  it("Settings header avatar uses gradient (matching mobile GradientAvatar)", () => {
    expect(settings).toContain("linear-gradient");
    expect(settings).toContain("var(--primary)");
  });
});
