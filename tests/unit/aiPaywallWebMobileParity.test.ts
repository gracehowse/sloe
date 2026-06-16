/**
 * ENG-971 — web ↔ mobile `FEATURE_COPY` parity for the in-flow AI paywall.
 * Source-grep so a copy drift on either platform fails CI immediately.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = readFileSync(
  resolve(process.cwd(), "src/app/components/suppr/ai-paywall-dialog.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(process.cwd(), "apps/mobile/components/AiPaywallSheet.tsx"),
  "utf8",
);

function extractTitle(src: string, feature: "voice_log" | "photo_log"): string | null {
  const block = src.match(new RegExp(`${feature}:\\s*\\{[\\s\\S]*?title:\\s*"([^"]+)"`));
  return block?.[1] ?? null;
}

describe("AiPaywall FEATURE_COPY — web ↔ mobile parity (ENG-971)", () => {
  it("voice_log title matches on both platforms", () => {
    const title = "Voice logging is a Pro feature";
    expect(extractTitle(WEB, "voice_log")).toBe(title);
    expect(extractTitle(MOBILE, "voice_log")).toBe(title);
  });

  it("photo_log title matches on both platforms (no 'unlimited' contradiction)", () => {
    const title = "Get more photo logs with Pro";
    expect(extractTitle(WEB, "photo_log")).toBe(title);
    expect(extractTitle(MOBILE, "photo_log")).toBe(title);
    expect(WEB).not.toContain("Get unlimited photo logs with Pro");
  });

  it("photo_log body uses honest daily cap wording on both platforms", () => {
    for (const src of [WEB, MOBILE]) {
      expect(src).toContain("up to 100 a day");
      expect(src).not.toMatch(/unlimited AI photo logging \(100\/day\)/);
    }
  });
});
