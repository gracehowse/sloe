/**
 * Source-level structural pins for the 2026-05-02 user-feedback bundle
 * (`claude/household-section-streak-sidebar-bundle`):
 *
 *   1. Household member-row chevron is no longer dead — the "you" row
 *      is a Pressable / anchor that routes to /targets, with a
 *      `household-settings-member-row-${userId}` testID. Other-member
 *      rows render without a chevron (no destination yet).
 *   2. The Settings / Profile "Everything else" section that wrapped a
 *      single Household row has been renamed to "People" on both
 *      platforms.
 *   3. The "Why this number?" panel reads the consecutive-streak
 *      (`streakDays`) value as `loggingDays` AND `mealLogDays`, so the
 *      number the user sees in the panel matches the StreakPip pip
 *      shown elsewhere in the surface.
 *
 * These are source-greps deliberately — mounting NutritionTracker /
 * HouseholdSettingsPage / SettingsBundleContent in a unit test pulls
 * in supabase, expo-router, AsyncStorage, RevenueCat, etc. The structural
 * contracts here are small and load-bearing, so a grep is cheap and
 * fails the moment a future PR drifts the wiring.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const MOBILE_HOUSEHOLD = readFileSync(
  resolve(ROOT, "apps/mobile/app/household-settings.tsx"),
  "utf8",
);
const WEB_HOUSEHOLD = readFileSync(
  resolve(ROOT, "src/app/components/HouseholdSettingsPage.tsx"),
  "utf8",
);
const MOBILE_SETTINGS_BUNDLE = readFileSync(
  resolve(ROOT, "apps/mobile/components/settings/SettingsBundleContent.tsx"),
  "utf8",
);
const WEB_PROFILE = readFileSync(
  resolve(ROOT, "src/app/components/Profile.tsx"),
  "utf8",
);
const MOBILE_TODAY = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);
const MOBILE_TARGETS = readFileSync(
  resolve(ROOT, "apps/mobile/app/targets.tsx"),
  "utf8",
);
const WEB_NUTRITION_TRACKER = readFileSync(
  resolve(ROOT, "src/app/components/NutritionTracker.tsx"),
  "utf8",
);

describe("Fix 1 — household member-row chevron is wired", () => {
  it("mobile own-row is a Pressable that pushes /targets", () => {
    // The own-row branch must exist with the testID + onPress wiring.
    expect(MOBILE_HOUSEHOLD).toContain(
      'testID={`household-settings-member-row-${m.userId}`}',
    );
    expect(MOBILE_HOUSEHOLD).toMatch(
      /onPress=\{\(\) => router\.push\("\/targets"/,
    );
    expect(MOBILE_HOUSEHOLD).toContain(
      'accessibilityLabel={`Edit your targets — ${m.displayName}`}',
    );
  });

  it("web own-row is an <a> that hrefs /home?view=targets", () => {
    expect(WEB_HOUSEHOLD).toContain(
      'data-testid={`household-settings-member-row-${m.userId}`}',
    );
    expect(WEB_HOUSEHOLD).toContain('href="/home?view=targets"');
    expect(WEB_HOUSEHOLD).toContain(
      'aria-label={`Edit your targets — ${m.displayName}`}',
    );
  });

  it("renders the chevron only for the self row (no chevron for others)", () => {
    // Mobile: the chevron now lives behind `isSelf ?` so other-member
    // rows don't render it.
    expect(MOBILE_HOUSEHOLD).toMatch(
      /isSelf \? \(\s*<ChevronRight/,
    );
    // Web: same gate, with Icons.forward.
    expect(WEB_HOUSEHOLD).toMatch(
      /isSelf \? \(\s*<Icons\.forward/,
    );
  });
});

describe("Fix 2 — section header rename: Everything else → People", () => {
  it("mobile SettingsBundleContent renders the People heading, not Everything else", () => {
    expect(MOBILE_SETTINGS_BUNDLE).toContain(
      '<SectionHeading title="People" />',
    );
    // The visible string "Everything else" must not appear as a
    // SectionHeading title prop anywhere in the bundle. (Comments are
    // fine — they document the rename — but a literal title= would
    // mean the section was re-introduced.)
    expect(MOBILE_SETTINGS_BUNDLE).not.toContain(
      'title="Everything else"',
    );
  });

  it("web Profile renders the People heading, not Everything else", () => {
    // Heading text — exact string the user reads.
    expect(WEB_PROFILE).toMatch(/>\s*People\s*</);
    // The literal heading "Everything else" is gone from the visible
    // text. Comments may still reference the old name to document the
    // rename — that's deliberate, so we check element text, not the
    // raw file.
    expect(WEB_PROFILE).not.toMatch(/>\s*Everything else\s*</);
  });
});

describe("Fix 3A — Why this number? panel uses the streak value", () => {
  it("mobile WhyThisNumberSheet now lives on /targets (moved 2026-05-12 round 4)", () => {
    // Round 4 (Grace TF): the sheet was removed from Today (no host
    // surface there since the pill + long-press + subtle link were
    // all rejected in rounds 1-3) and re-mounted on /targets, opened
    // from the "How is this calculated?" row. Today no longer hosts.
    expect(MOBILE_TARGETS).toMatch(/<WhyThisNumberSheet/);
    expect(MOBILE_TODAY).not.toMatch(/<WhyThisNumberSheet/);
    // On /targets there is no StreakPip on the same surface, so the
    // streak-alignment requirement from 2026-05-02 doesn't apply
    // here. We pass `null` for loggingDays/mealLogDays and let the
    // sheet's fallback copy handle it. The pin is just "the sheet
    // mounts with the expected null inputs" so a future change that
    // accidentally wires a wrong source fails CI.
    expect(MOBILE_TARGETS).toMatch(/loggingDays=\{null\}/);
    expect(MOBILE_TARGETS).toMatch(/mealLogDays=\{null\}/);
  });

  it("web WhyThisNumberDialog now lives on /home?view=targets (moved 2026-05-12 round 4)", () => {
    // Round 4 (Grace TF, web parity with mobile): same move as mobile —
    // the dialog was removed from Today's NutritionTracker and the
    // host wiring (streakDays binding, etc) along with it. The Targets
    // surface owns the dialog inline now. The Today pill on web is
    // also gone — see todayHeroRingNoChipsWeb.test.tsx for that pin.
    const WEB_TARGETS = readFileSync(
      resolve(ROOT, "src/app/components/Targets.tsx"),
      "utf8",
    );
    expect(WEB_TARGETS).toMatch(/<WhyThisNumberDialog/);
    expect(WEB_NUTRITION_TRACKER).not.toMatch(/<WhyThisNumberDialog/);
    // On /targets there's no StreakPip on the same surface so the
    // streak-alignment requirement from 2026-05-02 doesn't apply
    // here. We pass `null` for loggingDays/mealLogDays and the
    // dialog's fallback copy handles it.
    expect(WEB_TARGETS).toMatch(/loggingDays=\{null\}/);
    expect(WEB_TARGETS).toMatch(/mealLogDays=\{null\}/);
  });
});
