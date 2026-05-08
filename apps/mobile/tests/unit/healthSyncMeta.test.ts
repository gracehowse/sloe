/**
 * Pattern #9 (`AN8GJ1Dr3M`, 2026-05-08) — pin the healthSyncMeta
 * AsyncStorage helper. The provenance sheet's "Last synced X ago" row
 * depends on this stamp surviving across app cold-starts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

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
  clearHealthSyncedAt,
  loadHealthLastSyncedAt,
  recordHealthSyncedAt,
} from "../../lib/healthSyncMeta";

describe("Pattern #9 — healthSyncMeta", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns null when nothing's been recorded yet", async () => {
    expect(await loadHealthLastSyncedAt()).toBeNull();
  });

  it("recordHealthSyncedAt persists the timestamp; loadHealthLastSyncedAt reads it back", async () => {
    const ms = 1_777_999_888_777;
    await recordHealthSyncedAt(ms);
    expect(await loadHealthLastSyncedAt()).toBe(ms);
  });

  it("ignores invalid inputs (no crash, no write)", async () => {
    await recordHealthSyncedAt(0);
    await recordHealthSyncedAt(-100);
    await recordHealthSyncedAt(NaN);
    expect(await loadHealthLastSyncedAt()).toBeNull();
  });

  it("clearHealthSyncedAt wipes the timestamp", async () => {
    await recordHealthSyncedAt(Date.now());
    await clearHealthSyncedAt();
    expect(await loadHealthLastSyncedAt()).toBeNull();
  });

  it("treats a corrupt non-numeric payload as missing", async () => {
    store.set("@suppr/healthSyncMeta/lastSyncedAt/v1", "not-a-number");
    expect(await loadHealthLastSyncedAt()).toBeNull();
  });
});
