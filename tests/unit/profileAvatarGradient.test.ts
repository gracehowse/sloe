/**
 * Profile / Settings avatars — premium ink chrome (2026-05-20).
 * Brand blue→magenta gradient is marketing-only; product avatars use
 * `bg-primary` / mobile `GradientAvatar` default `variant="ink"`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROFILE_PATH = join(__dirname, "../../src/app/components/Profile.tsx");
const SETTINGS_PATH = join(__dirname, "../../src/app/components/Settings.tsx");

describe("web Profile + Settings avatars — ink primary", () => {
  const profile = readFileSync(PROFILE_PATH, "utf8");
  const settings = readFileSync(SETTINGS_PATH, "utf8");

  it("Profile avatars use bg-primary (not brand gradient)", () => {
    expect(profile).toMatch(/bg-primary text-primary-foreground/);
    expect(profile).not.toContain("linear-gradient(135deg, #4c6ce0");
  });

  it("Settings header avatar uses bg-primary", () => {
    expect(settings).toMatch(/bg-primary text-primary-foreground/);
    expect(settings).not.toContain("linear-gradient(135deg, #4c6ce0");
  });
});
