/**
 * Tests for `detectRegion` — region-aware currency + VAT disclosure.
 *
 * H7 (2026-04-21). Guards:
 *   - CF-IPCountry header precedence over Accept-Language.
 *   - UK → GBP + inclusive VAT note.
 *   - EU country → EUR tag + inclusive VAT note + GBP display flag.
 *   - Unknown / default → USD + empty VAT note (no accidental claim).
 *   - Accept-Language language-only tags (e.g. "de") fall back to EU.
 *   - Accept-Language with en-US stays on default (no VAT claim).
 *
 * ENG-1441 (2026-07-21): the default-region currency changed from GBP
 * to USD (see `detectRegion.ts`'s `defaultRegion` doc comment — a
 * label-only change, checkout still resolves to GBP either way). Also
 * covers the two new exports threaded into the landing page + upgrade
 * dialog: `detectRegionFromNavigatorLanguage` (client-side, no request
 * headers) and `resolveRegionPricingNote` (the shared "pricing coming
 * soon" copy, extracted from the ternary `/pricing/page.tsx` used to
 * inline for EUR only).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  detectRegion,
  detectRegionFromNavigatorLanguage,
  resolveRegionPricingNote,
} from "@/lib/region/detectRegion";

function fakeHeaders(map: Record<string, string>): { get: (k: string) => string | null } {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(map)) lower.set(k.toLowerCase(), v);
  return { get: (k: string) => lower.get(k.toLowerCase()) ?? null };
}

describe("detectRegion", () => {
  it("returns UK region for CF-IPCountry=GB", () => {
    const r = detectRegion(fakeHeaders({ "CF-IPCountry": "GB" }));
    expect(r.currency).toBe("GBP");
    expect(r.locale).toBe("en-GB");
    expect(r.vatNote).toBe("Prices include VAT");
  });

  it("returns EU region for CF-IPCountry=DE (Germany)", () => {
    const r = detectRegion(fakeHeaders({ "CF-IPCountry": "DE" }));
    expect(r.currency).toBe("EUR");
    expect(r.vatNote).toBe("Prices include VAT");
    expect(r.displayAmountsInGbp).toBe(true);
  });

  it("returns default region (USD, ENG-1441) for CF-IPCountry=US", () => {
    const r = detectRegion(fakeHeaders({ "CF-IPCountry": "US" }));
    expect(r.currency).toBe("USD");
    expect(r.locale).toBe("en-US");
    expect(r.vatNote).toBe("");
    // Label-only — checkout still resolves to GBP (no USD Stripe SKU
    // exists); see `resolveProStripePrice.ts`'s `CheckoutCurrency` type.
    expect(r.displayAmountsInGbp).toBe(true);
  });

  it("prefers CF-IPCountry over Accept-Language", () => {
    const r = detectRegion(
      fakeHeaders({ "CF-IPCountry": "US", "Accept-Language": "en-GB,en;q=0.9" }),
    );
    expect(r.currency).toBe("USD");
    expect(r.vatNote).toBe("");
  });

  it("falls back to Accept-Language when CF header missing", () => {
    const r = detectRegion(fakeHeaders({ "Accept-Language": "en-GB,en;q=0.9" }));
    expect(r.currency).toBe("GBP");
    expect(r.vatNote).toBe("Prices include VAT");
  });

  it("treats de-DE Accept-Language as EU", () => {
    const r = detectRegion(fakeHeaders({ "Accept-Language": "de-DE,de;q=0.9" }));
    expect(r.currency).toBe("EUR");
    expect(r.vatNote).toBe("Prices include VAT");
  });

  it("treats language-only 'de' as EU", () => {
    const r = detectRegion(fakeHeaders({ "Accept-Language": "de" }));
    expect(r.currency).toBe("EUR");
  });

  it("treats en-US as default (no VAT claim)", () => {
    const r = detectRegion(fakeHeaders({ "Accept-Language": "en-US,en;q=0.9" }));
    expect(r.currency).toBe("USD");
    expect(r.vatNote).toBe("");
  });

  it("returns default (USD, ENG-1441) when no headers present", () => {
    const r = detectRegion(fakeHeaders({}));
    expect(r.currency).toBe("USD");
    expect(r.locale).toBe("en-US");
    expect(r.vatNote).toBe("");
  });

  it("ignores sentinel CF values (XX, T1)", () => {
    const r1 = detectRegion(fakeHeaders({ "CF-IPCountry": "XX", "Accept-Language": "en-GB" }));
    expect(r1.vatNote).toBe("Prices include VAT");
    const r2 = detectRegion(fakeHeaders({ "CF-IPCountry": "T1", "Accept-Language": "fr-FR" }));
    expect(r2.currency).toBe("EUR");
  });

  it("handles Crown Dependencies as UK (IM, GG, JE)", () => {
    for (const code of ["IM", "GG", "JE"]) {
      const r = detectRegion(fakeHeaders({ "CF-IPCountry": code }));
      expect(r.currency).toBe("GBP");
      expect(r.vatNote).toBe("Prices include VAT");
    }
  });

  it("handles EEA-adjacent as EU for VAT purposes (NO, CH)", () => {
    for (const code of ["NO", "CH", "IS", "LI"]) {
      const r = detectRegion(fakeHeaders({ "CF-IPCountry": code }));
      expect(r.currency).toBe("EUR");
      expect(r.vatNote).toBe("Prices include VAT");
    }
  });
});

/**
 * ENG-1441 (2026-07-21) — `detectRegionFromNavigatorLanguage`, the
 * client-side adapter used by the landing page, the upgrade dialog, and
 * (post-refactor) `SubscriptionCard`. Stubs `navigator.language`
 * directly rather than going through `fakeHeaders` — this function
 * takes no arguments, by design, so it can be called identically from
 * every client call site.
 */
