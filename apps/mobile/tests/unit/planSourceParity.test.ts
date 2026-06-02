/**
 * ENG-790 mobile parity pin. The plan-source selector (library /
 * library_and_discovery / discovery) must run off the SAME shared helper
 * the web Plan tab uses — no reinvented pool math on mobile. Importing
 * through `@suppr/shared/planning/planSource` proves the alias resolves and
 * the de-dupe + gating behaviour matches the root-level
 * `tests/unit/planSource.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  canGenerateFromSource,
  DEFAULT_PLAN_SOURCE_MODE,
  PLAN_SOURCE_MODES,
  selectPlanPool,
} from "@suppr/shared/planning/planSource";

type R = { id: string; name: string };

const library: R[] = [
  { id: "a", name: "Library A" },
  { id: "b", name: "Library B" },
];
const discover: R[] = [
  { id: "b", name: "Discover B (dupe)" },
  { id: "c", name: "Discover C" },
];

describe("planSource (mobile alias parity)", () => {
  it("exposes the three modes with the broadest as default", () => {
    expect(PLAN_SOURCE_MODES).toEqual(["library", "library_and_discovery", "discovery"]);
    expect(DEFAULT_PLAN_SOURCE_MODE).toBe("library_and_discovery");
  });

  it("combined mode de-dupes discover against library (library copy wins)", () => {
    const out = selectPlanPool("library_and_discovery", { library, discover });
    expect(out.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(out.find((r) => r.id === "b")?.name).toBe("Library B");
  });

  it("gates generation per mode", () => {
    expect(canGenerateFromSource("library", { libraryCount: 0, discoverCount: 5 })).toBe(false);
    expect(canGenerateFromSource("discovery", { libraryCount: 5, discoverCount: 0 })).toBe(false);
    expect(
      canGenerateFromSource("library_and_discovery", { libraryCount: 0, discoverCount: 1 }),
    ).toBe(true);
  });
});
