/**
 * Settings → Customer Center entry point (2026-04-20, re-anchored
 * 2026-05-01 to the bundle as the single source of truth).
 *
 * Structural test that the "Manage subscription" row exists and is
 * gated on the user actually having an active tier. Users on `free`
 * see only "Upgrade your plan"; users on `base` see both (upgrade +
 * manage); users on `pro` see only "Manage subscription".
 *
 * 2026-05-01 (`claude/settings-mobile-structural-fix` P0-1): the
 * Manage subscription row migrated from the legacy in-file
 * `/(tabs)/settings.tsx` Plan section into
 * `<SettingsBundleContent>` Membership card. Bundle is the single
 * source of truth for /settings.
 *
 * Source-level check to match the pattern established by
 * `paywallCopyParity.test.ts` — mounting the full bundle isn't
 * viable under vitest (supabase client, async-storage, expo-router,
 * theme provider chain).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUNDLE_PATH = resolve(
  __dirname,
  "../../components/settings/SettingsBundleContent.tsx",
);

describe("settings — Customer Center entry point", () => {
  const src = readFileSync(BUNDLE_PATH, "utf8");

  it("imports presentCustomerCenter from the purchases module", () => {
    expect(src).toContain(
      'import { presentCustomerCenter } from "@/lib/purchases";',
    );
  });

  it("renders a Manage subscription row with a stable testID", () => {
    expect(src).toContain('testID="settings-manage-subscription-row"');
    // Bundle uses a flexed Text for the row label (not styles.rowLabel).
    expect(src).toMatch(/Manage subscription/);
  });

  it('gates the row on userTier !== "free"', () => {
    // Paid users (base/pro) see it; free users don't. Cheap but
    // load-bearing — drift here would either (a) break free-tier
    // users by dropping them into a Customer Center with nothing to
    // manage, or (b) hide it from pro users who legitimately need
    // to cancel.
    const guard = src.match(
      /profileData\.userTier\s*!==\s*"free"[\s\S]{0,400}?testID="settings-manage-subscription-row"/,
    );
    expect(guard).not.toBeNull();
  });

  it("falls back to the platform subscription URL when the native UI is unavailable", () => {
    // When `presentCustomerCenter` returns `presented: false`, the
    // settings screen routes the user to
    // apps.apple.com/account/subscriptions (iOS) or
    // play.google.com/store/account/subscriptions (Android). This
    // keeps "manage my plan" from being a dead end in Expo Go or if
    // the native module fails to load.
    expect(src).toContain("https://apps.apple.com/account/subscriptions");
    expect(src).toContain(
      "https://play.google.com/store/account/subscriptions",
    );
  });
});
