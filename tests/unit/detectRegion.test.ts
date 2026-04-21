/**
 * Tests for `detectRegion` — region-aware currency + VAT disclosure.
 *
 * H7 (2026-04-21). Guards:
 *   - CF-IPCountry header precedence over Accept-Language.
 *   - UK → GBP + inclusive VAT note.
 *   - EU country → EUR tag + inclusive VAT note + GBP display flag.
 *   - Unknown / default → GBP + empty VAT note (no accidental claim).
 *   - Accept-Language language-only tags (e.g. "de") fall back to EU.
 *   - Accept-Language with en-US stays on default (no VAT claim).
 */

import { describe, it, expect } from "vitest";
import { detectRegion } from "@/lib/region/detectRegion";

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

  it("returns default region for CF-IPCountry=US", () => {
    const r = detectRegion(fakeHeaders({ "CF-IPCountry": "US" }));
    expect(r.currency).toBe("GBP");
    expect(r.vatNote).toBe("");
  });

  it("prefers CF-IPCountry over Accept-Language", () => {
    const r = detectRegion(
      fakeHeaders({ "CF-IPCountry": "US", "Accept-Language": "en-GB,en;q=0.9" }),
    );
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
    expect(r.vatNote).toBe("");
  });

  it("returns default when no headers present", () => {
    const r = detectRegion(fakeHeaders({}));
    expect(r.currency).toBe("GBP");
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
