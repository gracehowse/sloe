import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DELETE_ACCOUNT_CONFIRM_TOKEN,
  DELETE_ACCOUNT_DEATTRIBUTION_NOTE,
  DELETE_ACCOUNT_SHEET_FLAG,
  formatDeleteAccountLedgerRows,
} from "@/lib/settings/deleteAccountFlow";

const ROOT = resolve(__dirname, "../..");

describe("deleteAccountFlow (ENG-1260 / B26)", () => {
  it("formats ledger rows with live counts", () => {
    const rows = formatDeleteAccountLedgerRows({
      diaryEntries: 42,
      recipes: 1,
      weightDays: 3,
      inHousehold: true,
    });
    // ENG-1263: the recipes row counts hard-deleted recipes only (saved +
    // unpublished drafts), framed "saved recipes & drafts" — published authored
    // recipes survive de-attributed and are NOT in this list.
    expect(rows.map((r) => r.label)).toEqual([
      "42 diary entries",
      "1 saved recipe & drafts",
      "3 days of weight history",
      "Your household membership",
    ]);
  });

  it("pluralises the saved-recipes-&-drafts row label", () => {
    const single = formatDeleteAccountLedgerRows({
      diaryEntries: null,
      recipes: 1,
      weightDays: null,
      inHousehold: false,
    });
    const many = formatDeleteAccountLedgerRows({
      diaryEntries: null,
      recipes: 4,
      weightDays: null,
      inHousehold: false,
    });
    expect(single.find((r) => r.id === "recipes")?.label).toBe("1 saved recipe & drafts");
    expect(many.find((r) => r.id === "recipes")?.label).toBe("4 saved recipes & drafts");
  });

  it("falls back to a generic recipes label when the count is unknown", () => {
    const rows = formatDeleteAccountLedgerRows({
      diaryEntries: null,
      recipes: null,
      weightDays: null,
      inHousehold: false,
    });
    expect(rows.find((r) => r.id === "recipes")?.label).toBe("Saved recipes & drafts");
  });

  it("omits household row when user is not in a household", () => {
    const rows = formatDeleteAccountLedgerRows({
      diaryEntries: 0,
      recipes: 0,
      weightDays: 0,
      inHousehold: false,
    });
    expect(rows).toHaveLength(3);
  });

  it("exports the de-attribution disclosure footnote in the shared SSOT (ENG-1263)", () => {
    // Single source of truth so web + mobile sheets render identical wording.
    // The footnote must NAME the published-recipes carve-out honestly: they
    // survive (stay public) but are de-attributed (name removed).
    expect(DELETE_ACCOUNT_DEATTRIBUTION_NOTE).toContain("published");
    expect(DELETE_ACCOUNT_DEATTRIBUTION_NOTE).toMatch(/stay public/i);
    expect(DELETE_ACCOUNT_DEATTRIBUTION_NOTE).toMatch(/remove your name/i);
    expect(DELETE_ACCOUNT_DEATTRIBUTION_NOTE).toMatch(/deleted for good/i);
  });

  it("both delete-account sheets render the de-attribution footnote from the SSOT (ENG-1263)", () => {
    // Parity pin: web + mobile both import the SSOT constant and surface it via
    // the same testID beneath the ledger — neither hardcodes the wording.
    const web = readFileSync(
      resolve(ROOT, "src/app/components/settings/DeleteAccountSheet.tsx"),
      "utf8",
    );
    const mobile = readFileSync(
      resolve(ROOT, "apps/mobile/components/settings/DeleteAccountSheet.tsx"),
      "utf8",
    );
    for (const src of [web, mobile]) {
      expect(src).toContain("DELETE_ACCOUNT_DEATTRIBUTION_NOTE");
      // No hardcoded copy — the wording lives only in the SSOT.
      expect(src).not.toContain("stay public, but we remove your name");
    }
    // Web uses `data-testid`, mobile uses RN `testID` — same id either way.
    expect(web).toContain('data-testid="delete-account-deattribution-note"');
    expect(mobile).toContain('testID="delete-account-deattribution-note"');
  });

  it("exports stable flag + confirm token", () => {
    expect(DELETE_ACCOUNT_SHEET_FLAG).toBe("delete_account_sheet_v1");
    expect(DELETE_ACCOUNT_CONFIRM_TOKEN).toBe("DELETE");
  });

  it("is wired on web Settings behind the flag", () => {
    const settings = readFileSync(resolve(ROOT, "src/app/components/Settings.tsx"), "utf8");
    expect(settings).not.toContain("DeleteAccountSheet");
    expect(settings).toContain("useSettingsDeleteAccountLayer");
  });

  it("is wired on mobile SettingsBundleContent behind the flag", () => {
    const bundle = readFileSync(
      resolve(ROOT, "apps/mobile/components/settings/SettingsBundleContent.tsx"),
      "utf8",
    );
    expect(bundle).toContain("DeleteAccountSheet");
    expect(bundle).toContain("useDeleteAccountSheet");
  });
});
