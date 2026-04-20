/**
 * Settings → Customer Center entry point (2026-04-20).
 *
 * Structural test that the "Manage subscription" row exists in the
 * settings screen and is gated on the user actually having an active
 * tier. Users on `free` should only see "View plans"; users on `base`
 * see both (upgrade + manage); users on `pro` see only "Manage
 * subscription" (existing logic already hides "View plans" for pro).
 *
 * Source-level check to match the pattern established by
 * `paywallCopyParity.test.ts` — mounting the full settings screen
 * isn't viable under vitest (supabase client, async-storage, expo-
 * router, theme provider chain).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../app/(tabs)/settings.tsx");

describe("settings — Customer Center entry point", () => {
  const src = readFileSync(SETTINGS_PATH, "utf8");

  it("imports presentCustomerCenter from the purchases module", () => {
    expect(src).toContain(
      'import { presentCustomerCenter } from "@/lib/purchases";',
    );
  });

  it("renders a Manage subscription row with a stable testID", () => {
    expect(src).toContain('testID="settings-manage-subscription-row"');
    expect(src).toContain("<Text style={styles.rowLabel}>Manage subscription</Text>");
  });

  it('gates the row on userTier !== "free"', () => {
    // Paid users (base/pro) see it; free users don't. Cheap but
    // load-bearing — drift here would either (a) break free-tier users
    // by dropping them into a Customer Center with nothing to manage,
    // or (b) hide it from pro users who legitimately need to cancel.
    const guard = src.match(
      /\{userTier !== "free" && \(\s*<Pressable[\s\S]*?testID="settings-manage-subscription-row"/,
    );
    expect(guard).not.toBeNull();
  });

  it("falls back to the platform subscription URL when the native UI is unavailable", () => {
    // When `presentCustomerCenter` returns `presented: false`, the
    // settings screen must route the user to
    // apps.apple.com/account/subscriptions (iOS) or
    // play.google.com/store/account/subscriptions (Android). This keeps
    // "manage my plan" from being a dead end in Expo Go or if the UI
    // native module fails to load.
    expect(src).toContain("https://apps.apple.com/account/subscriptions");
    expect(src).toContain(
      "https://play.google.com/store/account/subscriptions",
    );
  });
});
