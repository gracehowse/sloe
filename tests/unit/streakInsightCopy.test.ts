import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("ENG-739 — streak insight uses day streak copy, not meal count", () => {
  it("web TodayStreakInsightCard does not say 'logged meals'", () => {
    const src = read("../../src/app/components/suppr/today-streak-insight-card.tsx");
    expect(src).not.toMatch(/logged meals/i);
    expect(src).toMatch(/logged \{streakDays\} day/);
  });

  it("mobile TodayStreakInsightCard does not say 'logged meals'", () => {
    const src = read("../../apps/mobile/components/today/TodayStreakInsightCard.tsx");
    expect(src).not.toMatch(/logged meals/i);
    expect(src).toMatch(/logged \{streakDays\} day/);
  });
});
