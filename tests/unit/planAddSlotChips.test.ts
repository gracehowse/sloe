/**
 * Plan screen — compact single-row add-slot chips (2026-05-21).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PLANNER = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/planner.tsx"),
  "utf8",
);
const WEB = readFileSync(
  resolve(ROOT, "src/app/components/MealPlanner.tsx"),
  "utf8",
);

describe("Plan add-slot chips", () => {
  it("mobile uses a single-row bar with compact chip styles", () => {
    expect(PLANNER).toMatch(/addSlotBar/);
    expect(PLANNER).toMatch(/addSlotRow/);
    expect(PLANNER).not.toMatch(/Add a meal slot/);
    expect(PLANNER).not.toMatch(/flexWrap: "wrap", gap: 10/);
  });

  it("mobile abbreviates slot labels for narrow widths", () => {
    expect(PLANNER).toMatch(/function compactPlanSlotLabel/);
    expect(PLANNER).toMatch(/compactPlanSlotLabel\(slot\)/);
  });

  it("web uses a single nowrap row under an Add label", () => {
    expect(WEB).toMatch(/flex-nowrap gap-1\.5/);
    expect(WEB).toMatch(/flex-1 min-w-0/);
  });
});
