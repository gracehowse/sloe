/**
 * Premium P0 — design token enforcement on Today premium sprint files (ENG-578).
 *
 * Incremental gate: blocks reintroduction of legacy brand-blue hex and
 * raw Tailwind arbitrary spacing in the files touched for Cycle 1.
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

const GATED_FILES = [
  "apps/mobile/components/today/TodayDateHeader.tsx",
  "apps/mobile/components/today/TodayMealsSection.tsx",
  "apps/mobile/components/today/TodayDashboardMacroTiles.tsx",
  "src/app/components/suppr/today-date-header.tsx",
  "src/app/components/suppr/today-meals-section.tsx",
  "src/lib/today/belowMealsPromptSelection.ts",
] as const;

const WEB_HEX_GATED = [
  "src/app/components/suppr/today-date-header.tsx",
  "src/app/components/suppr/today-meals-section.tsx",
] as const;

/** Web macro tiles still use compact `text-[Npx]` ladder — hex gate only. */
const HEX_ONLY_FILES = [
  "src/app/components/suppr/today-dashboard-macro-tiles.tsx",
] as const;

/** Retired UI chrome blues — use `--primary` / `Accent.primary` (ink). */
const BANNED_HEX = [
  "#7a90f5",
  "#6379c6",
  "#5b7cf0",
  "#4f6fe8",
] as const;

/** Arbitrary Tailwind spacing on mobile Today files only (web uses compact px ladder). */
const BANNED_TW = [/p-\[\d+px\]/, /m-\[\d+px\]/, /gap-\[\d+px\]/] as const;

const MOBILE_TW_GATED = [
  "apps/mobile/components/today/TodayDateHeader.tsx",
  "apps/mobile/components/today/TodayMealsSection.tsx",
  "apps/mobile/components/today/TodayDashboardMacroTiles.tsx",
] as const;

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("today premium token gate (ENG-578)", () => {
  for (const rel of GATED_FILES) {
    it(`${rel} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    });

    it(`${rel} has no legacy brand-blue hex`, () => {
      const src = read(rel).toLowerCase();
      for (const hex of BANNED_HEX) {
        expect(src, `found ${hex} in ${rel}`).not.toContain(hex);
      }
    });

  }

  for (const rel of MOBILE_TW_GATED) {
    it(`${rel} has no arbitrary Tailwind spacing literals`, () => {
      const src = read(rel);
      for (const re of BANNED_TW) {
        expect(src, `matched ${re} in ${rel}`).not.toMatch(re);
      }
    });
  }

  for (const rel of [...HEX_ONLY_FILES, ...WEB_HEX_GATED]) {
    it(`${rel} has no legacy brand-blue hex`, () => {
      const src = read(rel).toLowerCase();
      for (const hex of BANNED_HEX) {
        expect(src, `found ${hex} in ${rel}`).not.toContain(hex);
      }
    });
  }
});
