/**
 * Web parity pin — Remaining/Consumed toggle couples display mode +
 * macro-ring expanded state (mobile `index.tsx` lock-step, 2026-05-02).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TRACKER_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "components",
  "NutritionTracker.tsx",
);

describe("NutritionTracker (web) — display toggle couples ring-expanded", () => {
  it("onToggleDisplayMode handler calls both setRingDisplayMode AND setRingExpanded", () => {
    const src = readFileSync(TRACKER_PATH, "utf8");
    const blockMatch = src.match(
      /onToggleDisplayMode=\{\(\) => \{[\s\S]*?\n\s*\}\}/,
    );
    expect(blockMatch).not.toBeNull();
    const body = blockMatch ? blockMatch[0] : "";
    expect(body).toMatch(/setRingDisplayMode\(/);
    expect(body).toMatch(/setRingExpanded\(/);
  });
});
