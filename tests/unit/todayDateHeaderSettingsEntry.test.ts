/**
 * Today premium sprint (2026-05-19) — Settings opens from the header avatar
 * on web (mobile uses `/(tabs)/settings` from TodayDateHeader).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

describe("TodayDateHeader — settings entry (web)", () => {
  const headerSrc = readFileSync(
    resolve(REPO, "src/app/components/suppr/today-date-header.tsx"),
    "utf-8",
  );
  const trackerSrc = readFileSync(
    resolve(REPO, "src/app/components/NutritionTracker.tsx"),
    "utf-8",
  );

  it("exposes onOpenSettings on the header contract", () => {
    expect(headerSrc).toMatch(/onOpenSettings:\s*\(\)\s*=>\s*void/);
  });

  it("avatar is a button that calls onOpenSettings", () => {
    expect(headerSrc).toMatch(/onClick=\{onOpenSettings\}/);
    expect(headerSrc).toMatch(/aria-label="Open settings"/);
    expect(headerSrc).not.toMatch(/aria-hidden/);
  });

  it("NutritionTracker wires onOpenSettings from the host", () => {
    expect(trackerSrc).toMatch(/onOpenSettings\?:\s*\(\)\s*=>\s*void/);
    expect(trackerSrc).toMatch(/onOpenSettings=\{\(\)\s*=>\s*onOpenSettings\?\.\(\)\}/);
  });
});
