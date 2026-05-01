/**
 * SettingsBundleContent — export rows MUST use Share.share({ url })
 * (2026-05-01, `claude/settings-mobile-structural-fix` P0-2).
 *
 * Why this test exists: `Share.share({ message: csv })` routes through
 * the iOS copy/paste pasteboard which silently truncates above ~64KB.
 * A real user with a few months of logs hits the limit on day 1, sees
 * a partial export saved to Notes, and assumes their data is gone.
 * The fix writes the CSV to the cache directory and surfaces the iOS
 * activity sheet via `Share.share({ url: file:// })` — Save to Files,
 * AirDrop, Mail, Messages all work against a `file://` URI.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUNDLE_PATH = resolve(
  __dirname,
  "../../components/settings/SettingsBundleContent.tsx",
);
const SETTINGS_PATH = resolve(
  __dirname,
  "../../app/(tabs)/settings.tsx",
);
const BUNDLE = readFileSync(BUNDLE_PATH, "utf8");
const SETTINGS = readFileSync(SETTINGS_PATH, "utf8");

describe("Settings export rows — file URL not message payload (P0-2)", () => {
  it("does NOT use Share.share({ message: ...csv... }) anywhere in real bundle code", () => {
    // Strip line comments + template-literal docs that mention the
    // legacy pattern by name, then assert no real call passes
    // `message:` as the first key.
    const bundleNoComments = BUNDLE.replace(/\/\/[^\n]*\n/g, "\n").replace(
      /`Share\.share\([^`]*`/g,
      "",
    );
    expect(bundleNoComments).not.toMatch(
      /Share\.share\(\s*\{\s*message:/,
    );
  });

  it("the CSV row uses Share.share({ url }) against a file URI", () => {
    expect(BUNDLE).toMatch(/Share\.share\(\s*\{\s*url:\s*fileUri/);
    expect(BUNDLE).toMatch(/writeAsStringAsync/);
    expect(BUNDLE).toMatch(/cacheDirectory/);
  });

  it("the export-everything row still uses Share.share({ url: result.fileUri }) (existing pin)", () => {
    expect(BUNDLE).toMatch(/Share\.share\(\s*\{[^}]*url:\s*result\.fileUri/);
  });

  it("the legacy /(tabs)/settings.tsx export rows are gone (P0-1)", () => {
    expect(SETTINGS).not.toContain("Export nutrition log (CSV)");
    expect(SETTINGS).not.toContain("Export all data (JSON)");
    expect(SETTINGS).not.toMatch(/Share\.share\(\s*\{\s*message:/);
  });
});
