/**
 * seedCreators (ENG-1225 #14, `discover_creator_rail_v1`) — the presentation-
 * only SEED creator set + `resolveCreatorRail` decision. These pins protect the
 * non-negotiables: real creators ALWAYS win, the seed only shows when the flag
 * is on AND there are no real creators, every seed id is namespaced so it can
 * never collide with a real creator, and the seed never carries fabricated
 * photos.
 */
import { describe, expect, it } from "vitest";
import {
  SEED_CREATORS,
  SEED_CREATOR_CHIPS,
  isSeedCreatorId,
  resolveCreatorRail,
} from "../../src/lib/discover/seedCreators";
import type { CreatorChip } from "../../src/lib/discover/topCreators";

const real: CreatorChip[] = [
  { id: "11111111-2222-3333-4444-555555555555", handle: "real", displayName: "Real Cook", avatarUrl: null },
];

describe("SEED_CREATORS shape", () => {
  it("every id is namespaced so it can never collide with a real creator UUID", () => {
    for (const c of SEED_CREATORS) {
      expect(isSeedCreatorId(c.id)).toBe(true);
      expect(c.id.startsWith("seed-creator-")).toBe(true);
    }
  });

  it("never carries a fabricated photo (avatarUrl is always null → initial fallback)", () => {
    for (const c of SEED_CREATORS) {
      expect(c.avatarUrl).toBeNull();
    }
  });

  it("every seed has a display name, handle, spec, latest note + posted-ago", () => {
    for (const c of SEED_CREATORS) {
      expect(c.displayName.trim().length).toBeGreaterThan(0);
      expect(c.handle.trim().length).toBeGreaterThan(0);
      expect(c.spec.trim().length).toBeGreaterThan(0);
      expect(c.latestNote.trim().length).toBeGreaterThan(0);
      expect(c.postedAgo.trim().length).toBeGreaterThan(0);
    }
  });

  it("projects to plain chips with the same ids (rail data)", () => {
    expect(SEED_CREATOR_CHIPS.map((c) => c.id)).toEqual(SEED_CREATORS.map((c) => c.id));
    for (const chip of SEED_CREATOR_CHIPS) {
      expect(Object.keys(chip).sort()).toEqual(["avatarUrl", "displayName", "handle", "id"]);
    }
  });
});

describe("isSeedCreatorId", () => {
  it("is false for a real (UUID-shaped) creator id", () => {
    expect(isSeedCreatorId(real[0]!.id)).toBe(false);
  });
});

describe("resolveCreatorRail", () => {
  it("REAL creators always win — seed is irrelevant even when the flag is on", () => {
    expect(resolveCreatorRail(real, true)).toEqual(real);
    expect(resolveCreatorRail(real, false)).toEqual(real);
  });

  it("falls back to the seed ONLY when there are no real creators AND the flag is on", () => {
    expect(resolveCreatorRail([], true)).toEqual(SEED_CREATOR_CHIPS);
  });

  it("hides (returns []) when there are no real creators and the flag is off", () => {
    expect(resolveCreatorRail([], false)).toEqual([]);
  });
});
