import { describe, expect, it } from "vitest";
import {
  canGenerateFromSource,
  DEFAULT_PLAN_SOURCE_MODE,
  isPlanSourceMode,
  PLAN_SOURCE_MODES,
  planSourceLabel,
  selectPlanPool,
} from "@/lib/planning/planSource.ts";

type R = { id: string; name: string };

const lib: R[] = [
  { id: "a", name: "Library A" },
  { id: "b", name: "Library B" },
];
const discover: R[] = [
  { id: "b", name: "Discover B (dupe of library)" },
  { id: "c", name: "Discover C" },
];

describe("selectPlanPool", () => {
  it("library mode returns only the library pool", () => {
    expect(selectPlanPool("library", { library: lib, discover }).map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("discovery mode returns only the discover pool", () => {
    expect(
      selectPlanPool("discovery", { library: lib, discover }).map((r) => r.id),
    ).toEqual(["b", "c"]);
  });

  it("combined mode concatenates and de-dupes discover against library", () => {
    const out = selectPlanPool("library_and_discovery", { library: lib, discover });
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]);
    // the duplicate "b" keeps the LIBRARY copy, not the discover one
    expect(out.find((r) => r.id === "b")?.name).toBe("Library B");
  });

  it("returns a fresh array (does not alias the input pools)", () => {
    const out = selectPlanPool("library", { library: lib, discover });
    expect(out).not.toBe(lib);
  });

  it("handles empty pools without throwing", () => {
    expect(selectPlanPool("library_and_discovery", { library: [], discover: [] })).toEqual([]);
  });
});

describe("canGenerateFromSource", () => {
  it("library mode needs at least one library recipe", () => {
    expect(canGenerateFromSource("library", { libraryCount: 0, discoverCount: 9 })).toBe(false);
    expect(canGenerateFromSource("library", { libraryCount: 1, discoverCount: 0 })).toBe(true);
  });

  it("discovery mode needs at least one discover recipe", () => {
    expect(canGenerateFromSource("discovery", { libraryCount: 9, discoverCount: 0 })).toBe(false);
    expect(canGenerateFromSource("discovery", { libraryCount: 0, discoverCount: 1 })).toBe(true);
  });

  it("combined mode needs at least one recipe across either pool", () => {
    expect(
      canGenerateFromSource("library_and_discovery", { libraryCount: 0, discoverCount: 0 }),
    ).toBe(false);
    expect(
      canGenerateFromSource("library_and_discovery", { libraryCount: 0, discoverCount: 1 }),
    ).toBe(true);
    expect(
      canGenerateFromSource("library_and_discovery", { libraryCount: 1, discoverCount: 0 }),
    ).toBe(true);
  });
});

describe("constants + guards", () => {
  it("default mode is the broadest pool", () => {
    expect(DEFAULT_PLAN_SOURCE_MODE).toBe("library_and_discovery");
  });

  it("exposes exactly the three modes in fixed order", () => {
    expect(PLAN_SOURCE_MODES).toEqual(["library", "library_and_discovery", "discovery"]);
  });

  it("isPlanSourceMode accepts valid modes and rejects everything else", () => {
    expect(isPlanSourceMode("library")).toBe(true);
    expect(isPlanSourceMode("library_and_discovery")).toBe(true);
    expect(isPlanSourceMode("discovery")).toBe(true);
    expect(isPlanSourceMode("everything")).toBe(false);
    expect(isPlanSourceMode(null)).toBe(false);
    expect(isPlanSourceMode(undefined)).toBe(false);
  });

  it("every mode has a human label", () => {
    for (const mode of PLAN_SOURCE_MODES) {
      expect(planSourceLabel(mode).length).toBeGreaterThan(0);
    }
  });
});