describe("detectRegionFromNavigatorLanguage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLanguage(lang: string) {
    vi.stubGlobal("navigator", { language: lang });
  }

  it("UK: en-GB → GBP + inclusive VAT note", () => {
    stubLanguage("en-GB");
    const r = detectRegionFromNavigatorLanguage();
    expect(r.currency).toBe("GBP");
    expect(r.vatNote).toBe("Prices include VAT");
  });

  it("EU: de-DE → EUR + inclusive VAT note", () => {
    stubLanguage("de-DE");
    const r = detectRegionFromNavigatorLanguage();
    expect(r.currency).toBe("EUR");
    expect(r.vatNote).toBe("Prices include VAT");
  });

  it("default: en-US → USD + no VAT note", () => {
    stubLanguage("en-US");
    const r = detectRegionFromNavigatorLanguage();
    expect(r.currency).toBe("USD");
    expect(r.vatNote).toBe("");
  });

  it("SSR-safe: falls back to the default region when navigator is unavailable", () => {
    vi.stubGlobal("navigator", undefined);
    const r = detectRegionFromNavigatorLanguage();
    expect(r.currency).toBe("USD");
    expect(r.vatNote).toBe("");
  });
});

/**
 * ENG-1441 — the "pricing coming soon" banner shared by `/pricing`, the
 * landing page, and (implicitly, via the same currency resolution) the
 * upgrade dialog's region detection. Extracted from the inline EUR-only
 * ternary `/pricing/page.tsx` used before this change.
 */
describe("resolveRegionPricingNote", () => {
  it("GBP (UK): no note", () => {
    expect(resolveRegionPricingNote("GBP", { eurPricingReady: false })).toBe("");
    expect(resolveRegionPricingNote("GBP", { eurPricingReady: true })).toBe("");
  });

  it("EUR + not ready: 'EU pricing coming soon — current prices in GBP'", () => {
    expect(resolveRegionPricingNote("EUR", { eurPricingReady: false })).toBe(
      "EU pricing coming soon — current prices in GBP",
    );
  });

  it("EUR + ready: no note (real EUR SKU configured)", () => {
    expect(resolveRegionPricingNote("EUR", { eurPricingReady: true })).toBe("");
  });

  it("USD: 'US pricing coming soon — current prices in GBP' regardless of eurPricingReady", () => {
    expect(resolveRegionPricingNote("USD", { eurPricingReady: false })).toBe(
      "US pricing coming soon — current prices in GBP",
    );
    expect(resolveRegionPricingNote("USD", { eurPricingReady: true })).toBe(
      "US pricing coming soon — current prices in GBP",
    );
  });
});
