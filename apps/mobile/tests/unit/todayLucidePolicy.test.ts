/**
 * Premium P0 — Lucide-only policy on Today cold-open surfaces (ENG-583).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TODAY_LUCIDE_ONLY = [
  "components/today/TodayDateHeader.tsx",
  "components/today/TodayMealsSection.tsx",
  "components/today/TodayAddFoodForm.tsx",
  "components/today/TodayQuickLogStrip.tsx",
] as const;

describe("Today components — lucide-only (ENG-583)", () => {
  for (const rel of TODAY_LUCIDE_ONLY) {
    it(`${rel} does not import Ionicons`, () => {
      const raw = readFileSync(resolve(__dirname, "../..", rel), "utf-8");
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(src).not.toMatch(/from\s+["']@expo\/vector-icons["']/);
      expect(src).not.toMatch(/\bIonicons\b/);
    });
  }
});
