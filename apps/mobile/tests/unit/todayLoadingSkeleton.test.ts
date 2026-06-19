/**
 * ENG-889 L1 — mobile Today loading skeleton parity with web.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const INDEX_SRC = readFileSync(
  resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx"),
  "utf-8",
);
const SKELETON_SRC = readFileSync(
  resolve(__dirname, "../../components/today/TodayLoadingSkeleton.tsx"),
  "utf-8",
);

describe("ENG-889 L1 — mobile TodayLoadingSkeleton", () => {
  it("index uses TodayLoadingSkeleton when !hydrated", () => {
    expect(INDEX_SRC).toContain("<TodayLoadingSkeleton />");
    expect(INDEX_SRC).toMatch(/!hydrated[\s\S]+TodayLoadingSkeleton/);
  });

  it("component exposes today-loading-skeleton testID (web parity)", () => {
    expect(SKELETON_SRC).toContain('testID="today-loading-skeleton"');
  });

  it("includes week-strip + hero + macro grid silhouettes", () => {
    expect(SKELETON_SRC).toMatch(/length: 7/);
    expect(SKELETON_SRC).toMatch(/length: 4/);
  });
});
