import { describe, expect, it } from "vitest";
import {
  appChoiceDisplayName,
  appChoiceHasImporter,
  buildAppChoiceOptions,
} from "../../src/lib/onboarding/appChoiceOptions";
import { REGISTERED_ADAPTERS } from "../../src/lib/imports/csv/adapters/registry";

/**
 * ENG-990 — the app-choice option set must stay derived from the CSV
 * adapter registry so a refugee is never offered an "import your history"
 * tile for an app we can't actually parse (the brief's "no dead options"
 * rule). These tests pin that derivation contract; if an adapter is added
 * or removed, the picker follows automatically and these assertions
 * confirm it.
 */

describe("buildAppChoiceOptions", () => {
  it("surfaces exactly the registered adapters as importable tiles, in registry order", () => {
    const options = buildAppChoiceOptions();
    const importable = options.filter((o) => o.hasImporter);
    expect(importable.map((o) => o.id)).toEqual(
      REGISTERED_ADAPTERS.map((a) => a.source),
    );
    // Labels come from the adapter displayName — no hand-typed drift.
    expect(importable.map((o) => o.label)).toEqual(
      REGISTERED_ADAPTERS.map((a) => a.displayName),
    );
  });

  it("puts MyFitnessPal first (priority refugee cohort)", () => {
    // The registry registers MFP first; the picker must lead with it so
    // the highest-value switch is the first thing a user sees.
    const options = buildAppChoiceOptions();
    expect(options[0].id).toBe("mfp");
    expect(options[0].label).toBe("MyFitnessPal");
    expect(options[0].hasImporter).toBe(true);
  });

  it("always appends the two non-adapter tiles last, with no importer", () => {
    const options = buildAppChoiceOptions();
    const last2 = options.slice(-2);
    expect(last2.map((o) => o.id)).toEqual(["other", "none"]);
    expect(last2.every((o) => o.hasImporter === false)).toBe(true);
  });

  it("never offers a dead importable tile (every hasImporter:true id has a live adapter)", () => {
    for (const opt of buildAppChoiceOptions()) {
      if (opt.hasImporter) {
        expect(REGISTERED_ADAPTERS.some((a) => a.source === opt.id)).toBe(true);
      }
    }
  });
});

describe("appChoiceHasImporter", () => {
  it("is true for every registered adapter source", () => {
    for (const adapter of REGISTERED_ADAPTERS) {
      expect(appChoiceHasImporter(adapter.source as never)).toBe(true);
    }
  });

  it("is false for other / none / null", () => {
    expect(appChoiceHasImporter("other")).toBe(false);
    expect(appChoiceHasImporter("none")).toBe(false);
    expect(appChoiceHasImporter(null)).toBe(false);
  });
});

describe("appChoiceDisplayName", () => {
  it("returns the adapter displayName for importable choices", () => {
    expect(appChoiceDisplayName("mfp")).toBe("MyFitnessPal");
    // Whatever else is registered, the name matches the adapter.
    for (const adapter of REGISTERED_ADAPTERS) {
      expect(appChoiceDisplayName(adapter.source as never)).toBe(
        adapter.displayName,
      );
    }
  });

  it("returns null for other / none / null (no importer pre-highlight)", () => {
    expect(appChoiceDisplayName("other")).toBeNull();
    expect(appChoiceDisplayName("none")).toBeNull();
    expect(appChoiceDisplayName(null)).toBeNull();
  });
});
