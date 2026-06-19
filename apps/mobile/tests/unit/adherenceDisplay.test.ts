/**
 * adherence_over_display (audit P1-3) — mobile-side resolution + parity pin.
 *
 * Confirms the shared `formatAdherenceHeadline` helper resolves through the
 * mobile `@suppr/shared/*` alias (the same source web imports via
 * `@/lib/...`), and re-asserts the three bands on the mobile path so a
 * platform-specific resolution break or divergence is caught here too. The
 * full band matrix lives in the web `tests/unit/adherenceDisplay.test.ts`;
 * this is the cross-platform parity guarantee that both surfaces read the
 * SAME numbers from the SAME module.
 */
import { describe, expect, it } from "vitest";

import { formatAdherenceHeadline } from "@suppr/nutrition-core/adherenceDisplay";

describe("formatAdherenceHeadline (mobile @suppr/shared resolution + parity)", () => {
  it("under target: 82 → '82%' Under target (sage)", () => {
    expect(formatAdherenceHeadline(82)).toEqual({
      value: 82,
      suffix: "%",
      qualifier: null,
      label: "Under target",
      tone: "under",
    });
  });

  it("on target: 97 → '97%' On target (sage)", () => {
    expect(formatAdherenceHeadline(97)).toEqual({
      value: 97,
      suffix: "%",
      qualifier: null,
      label: "On target",
      tone: "on",
    });
  });

  it("100–110 stays raw On target (105 → '105%', no '5% over')", () => {
    expect(formatAdherenceHeadline(105)?.label).toBe("On target");
    expect(formatAdherenceHeadline(110)?.tone).toBe("on");
  });

  it("over target: 111 → '11% over' Over target (amber), never '111%'", () => {
    expect(formatAdherenceHeadline(111)).toEqual({
      value: 11,
      suffix: "% over",
      qualifier: "over",
      label: "Over target",
      tone: "over",
    });
  });

  it("null input returns null (no fabricated number on mobile)", () => {
    expect(formatAdherenceHeadline(null)).toBeNull();
  });
});
