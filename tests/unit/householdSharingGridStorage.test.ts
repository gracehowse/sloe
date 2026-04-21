/**
 * Storage adapter for the household sharing grid — parity pins for
 * key naming, serialisation round-trip, and defensive normalisation
 * of malformed JSON from storage.
 */
import { describe, expect, it } from "vitest";
import {
  parseSharingStateJson,
  readSharingState,
  serialiseSharingState,
  sharingStorageKey,
  writeSharingState,
  type SharingStorageAdapter,
} from "@/lib/household/sharingGridStorage";
import {
  buildGridForPreset,
  emptyGrid,
  type HouseholdSharingState,
} from "@/lib/household/sharingGrid";

const MEMBERS = ["me", "p"];

function makeMemoryAdapter(): SharingStorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

describe("sharingStorageKey", () => {
  it("is versioned and household-scoped", () => {
    expect(sharingStorageKey("hhid-123")).toBe("suppr.householdSharing.v1.hhid-123");
  });
});

describe("round-trip", () => {
  it("writes and reads back the same state", async () => {
    const adapter = makeMemoryAdapter();
    const state: HouseholdSharingState = {
      preset: "weekends",
      grid: buildGridForPreset("weekends", MEMBERS),
    };
    await writeSharingState(adapter, "hhid", state);
    const back = await readSharingState(adapter, "hhid");
    expect(back).toEqual(state);
  });
});

describe("parseSharingStateJson", () => {
  it("returns null on nullish / empty / garbage", () => {
    expect(parseSharingStateJson(null)).toBeNull();
    expect(parseSharingStateJson("")).toBeNull();
    expect(parseSharingStateJson("not json")).toBeNull();
  });

  it("normalises malformed cells to solo", () => {
    const raw = JSON.stringify({
      preset: "custom",
      grid: {
        mon: { lunch: 12345, dinner: ["x", "y"], breakfast: null, snack: "solo" },
      },
    });
    const parsed = parseSharingStateJson(raw);
    expect(parsed?.preset).toBe("custom");
    expect(parsed?.grid.mon.lunch).toBe("solo");
    expect(parsed?.grid.mon.dinner).toEqual(["x", "y"]);
    expect(parsed?.grid.mon.breakfast).toBe("solo");
    expect(parsed?.grid.mon.snack).toBe("solo");
  });

  it("defaults unknown preset to 'dinners'", () => {
    const raw = JSON.stringify({ preset: "bogus", grid: {} });
    expect(parseSharingStateJson(raw)?.preset).toBe("dinners");
  });
});

describe("serialiseSharingState", () => {
  it("round-trips through JSON.parse", () => {
    const state: HouseholdSharingState = { preset: "dinners", grid: emptyGrid() };
    const json = serialiseSharingState(state);
    expect(JSON.parse(json)).toEqual(state);
  });
});
