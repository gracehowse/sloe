/**
 * householdSharingGrid — 2026-04-20 prototype port.
 *
 * Pins the preset→grid mapping, cycle/toggle semantics, the
 * share_lunch derivation (the one server-side column that actually
 * filters meals), and the short-label copy used by More-tab row
 * subtitles. These are the primitives the HouseholdSettingsPage UI
 * rests on — regressing them quietly would reshape what's shared
 * server-side, which is a legal-gated surface (F-16).
 */
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_DAY_IDS,
  HOUSEHOLD_SLOT_IDS,
  HOUSEHOLD_SHARING_PRESETS,
  buildGridForPreset,
  cellMembers,
  cycleCell,
  deriveShareLunch,
  emptyGrid,
  presetFromShareLunch,
  sharedCellCount,
  sharingPresetShortLabel,
  toggleCellMember,
} from "@/lib/household/sharingGrid";

const MEMBERS = ["me", "p", "k1", "k2"];

describe("buildGridForPreset", () => {
  it("all → every cell has every member", () => {
    const g = buildGridForPreset("all", MEMBERS);
    for (const d of HOUSEHOLD_DAY_IDS) {
      for (const s of HOUSEHOLD_SLOT_IDS) {
        expect(cellMembers(g, d, s).sort()).toEqual([...MEMBERS].sort());
      }
    }
  });

  it("none → every cell solo", () => {
    const g = buildGridForPreset("none", MEMBERS);
    for (const d of HOUSEHOLD_DAY_IDS) {
      for (const s of HOUSEHOLD_SLOT_IDS) {
        expect(cellMembers(g, d, s)).toEqual([]);
      }
    }
  });

  it("dinners → only dinner cells shared, others solo", () => {
    const g = buildGridForPreset("dinners", MEMBERS);
    for (const d of HOUSEHOLD_DAY_IDS) {
      expect(cellMembers(g, d, "dinner").length).toBe(MEMBERS.length);
      expect(cellMembers(g, d, "breakfast")).toEqual([]);
      expect(cellMembers(g, d, "lunch")).toEqual([]);
      expect(cellMembers(g, d, "snack")).toEqual([]);
    }
  });

  it("weekends → all dinners + weekend breakfast/lunch shared, weekday breakfast/lunch solo", () => {
    const g = buildGridForPreset("weekends", MEMBERS);
    // Every dinner shared
    for (const d of HOUSEHOLD_DAY_IDS) {
      expect(cellMembers(g, d, "dinner").length).toBe(MEMBERS.length);
    }
    // Weekday non-dinner solo
    for (const d of ["mon", "tue", "wed", "thu", "fri"] as const) {
      expect(cellMembers(g, d, "breakfast")).toEqual([]);
      expect(cellMembers(g, d, "lunch")).toEqual([]);
    }
    // Weekend: every slot shared (prototype: `(d==='sat'||d==='sun') ? all : …`)
    for (const d of ["sat", "sun"] as const) {
      expect(cellMembers(g, d, "breakfast").length).toBe(MEMBERS.length);
      expect(cellMembers(g, d, "lunch").length).toBe(MEMBERS.length);
      expect(cellMembers(g, d, "snack").length).toBe(MEMBERS.length);
    }
  });

  it("custom → returns an empty grid (caller overlays)", () => {
    const g = buildGridForPreset("custom", MEMBERS);
    expect(g).toEqual(emptyGrid());
  });
});

describe("cycleCell", () => {
  it("solo → everyone → solo", () => {
    let g = emptyGrid();
    expect(cellMembers(g, "mon", "lunch")).toEqual([]);
    g = cycleCell(g, "mon", "lunch", MEMBERS);
    expect(cellMembers(g, "mon", "lunch").sort()).toEqual([...MEMBERS].sort());
    g = cycleCell(g, "mon", "lunch", MEMBERS);
    expect(cellMembers(g, "mon", "lunch")).toEqual([]);
  });

  it("partial set → cycles to everyone (not solo)", () => {
    const g = buildGridForPreset("all", MEMBERS);
    const g2 = toggleCellMember(g, "mon", "lunch", "k2"); // remove k2 → partial
    const g3 = cycleCell(g2, "mon", "lunch", MEMBERS);
    expect(cellMembers(g3, "mon", "lunch").sort()).toEqual([...MEMBERS].sort());
  });
});

