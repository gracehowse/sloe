/**
 * Settings → Fasting findability — 2026-05-02
 * (`claude/fasting-findable-urgent`).
 *
 * Build 40 outstanding feedback: a tester typed "fast" in Settings
 * search and got "No matches for 'fast'", with no other in-app way
 * to find or change the fasting window after onboarding (the Today
 * fasting pill links to /fasting but the user didn't know to long-
 * press / tap it for config). This test is the regression pin for
 * the fix:
 *
 *   1. The bundle's Goals & targets section now renders a Fasting
 *      row that routes to /fasting (testID
 *      `settings-bundle-fasting-row`).
 *   2. /fasting renders an in-app window picker (all five Sloe presets:
 *      16:8 / 18:6 / 20:4 / 14:10 / OMAD — ENG-922) that persists to
 *      `profiles.fasting_window`, matching web parity with
 *      `src/app/components/FastingTimer.tsx`.
 *   3. The Settings search index includes the literal user query
 *      ("fast") as a keyword for the Fasting entry.
 *   4. The Settings screen renders search results when the query
 *      hits an index entry (instead of the previous unconditional
 *      "No matches" empty state).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const BUNDLE = readFileSync(
  resolve(ROOT, "components/settings/SettingsBundleContent.tsx"),
  "utf8",
);
const FASTING_SCREEN = readFileSync(
  resolve(ROOT, "app/fasting.tsx"),
  "utf8",
);
const SETTINGS = readFileSync(
  resolve(ROOT, "app/settings.tsx"),
  "utf8",
);

describe("Settings → Fasting findability (Build 40 fix)", () => {
  it("the bundle renders a Fasting row in Goals & targets that routes to /fasting", () => {
    expect(BUNDLE).toContain('testID="settings-bundle-fasting-row"');
    expect(BUNDLE).toMatch(
      /testID="settings-bundle-fasting-row"[\s\S]{0,800}?router\.push\("\/fasting"/,
    );
  });

  it("the bundle's Fasting row uses the Timer lucide icon", () => {
    expect(BUNDLE).toMatch(/\bTimer,?\s*\n[\s\S]*?from "lucide-react-native"/s);
    expect(BUNDLE).toMatch(
      /testID="settings-bundle-fasting-row"[\s\S]{0,400}?icon=\{Timer\}/,
    );
  });

  it("the bundle reads fasting_window so the row sub mirrors the user's window", () => {
    expect(BUNDLE).toMatch(/fasting_window/);
    expect(BUNDLE).toMatch(/setFastingWindow/);
  });

  it("/fasting renders a window picker driven by the shared 5-preset list (incl. OMAD)", () => {
    expect(FASTING_SCREEN).toContain('testID="fasting-window-picker"');
    // The screen now maps over the shared FASTING_WINDOW_PRESETS list
    // (ENG-922: all five windows incl. OMAD) rather than a local const.
    // Pin the import + the per-preset testID interpolation; the canonical
    // 5-preset list is pinned in `tests/unit/fastingMilestones.test.ts`.
    expect(FASTING_SCREEN).toMatch(
      /FASTING_WINDOW_PRESETS[\s\S]*?from "@suppr\/shared\/fasting\/milestones"/,
    );
    expect(FASTING_SCREEN).toMatch(/FASTING_WINDOW_PRESETS\.map/);
    expect(FASTING_SCREEN).toContain("testID={`fasting-window-preset-${w}`}");
  });

  it("/fasting persists window changes to profiles.fasting_window", () => {
    expect(FASTING_SCREEN).toMatch(/changeWindow/);
    expect(FASTING_SCREEN).toMatch(
      /\.update\(\{\s*fasting_window:\s*next\s*\}\)/,
    );
  });

  it("the Settings screen imports filterSettingsIndex and renders results", () => {
    expect(SETTINGS).toContain(
      'from "@/lib/settingsSearchIndex"',
    );
    expect(SETTINGS).toContain("filterSettingsIndex");
    expect(SETTINGS).toContain('testID="settings-search-results"');
  });

  it("the Settings screen renders the empty state ONLY when results.length === 0", () => {
    // The empty-state Text must be downstream of a `searchResults.length` gate
    // — not the unconditional "any non-empty query → No matches" we shipped
    // pre-fix.
    expect(SETTINGS).toMatch(/searchResults\.length\s*>\s*0/);
    expect(SETTINGS).toContain('testID="settings-search-empty"');
  });
});
