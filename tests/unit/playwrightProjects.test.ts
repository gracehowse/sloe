import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authedVisualSpecFiles,
  e2eAuthedVisualSpecFiles,
  goldenAuthedVisualSpecFiles,
  journeyAuthedTestMatch,
  publicVisualSpecFiles,
  visualAuthedTestMatch,
  visualE2EAuthedTestMatch,
  visualGoldenAuthedTestMatch,
} from "../../playwright/projectPatterns";

const ROOT = resolve(__dirname, "../..");
const PKG = readFileSync(resolve(ROOT, "package.json"), "utf8");
const PLAYWRIGHT_CONFIG = readFileSync(resolve(ROOT, "playwright.config.ts"), "utf8");

describe("Playwright project routing", () => {
  it("public visual specs are not in visualAuthedTestMatch", () => {
    for (const file of publicVisualSpecFiles) {
      const basename = file.split("/").pop()!;
      for (const pattern of visualAuthedTestMatch) {
        expect(pattern.test(basename), `${basename} must stay off authed projects`).toBe(false);
      }
    }
  });

  it("golden authed visual specs route only to chromium-visual", () => {
    for (const file of goldenAuthedVisualSpecFiles) {
      const basename = file.split("/").pop()!;
      expect(
        visualGoldenAuthedTestMatch.some((p) => p.test(basename)),
        `${basename} must match visualGoldenAuthedTestMatch`,
      ).toBe(true);
      expect(
        visualE2EAuthedTestMatch.some((p) => p.test(basename)),
        `${basename} must not match visualE2EAuthedTestMatch`,
      ).toBe(false);
    }
  });

  it("E2E authed visual specs route only to chromium-authed", () => {
    for (const file of e2eAuthedVisualSpecFiles) {
      const basename = file.split("/").pop()!;
      expect(
        visualE2EAuthedTestMatch.some((p) => p.test(basename)),
        `${basename} must match visualE2EAuthedTestMatch`,
      ).toBe(true);
      expect(
        visualGoldenAuthedTestMatch.some((p) => p.test(basename)),
        `${basename} must not match visualGoldenAuthedTestMatch`,
      ).toBe(false);
    }
  });

  it("authed visual specs are not in journeyAuthedTestMatch alone", () => {
    for (const file of authedVisualSpecFiles) {
      const basename = file.split("/").pop()!;
      for (const pattern of journeyAuthedTestMatch) {
        expect(pattern.test(basename), `${basename} must not use journeyAuthedTestMatch`).toBe(false);
      }
    }
  });

  it("playwright.config wires separate setup-visual + chromium-visual projects", () => {
    expect(PLAYWRIGHT_CONFIG).toContain("setup-visual");
    expect(PLAYWRIGHT_CONFIG).toContain("chromium-visual");
    expect(PLAYWRIGHT_CONFIG).toContain("visualGoldenAuthedTestMatch");
    expect(PLAYWRIGHT_CONFIG).toContain("visualE2EAuthedTestMatch");
    expect(PLAYWRIGHT_CONFIG).toContain("journeyAuthedTestMatch");
  });

  it("npm scripts expose public, authed, and CI-parity visual runners", () => {
    expect(PKG).toContain("test:e2e:visual:public");
    expect(PKG).toContain("test:e2e:visual:authed");
    expect(PKG).toContain("test:e2e:ci-parity");
    expect(PKG).toContain("--project=chromium-visual --project=chromium-authed");
  });
});
