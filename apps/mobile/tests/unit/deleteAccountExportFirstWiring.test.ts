/**
 * DeleteAccount "Download a copy first" wiring — ENG-1262 (mobile).
 *
 * The export-first action on the destructive delete flow MUST run the COMPLETE
 * server-authoritative archive (`exportEverythingToFile` → `/api/export/me`),
 * NOT the meal-log-only CSV (`runExportCsv`). Handing a partial archive right
 * before permanent deletion is a GDPR Art. 20 portability gap — that's the
 * whole point of this ticket.
 *
 * Source-level test (mounting the full bundle is heavy and pulls in many
 * native modules; the rest of the settings suite uses the same readFileSync
 * pattern). Pins:
 *   - The delete sheet is constructed with the FULL export (`runExportEverything`).
 *   - It is NOT constructed with the partial CSV (`runExportCsv`).
 *   - The sheet receives `exportingFirst` for the loading/disabled state.
 *   - The sheet's export-first button consumes `exportingFirst` (no double-submit).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUNDLE = readFileSync(
  resolve(__dirname, "../../components/settings/SettingsBundleContent.tsx"),
  "utf8",
);
const SHEET = readFileSync(
  resolve(__dirname, "../../components/settings/DeleteAccountSheet.tsx"),
  "utf8",
);

describe("DeleteAccount export-first wiring (mobile) — ENG-1262", () => {
  it("constructs the delete sheet with the COMPLETE export (runExportEverything)", () => {
    expect(BUNDLE).toMatch(
      /useDeleteAccountSheet\(\s*userId,\s*\(\) => \{\s*void runExportEverything\(\);/,
    );
  });

  it("does NOT wire the partial CSV export into the delete flow", () => {
    // `runExportCsv` may still exist for the standalone CSV row + cancel-flow
    // prompt — but it must not be the delete sheet's export arg.
    expect(BUNDLE).not.toMatch(
      /useDeleteAccountSheet\(\s*userId,\s*\(\) => \{\s*void runExportCsv\(\);/,
    );
  });

  it("passes exportingFirst into the delete sheet for the loading state", () => {
    expect(BUNDLE).toMatch(/exportingFirst=\{exportingEverything\}/);
  });

  it("the sheet's export-first button consumes exportingFirst (disable + loading)", () => {
    expect(SHEET).toMatch(/exportingFirst/);
    expect(SHEET).toMatch(/testID="delete-account-export-first"/);
    expect(SHEET).toMatch(/loading=\{exportingFirst\}/);
    expect(SHEET).toMatch(/disabled=\{exportingFirst\}/);
  });
});
