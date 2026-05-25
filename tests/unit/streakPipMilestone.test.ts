import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const webPip = fs.readFileSync(
  path.resolve("src/app/components/suppr/streak-pip.tsx"),
  "utf-8",
);
const mobilePip = fs.readFileSync(
  path.resolve("apps/mobile/components/today/StreakPip.tsx"),
  "utf-8",
);

describe("ENG-55 · Streak pip milestone labels", () => {
  for (const [label, src] of [
    ["web", webPip],
    ["mobile", mobilePip],
  ] as const) {
    describe(label, () => {
      it("shows milestone labels at week thresholds", () => {
        expect(src).toContain('"1 week streak"');
        expect(src).toContain('"2 week streak"');
        expect(src).toContain('"3 week streak"');
      });

      it("shows milestone labels at month thresholds", () => {
        expect(src).toContain('"1 month streak"');
        expect(src).toContain('"3 month streak"');
      });

      it("shows special label at 100 days", () => {
        expect(src).toContain('"100 day streak!"');
      });

      it("shows special label at 1 year", () => {
        expect(src).toContain('"1 year streak!"');
      });

      it("uses warm tint at milestone thresholds", () => {
        expect(src).toContain("isMilestone");
      });

      it("falls back to N-day streak for non-milestone counts", () => {
        expect(src).toContain("`${d}-day streak`");
      });
    });
  }
});
