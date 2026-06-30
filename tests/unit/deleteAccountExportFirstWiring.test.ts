/**
 * DeleteAccount "Download a copy first" wiring — ENG-1262 (web).
 *
 * The export-first action on the destructive delete flow MUST run the COMPLETE
 * server-authoritative archive (`/api/export/me` via `downloadSupprExport`),
 * NOT the meal-log-only CSV (`runCsvExport`). Handing a partial archive right
 * before permanent deletion is a GDPR Art. 20 portability gap — that's the
 * whole point of this ticket.
 *
 * Source-level test (the live components mount heavy contexts; the rest of the
 * settings suite uses the same readFileSync pattern). Pins:
 *   - Settings passes the FULL export callback (`runFullExport`) into the
 *     delete layer, not `runCsvExport`.
 *   - `runFullExport` calls the shared `downloadSupprExport` helper.
 *   - The delete layer drives the sheet's `exportingFirst` loading state so the
 *     button disables / shows progress (no double-submit).
 *   - The sheet's export-first button consumes `exportingFirst`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(__dirname, "..", "..", rel), "utf8");
}

const SETTINGS = read("src/app/components/Settings.tsx");
const LAYER = read("src/app/components/settings/useSettingsDeleteAccountLayer.tsx");
const SHEET = read("src/app/components/settings/DeleteAccountSheet.tsx");

describe("DeleteAccount export-first wiring (web) — ENG-1262", () => {
  it("Settings feeds the COMPLETE export (runFullExport) into the delete layer", () => {
    // The delete layer is constructed with the full-export callback, not CSV.
    expect(SETTINGS).toMatch(
      /useSettingsDeleteAccountLayer\(\s*[\s\S]*?runFullExport,?\s*\)/,
    );
    // runFullExport calls the shared complete-archive helper.
    expect(SETTINGS).toMatch(/const runFullExport = useCallback/);
    expect(SETTINGS).toMatch(/downloadSupprExport\(supabase\)/);
  });

  it("does NOT wire the partial CSV export into the delete layer", () => {
    // Guard against regressing back to the meal-log-only CSV on the
    // delete-before-export surface. `runCsvExport` may still exist for the
    // standalone CSV row — but it must not be the delete layer's export arg.
    expect(SETTINGS).not.toMatch(
      /useSettingsDeleteAccountLayer\(\s*[\s\S]*?runCsvExport,?\s*\)/,
    );
  });

  it("the layer drives the sheet's exportingFirst loading state (no double-submit)", () => {
    expect(LAYER).toMatch(/exportingFirst/);
    // Re-entrancy guard: if already exporting, ignore the tap.
    expect(LAYER).toMatch(/if \(exportingFirst\) return/);
    expect(LAYER).toMatch(/setExportingFirst\(true\)/);
    expect(LAYER).toMatch(/finally\(\(\) => setExportingFirst\(false\)\)/);
  });

  it("the sheet's export-first button consumes exportingFirst (disable + loading)", () => {
    expect(SHEET).toMatch(/exportingFirst/);
    expect(SHEET).toMatch(/data-testid="delete-account-export-first"/);
    expect(SHEET).toMatch(/loading=\{exportingFirst\}/);
    expect(SHEET).toMatch(/disabled=\{exportingFirst\}/);
  });
});
