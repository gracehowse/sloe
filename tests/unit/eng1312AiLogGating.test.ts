/**
 * ENG-1312 — voice / photo / describe AI-log gating parity (web ↔ mobile).
 * Source-grep pins the host gate + a single PRO-badge affordance on every
 * Pro-only entry point (no lock icons on describe).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const WEB_TRACKER = read("src/app/components/NutritionTracker.tsx");
const MOBILE_TODAY = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
const WEB_DESCRIBE = read("src/app/components/suppr/log-sheet-describe-flow.tsx");
const MOBILE_DESCRIBE = read("apps/mobile/components/today/LogSheetDescribeFlow.tsx");
const WEB_INPUT_ROW = read("src/app/components/suppr/log-sheet-input-mode-row.tsx");
const MOBILE_INPUT_ROW = read("apps/mobile/components/today/LogSheetInputModeRow.tsx");

function logSheetVoiceGate(src: string): void {
  expect(src).toContain('setAiPaywallFeature("voice_log")');
  expect(src).toContain("setVoiceLogOpen(true)");
  expect(src).toMatch(/if \(userTier === "pro"\)[\s\S]*setVoiceLogOpen\(true\)/);
  expect(src).toContain("locked: userTier !== \"pro\"");
}

describe("ENG-1312 — voice log host gate (free → paywall, Pro → sheet)", () => {
  it("web LogSheet voice onStart opens paywall for non-Pro", () => {
    logSheetVoiceGate(WEB_TRACKER);
  });

  it("mobile LogSheet voice onStart opens paywall for non-Pro", () => {
    expect(MOBILE_TODAY).toContain('setAiPaywall({ open: true, feature: "voice_log" })');
    expect(MOBILE_TODAY).toContain("setVoiceLogOpen(true)");
    expect(MOBILE_TODAY).toMatch(/if \(userTier === "pro"\)[\s\S]*setVoiceLogOpen\(true\)/);
    expect(MOBILE_TODAY).toContain("locked: userTier !== \"pro\"");
  });

  it("photo opens for any tier (free taster) with no lock badge on the LogSheet chip", () => {
    for (const src of [WEB_TRACKER, MOBILE_TODAY]) {
      expect(src).toMatch(/photo=\{\{[\s\S]*?locked:\s*false/);
      expect(src).toMatch(/photo=\{\{[\s\S]*?setPhotoLogOpen\(true\)/);
    }
  });
});

describe("ENG-1312 — single PRO-badge affordance on Pro-only surfaces", () => {
  it("input-mode rows use PRO badge when locked (not lock icons)", () => {
    for (const src of [WEB_INPUT_ROW, MOBILE_INPUT_ROW]) {
      expect(src).toContain("PRO");
      expect(src).not.toMatch(/\bLock\b/);
    }
  });

  it("describe flow uses PRO badge when locked (not lock icons)", () => {
    for (const src of [WEB_DESCRIBE, MOBILE_DESCRIBE]) {
      expect(src).toContain("ProMethodBadge");
      expect(src).not.toMatch(/\bLock\b/);
    }
  });

  it("describe is Pro-gated at the host on both platforms", () => {
    for (const src of [WEB_TRACKER, MOBILE_TODAY]) {
      expect(src).toContain("locked: userTier !== \"pro\"");
      expect(src).toContain('onPaywall: () => setAiPaywall');
      expect(src).toContain("parseMealDescriptionTranscript");
    }
  });
});
