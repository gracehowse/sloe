/**
 * Mobile SettingsBundleContent — "Export everything" row — 2026-04-30
 * lock-in-anxiety counter (per the user-sentiment audit).
 *
 * Source-level test (mounting the full bundle is heavy and pulls in
 * many modules; other settings tests in this folder use the same
 * pattern). Confirms:
 *   - The new row exists with its testid + label.
 *   - It routes through the server-authoritative helper, not direct
 *     Supabase reads (which is what the retired path did).
 *   - The retired "Export all data (JSON)" testid is gone — that
 *     path used `Share.share({ message })` which silently
 *     truncated for any non-trivial payload.
 *   - The trust copy ships.
 *   - There's a confirmation Alert before the export runs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUNDLE_PATH = resolve(
  __dirname,
  "../../components/settings/SettingsBundleContent.tsx",
);
const SRC = readFileSync(BUNDLE_PATH, "utf8");

describe("Settings — Export everything row (2026-04-30 lock-in counter)", () => {
  it("renders the new Export everything row with testid + label", () => {
    expect(SRC).toMatch(/testID="settings-bundle-export-everything-row"/);
    expect(SRC).toMatch(/label="Export everything"/);
  });

  it("routes through the server-authoritative helper", () => {
    expect(SRC).toMatch(/import\s*\{\s*exportEverythingToFile\s*\}\s*from\s*"@\/lib\/exportEverything"/);
    expect(SRC).toMatch(/exportEverythingToFile\(userId\)/);
  });

  it("retires the legacy Export all data (JSON) row", () => {
    // Negative guards — the retired testid + label must both be
    // gone so the legacy path can't sneak back via a merge.
    expect(SRC).not.toMatch(/testID="settings-bundle-export-json-row"/);
    expect(SRC).not.toMatch(/label="Export all data \(JSON\)"/);
  });

  it("confirms before running the export", () => {
    // Spec calls for a confirmation alert ("We'll download all
    // your recipes, meal log, weights, and plans to your device.
    // Continue?") before the network call fires.
    expect(SRC).toMatch(/Export everything\?/);
    expect(SRC).toMatch(/recipes, meal log, weights, and plans/);
  });

  it("ships the trust copy", () => {
    expect(SRC).toMatch(/Yours forever\. Take your data anywhere\./);
  });

  it("uses Share.share with a file URL (not a message)", () => {
    // Critical: legacy path used `Share.share({ message: payload })`,
    // which routes through copy/paste and breaks above ~64KB. The
    // new path passes a `file://` URI from `expo-file-system` so
    // iOS surfaces the full activity sheet (Save to Files, AirDrop,
    // Mail, Messages).
    expect(SRC).toMatch(/Share\.share\(\s*\{[^}]*url:\s*result\.fileUri/);
  });
});
