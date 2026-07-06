/**
 * Profile / Settings / Sidebar avatars — premium chrome (2026-05-20).
 * Profile uses flat `bg-primary`; Settings + Sidebar use a CSS gradient
 * (matching mobile's GradientAvatar treatment).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROFILE_PATH = join(__dirname, "../../src/app/components/Profile.tsx");
// ENG-1458: the Settings header card's avatar markup was extracted to
// SettingsProfileHeaderCard.tsx (narrow-width reflow fix).
const SETTINGS_HEADER_CARD_PATH = join(
  __dirname,
  "../../src/app/components/settings/SettingsProfileHeaderCard.tsx",
);
const SIDEBAR_PATH = join(__dirname, "../../src/app/components/suppr/desktop-sidebar.tsx");

describe("web Profile + Settings + Sidebar avatars — premium chrome", () => {
  const profile = readFileSync(PROFILE_PATH, "utf8");
  const settingsHeaderCard = readFileSync(SETTINGS_HEADER_CARD_PATH, "utf8");
  const sidebar = readFileSync(SIDEBAR_PATH, "utf8");

  it("Profile avatars use bg-primary", () => {
    expect(profile).toMatch(/bg-primary text-primary-foreground/);
  });

  it("Settings header avatar uses gradient (matching mobile GradientAvatar)", () => {
    expect(settingsHeaderCard).toContain("linear-gradient");
    expect(settingsHeaderCard).toContain("var(--primary)");
  });

  it("Sidebar profile avatar uses same gradient as Settings", () => {
    expect(sidebar).toContain("linear-gradient");
    expect(sidebar).toContain("var(--primary)");
    expect(sidebar).not.toMatch(/bg-primary text-primary-foreground/);
  });
});
