import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DELETE_ACCOUNT_CONFIRM_TOKEN,
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
    expect(rows.map((r) => r.label)).toEqual([
      "42 diary entries",
      "1 saved & created recipe",
      "3 days of weight history",
      "Your household membership",
    ]);
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
