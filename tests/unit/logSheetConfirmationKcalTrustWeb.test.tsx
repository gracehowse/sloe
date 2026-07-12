/**
 * ENG-1502 — web S13 LoggedConfirmation per-path kcal-trust rendering.
 *
 * Behavioural mirror of the mobile coverage in
 * `apps/mobile/tests/unit/logSheetPhase3.test.tsx` ("ENG-1484: behind
 * kcal_trust_qualifier_v1…"). Behind the `kcal_trust_qualifier_v1` ramp the
 * confirmation speaks the canonical ENG-1417 grammar:
 *
 *   - `kcalIsVerified: true` (a verified-USDA / Suppr-generic search pick) →
 *     the honest UNQUALIFIED number ("130 kcal").
 *   - `kcalIsVerified: false` (quick-add / history re-log / AI describe) →
 *     the `~` qualifier ("~130 kcal").
 *   - absent → also `~` (unknown trust must never read as confident).
 *
 * The host-side derivation of the bit (which path passes what) is pinned in
 * `logSheetWebMobileParity.test.ts` (ENG-1502 describe block).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { LoggedConfirmation } from "../../src/app/components/suppr/log-sheet-confirmation";

vi.mock("@/lib/analytics/track", () => ({
  track: () => {},
  // The kcal-trust ramp is ON for this suite; the flag-off "Est." kill
  // switch is covered by the mobile phase-3 suite + the parity pins.
  isFeatureEnabled: (flag: string) => flag === "kcal_trust_qualifier_v1",
}));

const base = {
  title: "Greek yogurt",
  kcal: 130,
  slot: "Breakfast",
  source: "off" as const,
  onDone: () => {},
};

describe("LoggedConfirmation (web) — ENG-1502 kcal trust grammar", () => {
  it("verified item renders the unqualified kcal (no ~, no Est.)", () => {
    const { getByText, queryByText } = render(
      <LoggedConfirmation confirmation={{ ...base, kcalIsVerified: true }} />,
    );
    expect(getByText("130 kcal")).toBeTruthy();
    expect(queryByText("~130 kcal")).toBeNull();
    expect(queryByText("Est. 130 kcal")).toBeNull();
  });

  it("unverified item (quick-add / history / AI paths pass false) renders the ~ qualifier", () => {
    const { getByText } = render(
      <LoggedConfirmation confirmation={{ ...base, kcalIsVerified: false }} />,
    );
    expect(getByText("~130 kcal")).toBeTruthy();
  });

  it("absent trust bit renders the ~ qualifier (unknown never reads as confident)", () => {
    const { getByText } = render(<LoggedConfirmation confirmation={{ ...base }} />);
    expect(getByText("~130 kcal")).toBeTruthy();
  });
});
