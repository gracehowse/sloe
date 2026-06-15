/**
 * ENG-805 / ENG-1171 — weekly check-in must not cold-open as a blocking modal
 * on Today (web + mobile). Mobile banner tests live in
 * `apps/mobile/tests/unit/weeklyCheckinBanner.test.tsx`; this pins the web
 * NutritionTracker gate effect.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "..", "..");

describe("ENG-805 — web Today never cold-opens weekly check-in modal", () => {
  it("eligibility effect builds content but does not setWeeklyCheckinOpen(true)", () => {
    const src = readFileSync(
      join(repoRoot, "src/app/components/NutritionTracker.tsx"),
      "utf8",
    );
    const effectStart = src.indexOf("// Weekly check-in ritual gate");
    expect(effectStart).toBeGreaterThan(0);
    const effectChunk = src.slice(effectStart, effectStart + 2200);
    expect(effectChunk).toContain("ENG-805 — never cold-open");
    expect(effectChunk).not.toMatch(/setWeeklyCheckinOpen\s*\(\s*true\s*\)/);
  });

  it("web banner tap is the explicit open path", () => {
    const src = readFileSync(
      join(repoRoot, "src/app/components/NutritionTracker.tsx"),
      "utf8",
    );
    expect(src).toContain("WeeklyCheckinBanner");
    expect(src).toMatch(/setWeeklyCheckinOpen\s*\(\s*true\s*\)/);
  });
});