describe("toggleCellMember", () => {
  it("adds a member when absent, removes when present, collapses empty → solo", () => {
    let g = emptyGrid();
    g = toggleCellMember(g, "tue", "dinner", "me");
    expect(cellMembers(g, "tue", "dinner")).toEqual(["me"]);
    g = toggleCellMember(g, "tue", "dinner", "p");
    expect(cellMembers(g, "tue", "dinner").sort()).toEqual(["me", "p"]);
    g = toggleCellMember(g, "tue", "dinner", "me");
    expect(cellMembers(g, "tue", "dinner")).toEqual(["p"]);
    g = toggleCellMember(g, "tue", "dinner", "p");
    expect(cellMembers(g, "tue", "dinner")).toEqual([]); // collapsed to solo
  });
});

describe("sharedCellCount", () => {
  it("only counts cells with 2+ members", () => {
    expect(sharedCellCount(emptyGrid())).toBe(0);
    expect(sharedCellCount(buildGridForPreset("dinners", MEMBERS))).toBe(7);
    expect(sharedCellCount(buildGridForPreset("all", MEMBERS))).toBe(28);
    // Single-member cell isn't "shared".
    let g = emptyGrid();
    g = toggleCellMember(g, "mon", "dinner", "me");
    expect(sharedCellCount(g)).toBe(0);
  });
});

describe("deriveShareLunch", () => {
  it("false for empty grid / dinners-only preset", () => {
    expect(deriveShareLunch(emptyGrid())).toBe(false);
    expect(deriveShareLunch(buildGridForPreset("dinners", MEMBERS))).toBe(false);
  });

  it("true when any lunch cell has 2+ members", () => {
    expect(deriveShareLunch(buildGridForPreset("all", MEMBERS))).toBe(true);
    expect(deriveShareLunch(buildGridForPreset("weekends", MEMBERS))).toBe(true);
    // Custom: add one weekday lunch only.
    let g = buildGridForPreset("dinners", MEMBERS);
    g = toggleCellMember(g, "wed", "lunch", "me");
    g = toggleCellMember(g, "wed", "lunch", "p");
    expect(deriveShareLunch(g)).toBe(true);
  });
});

describe("presetFromShareLunch", () => {
  it("picks dinners when share_lunch=false, weekends when true", () => {
    expect(presetFromShareLunch(false)).toBe("dinners");
    expect(presetFromShareLunch(true)).toBe("weekends");
  });
});

describe("sharingPresetShortLabel", () => {
  it("maps every preset to a short human label", () => {
    expect(sharingPresetShortLabel("all")).toBe("all meals sharing");
    expect(sharingPresetShortLabel("dinners")).toBe("dinners sharing");
    expect(sharingPresetShortLabel("weekends")).toBe("dinners + weekends");
    expect(sharingPresetShortLabel("none")).toBe("solo");
    expect(sharingPresetShortLabel("custom")).toBe("custom sharing");
  });
});

describe("HOUSEHOLD_SHARING_PRESETS copy — pinned to prototype", () => {
  it("matches the prototype label + sub ordering verbatim", () => {
    expect(HOUSEHOLD_SHARING_PRESETS.map((p) => p.id)).toEqual([
      "all",
      "dinners",
      "weekends",
      "none",
      "custom",
    ]);
    expect(HOUSEHOLD_SHARING_PRESETS.find((p) => p.id === "weekends")?.label).toBe(
      "Dinners + weekends",
    );
    expect(HOUSEHOLD_SHARING_PRESETS.find((p) => p.id === "none")?.label).toBe("Individual");
  });
});
