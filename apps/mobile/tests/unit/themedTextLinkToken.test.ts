/**
 * ENG-1013 — themed-text link colour must come from theme tint, not a raw hex.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../../components/themed-text.tsx"), "utf8");

describe("themed-text link token (ENG-1013)", () => {
  it("does not hardcode a link hex colour", () => {
    expect(SRC).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("resolves link type from theme tint", () => {
    expect(SRC).toContain("type === 'link' ? linkColor : color");
    expect(SRC).toContain("useThemeColor({ light: lightColor, dark: darkColor }, 'tint')");
  });
});
