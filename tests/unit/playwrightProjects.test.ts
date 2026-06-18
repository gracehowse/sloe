import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authedVisualSpecFiles,
  journeyAuthedTestMatch,
  publicVisualSpecFiles,
  visualAuthedTestMatch,
} from "../../playwright/projectPatterns";

const ROOT = resolve(__dirname, "../..");
const PKG = readFileSync(resolve(ROOT, "package.json"), "utf8");
const PLAYWRIGHT_CONFIG = readFileSync(resolve(ROOT, "playwright.config.ts"), "utf8");

describe("Playwright project routing", () => {
  it("public visual specs are not in visualAuthedTestMatch", () => {
    for (const file of publicVisualSpecFiles) {
      const basename = file.split("/").pop()!;
      for (const pattern of visualAuthedTestMatch) {
        expect(pattern.test(basename), `${basename} must stay off chromium-visual`).toBe(false);
      }
    }
  });

  it("authed visual specs are not in journeyAuthedTestMatch", () => {
    for (const file of authedVisualSpecFiles) {
      const basename = file.split("/").pop()!;
      for (const pattern of journeyAuthedTestMatch) {
        expect(pattern.test(basename), `${basename} must not use chromium-authed`).toBe(false);
      }
    }
  });

  it("playwright.config wires separate setup-visual + chromium-visual projects", () => {
    expect(PLAYWRIGHT_CONFIG).toContain("setup-visual");
    expect(PLAYWRIGHT_CONFIG).toContain("chromium-visual");
    expect(PLAYWRIGHT_CONFIG).toContain("visualAuthedTestMatch");
    expect(PLAYWRIGHT_CONFIG).toContain("journeyAuthedTestMatch");
  });

  it("npm scripts expose public, authed, and CI-parity visual runners", () => {
    expect(PKG).toContain("test:e2e:visual:public");
    expect(PKG).toContain("test:e2e:visual:authed");
    expect(PKG).toContain("test:e2e:ci-parity");
  });
});
