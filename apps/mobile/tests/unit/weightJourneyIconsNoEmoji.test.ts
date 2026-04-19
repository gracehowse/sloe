import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * F-12 structural pin (2026-04-19, TestFlight `AOOBv-1OwtDIoRVDRwH-S5k`).
 *
 * The Weight Tracker's "Journey" card originally rendered the start /
 * goal / completion anchors as literal emoji (tent, checkered flag,
 * trophy). The tester flagged this as "use icons not emojis" and the
 * 2026-04-18 dev note explicitly acknowledged the original choice was
 * "emoji-only so no asset pipeline change".
 *
 * This test pins:
 *   (a) none of the four emoji glyphs — U+26FA tent, U+1F3D5 camping,
 *       U+1F3C1 finish flag, U+1F3C6 trophy — appear anywhere in the
 *       file, whether as literal glyphs or `\u` escape-string literals;
 *   (b) the replacement vector-icon names (`flag-outline` and
 *       `trophy-outline`) are present and the `Ionicons` import still
 *       exists.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("weight-tracker journey anchors are vector icons, not emoji (F-12)", () => {
  const SRC = read("apps/mobile/app/weight-tracker.tsx");

  it("does not contain the tent / flag / trophy emoji as literal glyphs", () => {
    expect(SRC.includes("\u26FA")).toBe(false); // tent ⛺
    expect(SRC.includes("\uD83C\uDFD5")).toBe(false); // camping 🏕
    expect(SRC.includes("\uD83C\uDFC1")).toBe(false); // finish flag 🏁
    expect(SRC.includes("\uD83C\uDFC6")).toBe(false); // trophy 🏆
  });

  it("does not contain the emoji via `\\u` escape string literals either", () => {
    expect(SRC).not.toMatch(/"\\u26FA"/);
    expect(SRC).not.toMatch(/"\\uD83C\\uDFD5"/);
    expect(SRC).not.toMatch(/"\\uD83C\\uDFC1"/);
    expect(SRC).not.toMatch(/"\\uD83C\\uDFC6"/);
  });

  it("still imports Ionicons from @expo/vector-icons", () => {
    expect(SRC).toMatch(
      /import\s*\{[^}]*Ionicons[^}]*\}\s*from\s*["']@expo\/vector-icons["']/,
    );
  });

  it("uses Ionicons flag-outline for the journey start anchor", () => {
    expect(SRC).toMatch(/name=["']flag-outline["']/);
  });

  it("uses Ionicons trophy-outline (+ flag) for the journey goal/complete anchor", () => {
    expect(SRC).toMatch(
      /name=\{\s*journey\.pct\s*>=\s*1\s*\?\s*["']trophy-outline["']\s*:\s*["']flag["']\s*\}/,
    );
  });
});
