/**
 * F-130 (2026-05-07) — pin the local HK delete-tombstone helper.
 *
 * The helper is the only thing standing between "user deletes a
 * duplicate HK meal" and "next sync re-imports the same duplicate".
 * Test against an in-memory AsyncStorage mock.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// AsyncStorage in-memory mock — must be defined before importing the
// helper because the helper does a dynamic import inside its functions.
const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
  },
}));

import {
  __resetDeletedHealthSamplesCacheForTests,
  clearDeletedHealthSampleIds,
  loadDeletedHealthSampleIds,
  markHealthSampleDeleted,
} from "../../lib/deletedHealthSamples";

describe("F-130 — deletedHealthSamples tombstone", () => {
  beforeEach(() => {
    store.clear();
    __resetDeletedHealthSamplesCacheForTests();
  });

  it("starts empty when AsyncStorage has no tombstone yet", async () => {
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
  });

  it("markHealthSampleDeleted persists the id and surfaces it on next load", async () => {
    await markHealthSampleDeleted("hk-uuid-1");
    __resetDeletedHealthSamplesCacheForTests();
    const set = await loadDeletedHealthSampleIds();
    expect(set.has("hk-uuid-1")).toBe(true);
  });

  it("ignores null / empty / non-string ids (no crash, no entry)", async () => {
    await markHealthSampleDeleted(null);
    await markHealthSampleDeleted(undefined);
    await markHealthSampleDeleted("");
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
  });

  it("dedupes — marking the same id twice keeps the set size 1", async () => {
    await markHealthSampleDeleted("hk-uuid-1");
    await markHealthSampleDeleted("hk-uuid-1");
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(1);
  });

  it("clearDeletedHealthSampleIds wipes the tombstone (for a future re-import affordance)", async () => {
    await markHealthSampleDeleted("hk-uuid-1");
    await markHealthSampleDeleted("hk-uuid-2");
    await clearDeletedHealthSampleIds();
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
  });

  it("survives a corrupted AsyncStorage payload by treating it as empty", async () => {
    store.set("@suppr/deletedHealthSampleIds/v1", "{not-an-array}");
    __resetDeletedHealthSamplesCacheForTests();
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
    // After a corrupted load, marking a new id should still work.
    await markHealthSampleDeleted("hk-uuid-3");
    __resetDeletedHealthSamplesCacheForTests();
    const set2 = await loadDeletedHealthSampleIds();
    expect(set2.has("hk-uuid-3")).toBe(true);
  });
});
