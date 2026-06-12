import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ENG-808 — last functional emoji in mobile planner leftover badge.
 * `docs/decisions/2026-05-31-icon-strategy.md` bans emoji as UI glyphs.
 */
const SRC = readFileSync(
  resolve(__dirname, "../../app/(tabs)/planner.tsx"),
  "utf8",
);

describe("planner leftover badge uses Lucide, not emoji (ENG-808)", () => {
  it("does not render the bento-box emoji in leftover badge icon", () => {
    expect(SRC.includes("\uD83C\uDF71")).toBe(false); // 🍱
    expect(SRC).not.toMatch(/icon=\{<Text>🍱<\/Text>\}/);
  });

  it("uses the Package lucide glyph for leftover badge icon", () => {
    expect(SRC).toContain("Package");
    expect(SRC).toMatch(/variant="leftover"[\s\S]*icon=\{[\s\S]*<Package/);
  });

  it("imports Package from lucide-react-native (not inline emoji glyph)", () => {
    expect(SRC).toMatch(/import\s*\{[^}]*Package[^}]*\}\s*from\s*["']lucide-react-native["']/);
  });
});
