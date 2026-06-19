/**
 * ENG-971 — web ↔ mobile `FEATURE_COPY` parity for the in-flow AI paywall,
 * plus honest-billing copy across every photo-log quota surface (the
 * AiPaywallSheet says "up to 100 a day"; nothing on a paywall surface may
 * promise "Pro for unlimited" when Pro AI logging is hard-capped at 100/day).
 * Source-grep so a copy drift on either platform fails CI immediately.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PRICING_TIERS } from "../../src/lib/landing/pricingTiers";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const WEB = read("src/app/components/suppr/ai-paywall-dialog.tsx");
const MOBILE = read("apps/mobile/components/AiPaywallSheet.tsx");

// Every photo-log quota-exhaustion surface (server canonical message + the
// two client back-compat fallbacks). All must use the honest cap wording.
const PHOTO_LOG_QUOTA_SURFACES: Record<string, string> = {
  "photo-log API route": read("app/api/nutrition/photo-log/route.ts"),
  "web PhotoLogDialog fallback": read("src/app/components/suppr/photo-log-dialog.tsx"),
  "mobile PhotoLogSheet fallback": read("apps/mobile/components/PhotoLogSheet.tsx"),
};

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

describe("Photo-log quota copy — honest billing (ENG-971)", () => {
  // Pro AI photo logging is capped at 100/day (api:photo-log bucket,
  // limit: 100). "Upgrade to Pro for unlimited" overstated the
  // entitlement on a billing surface — every quota-exhaustion message
  // must now name the real cap.
  for (const [name, src] of Object.entries(PHOTO_LOG_QUOTA_SURFACES)) {
    it(`${name} never promises "Pro for unlimited"`, () => {
      expect(src).not.toContain("Upgrade to Pro for unlimited");
      expect(src).not.toMatch(/Pro for unlimited\b/);
    });

    it(`${name} uses the honest "up to 100 a day" cap wording`, () => {
      expect(src).toContain("Pro unlocks AI photo logging up to 100 a day");
    });
  }
});

describe("Pricing SSOT Pro tag — honest billing (ENG-971)", () => {
  const pro = PRICING_TIERS.find((t) => t.name === "Pro");

  it("exists", () => {
    expect(pro).toBeDefined();
  });

  it("does not call AI logging 'unlimited' while the bullets cap it at 100/day", () => {
    expect(pro?.tag).not.toMatch(/unlimited AI logging/i);
    expect(pro?.tag).not.toMatch(/\bunlimited\b/i);
    // The feature bullets carry the real cap — the tag must agree.
    expect(pro?.features.some((f) => /up to 100\/day/i.test(f))).toBe(true);
  });
});
