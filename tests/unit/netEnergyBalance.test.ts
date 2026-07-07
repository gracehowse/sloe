import { describe, expect, it } from "vitest";
import {
  netEnergyChipState,
  netEnergyKcalUnit,
  netEnergyMarkerFraction,
  netEnergySubline,
} from "../../src/lib/nutrition/netEnergyBalance";

describe("netEnergyBalance", () => {
  it("classifies deficit / surplus / maintenance bands", () => {
    expect(netEnergyChipState(492)).toBe("deficit");
    expect(netEnergyChipState(-200)).toBe("surplus");
    expect(netEnergyChipState(30)).toBe("maintenance");
  });

  it("formats kcal unit from chip state", () => {
    expect(netEnergyKcalUnit("deficit")).toBe("kcal deficit");
    expect(netEnergyKcalUnit("surplus")).toBe("kcal surplus");
  });

  it("places the slider marker via state-anchored bands (ENG-878, SSOT _buildenergy.mjs)", () => {
    // Canonical prototype case (burned 492, eaten 0, maintenance 1289):
    // intensity = (492-60)/1289 ≈ 0.335 → 42 - 0.335*34 ≈ 31% → 0.31.
    expect(netEnergyMarkerFraction(492, 1289, 0, true)).toBeCloseTo(0.31, 2);
    // Maintenance band (|net| ≤ 60) → dead centre.
    expect(netEnergyMarkerFraction(30, 1289, 500, false)).toBe(0.5);
    expect(netEnergyMarkerFraction(-30, 1289, 500, false)).toBe(0.5);
    // Shallow deficit (just past +60) → top of the left third (~42%).
    expect(netEnergyMarkerFraction(61, 1289, 500, true)).toBeCloseTo(0.42, 2);
    // Deep deficit (≥ maintenance past threshold) → clamped to 8%.
    expect(netEnergyMarkerFraction(60 + 1289, 1289, 0, true)).toBeCloseTo(0.08, 2);
    expect(netEnergyMarkerFraction(9000, 1289, 0, true)).toBeCloseTo(0.08, 2);
    // Shallow surplus (just past -60) → bottom of the right third (~58%).
    expect(netEnergyMarkerFraction(-61, 1289, 2000, false)).toBeCloseTo(0.58, 2);
    // Deep surplus → clamped to 92%.
    expect(netEnergyMarkerFraction(-(60 + 1289), 1289, 3000, false)).toBeCloseTo(0.92, 2);
  });

  it("the marker can NEVER contradict the chip (deficit left / maintenance centre / surplus right)", () => {
    for (const net of [-4000, -1300, -200, -61, -60, -30, 0, 30, 60, 61, 200, 1349, 4000]) {
      const frac = netEnergyMarkerFraction(net, 1289, 500, net > 0);
      const state = netEnergyChipState(net);
      if (state === "maintenance") expect(frac).toBe(0.5);
      else if (state === "deficit") expect(frac).toBeLessThan(0.5); // left third
      else expect(frac).toBeGreaterThan(0.5); // surplus → right third
    }
  });

  it("uses burned-so-far copy when nothing is eaten", () => {
    expect(
      netEnergySubline({
        burnedKcal: 492,
        eatenKcal: 0,
        isToday: true,
        netKcal: 492,
      }),
    ).toBe("492 kcal burned so far · no food logged yet.");
  });

  describe("netEnergySubline band coherence", () => {
    it("maintenance band uses balanced copy, not burned/eaten more", () => {
      for (const net of [30, -30, 60, -60, 0]) {
        const subline = netEnergySubline({
          burnedKcal: 1500,
          eatenKcal: 1500 - net,
          isToday: true,
          netKcal: net,
        });
        expect(subline).toContain("within 60 kcal of maintenance");
        expect(subline).not.toMatch(/burned \d+ more/);
        expect(subline).not.toMatch(/eaten \d+ more/);
        expect(netEnergyChipState(net)).toBe("maintenance");
      }
    });

    it("deficit and surplus bands use directional copy", () => {
      expect(
        netEnergySubline({
          burnedKcal: 2000,
          eatenKcal: 1939,
          isToday: true,
          netKcal: 61,
        }),
      ).toBe("You've burned 61 more than you've eaten today.");
      expect(
        netEnergySubline({
          burnedKcal: 2000,
          eatenKcal: 2061,
          isToday: true,
          netKcal: -61,
        }),
      ).toBe("You've eaten 61 more than you've burned today.");
    });

    it("subline agrees with chip state across the net range", () => {
      for (const net of [-4000, -1300, -200, -61, -60, -30, 0, 30, 60, 61, 200, 1349, 4000]) {
        const state = netEnergyChipState(net);
        const subline = netEnergySubline({
          burnedKcal: 2000,
          eatenKcal: 2000 - net,
          isToday: true,
          netKcal: net,
        });
        if (state === "maintenance") {
          expect(subline).toContain("within 60 kcal of maintenance");
        } else if (state === "deficit") {
          expect(subline).toContain("burned");
          expect(subline).toContain("more than you've eaten");
        } else {
          expect(subline).toContain("eaten");
          expect(subline).toContain("more than you've burned");
        }
      }
    });
  });

  describe("ENG-1454 — stagedNeutralSurplusFraming (behind coaching_stages_v1)", () => {
    it("omitted/false → the legacy 2nd-person surplus line, byte-identical (kill switch)", () => {
      const subline = netEnergySubline({
        burnedKcal: 2000,
        eatenKcal: 2061,
        isToday: true,
        netKcal: -61,
      });
      expect(subline).toBe("You've eaten 61 more than you've burned today.");

      const explicitFalse = netEnergySubline({
        burnedKcal: 2000,
        eatenKcal: 2061,
        isToday: true,
        netKcal: -61,
        stagedNeutralSurplusFraming: false,
      });
      expect(explicitFalse).toBe(subline);
    });

    it("true + surplus → the neutral 'Net energy today: +{n} kcal' framing", () => {
      const subline = netEnergySubline({
        burnedKcal: 2000,
        eatenKcal: 4204,
        isToday: true,
        netKcal: -2204,
        stagedNeutralSurplusFraming: true,
      });
      expect(subline).toBe("Net energy today: +2204 kcal");
      expect(subline).not.toMatch(/you'?ve eaten/i);
    });

    it("true but deficit/maintenance → UNCHANGED (only the surplus branch is gated)", () => {
      const deficitSubline = netEnergySubline({
        burnedKcal: 2000,
        eatenKcal: 1939,
        isToday: true,
        netKcal: 61,
        stagedNeutralSurplusFraming: true,
      });
      expect(deficitSubline).toBe("You've burned 61 more than you've eaten today.");

      const maintenanceSubline = netEnergySubline({
        burnedKcal: 1500,
        eatenKcal: 1500,
        isToday: true,
        netKcal: 0,
        stagedNeutralSurplusFraming: true,
      });
      expect(maintenanceSubline).toContain("within 60 kcal of maintenance");
    });
  });
});
