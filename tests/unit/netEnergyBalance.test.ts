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

  it("places the slider marker from net vs maintenance", () => {
    const frac = netEnergyMarkerFraction(492, 1289, 0, true);
    expect(frac).toBeGreaterThan(0.05);
    expect(frac).toBeLessThan(0.5);
  });

  it("uses burned-so-far copy when nothing is eaten", () => {
    expect(
      netEnergySubline({
        burnedKcal: 492,
        eatenKcal: 0,
        isToday: true,
        netKcal: 492,
        isDeficit: true,
      }),
    ).toBe("492 kcal burned so far · no food logged yet.");
  });
});
