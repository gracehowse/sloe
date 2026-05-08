/**
 * F-130 — pin the HK delete-tombstone helper across both storage layers:
 *  L1: AsyncStorage (offline, fast, single-device)
 *  L2: Supabase `deleted_health_samples` table (cross-device, persists
 *      across reinstall — added in PR for cross-device migration)
 *
 * The helper is the only thing standing between "user deletes a
 * duplicate HK meal" and "next sync re-imports the same duplicate".
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

// Supabase mock — controllable per test via mutable state.
type ServerRow = { user_id: string; health_sample_id: string };
const serverState = {
  rows: [] as ServerRow[],
  /** When true, every supabase call returns a missing-table error. */
  missingTable: false,
  /** When true, every supabase call returns a network-style error. */
  networkFailure: false,
  /** Spy: records every upsert payload. */
  upsertCalls: [] as Array<{ rows: ServerRow[] }>,
  /** Spy: records every select call. */
  selectCalls: 0,
};

const FAKE_USER_ID = "user-1";

function missingTableError() {
  return { code: "PGRST205", message: "relation \"deleted_health_samples\" does not exist" };
}
function networkError() {
  return { code: "ECONN", message: "network unreachable" };
}

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: FAKE_USER_ID } } }),
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: async (_col: string, _val: string) => {
          serverState.selectCalls += 1;
          if (serverState.missingTable) return { data: null, error: missingTableError() };
          if (serverState.networkFailure) return { data: null, error: networkError() };
          return { data: serverState.rows.filter((r) => r.user_id === FAKE_USER_ID), error: null };
        },
      }),
      upsert: async (rowsOrRow: ServerRow | ServerRow[], _opts: unknown) => {
        const rows = Array.isArray(rowsOrRow) ? rowsOrRow : [rowsOrRow];
        serverState.upsertCalls.push({ rows });
        if (serverState.missingTable) return { error: missingTableError() };
        if (serverState.networkFailure) return { error: networkError() };
        for (const r of rows) {
          if (!serverState.rows.some((x) => x.user_id === r.user_id && x.health_sample_id === r.health_sample_id)) {
            serverState.rows.push(r);
          }
        }
        return { error: null };
      },
      delete: () => ({
        eq: async (_col: string, val: string) => {
          serverState.rows = serverState.rows.filter((r) => r.user_id !== val);
          return { error: null };
        },
      }),
    }),
  },
}));

import {
  __resetDeletedHealthSamplesCacheForTests,
  clearDeletedHealthSampleIds,
  loadDeletedHealthSampleIds,
  markHealthSampleDeleted,
} from "../../lib/deletedHealthSamples";

describe("F-130 — deletedHealthSamples tombstone (L1 + L2)", () => {
  beforeEach(() => {
    store.clear();
    serverState.rows = [];
    serverState.missingTable = false;
    serverState.networkFailure = false;
    serverState.upsertCalls = [];
    serverState.selectCalls = 0;
    __resetDeletedHealthSamplesCacheForTests();
  });

  it("starts empty when both AsyncStorage and Supabase are empty", async () => {
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
  });

  it("markHealthSampleDeleted writes L1 immediately and upserts to L2", async () => {
    await markHealthSampleDeleted("hk-uuid-1");
    expect(serverState.upsertCalls.length).toBeGreaterThanOrEqual(1);
    expect(serverState.rows).toContainEqual({
      user_id: FAKE_USER_ID,
      health_sample_id: "hk-uuid-1",
      source: "apple_health",
    });
    __resetDeletedHealthSamplesCacheForTests();
    store.clear(); // simulate reinstall — L1 wiped
    serverState.upsertCalls = [];
    const set = await loadDeletedHealthSampleIds();
    expect(set.has("hk-uuid-1")).toBe(true);
  });

  it("union(L1, L2): merges local + server sets on first read", async () => {
    // L1 has A; L2 has B. After load, set has both.
    store.set("@suppr/deletedHealthSampleIds/v1", JSON.stringify(["A"]));
    serverState.rows = [
      { user_id: FAKE_USER_ID, health_sample_id: "B" } as ServerRow,
    ];
    const set = await loadDeletedHealthSampleIds();
    expect(set.has("A")).toBe(true);
    expect(set.has("B")).toBe(true);
  });

  it("falls back to L1-only when the migration hasn't been applied", async () => {
    serverState.missingTable = true;
    await markHealthSampleDeleted("hk-uuid-1");
    const set = await loadDeletedHealthSampleIds();
    // L1 still works; no error thrown.
    expect(set.has("hk-uuid-1")).toBe(true);
  });

  it("queues to pending set on L2 network failure; drains on next call", async () => {
    serverState.networkFailure = true;
    await markHealthSampleDeleted("hk-uuid-1");
    // Pending set should hold the failed write.
    const pendingRaw = store.get("@suppr/deletedHealthSampleIds/pending/v1");
    expect(pendingRaw).toBeDefined();
    expect(JSON.parse(pendingRaw ?? "[]")).toContain("hk-uuid-1");
    // Network recovers — next mark drains pending.
    serverState.networkFailure = false;
    serverState.upsertCalls = [];
    await markHealthSampleDeleted("hk-uuid-2");
    // Both ids should be in the server set now.
    expect(serverState.rows.map((r) => r.health_sample_id).sort()).toEqual(["hk-uuid-1", "hk-uuid-2"]);
    // Pending queue cleared.
    const pendingAfter = store.get("@suppr/deletedHealthSampleIds/pending/v1");
    expect(JSON.parse(pendingAfter ?? "[]")).toEqual([]);
  });

  it("ignores null / empty / non-string ids", async () => {
    await markHealthSampleDeleted(null);
    await markHealthSampleDeleted(undefined);
    await markHealthSampleDeleted("");
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
    expect(serverState.upsertCalls.length).toBe(0);
  });

  it("dedupes — marking the same id twice keeps the set size 1", async () => {
    await markHealthSampleDeleted("hk-uuid-1");
    await markHealthSampleDeleted("hk-uuid-1");
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(1);
  });

  it("clearDeletedHealthSampleIds wipes both L1 and L2", async () => {
    await markHealthSampleDeleted("hk-uuid-1");
    await markHealthSampleDeleted("hk-uuid-2");
    await clearDeletedHealthSampleIds();
    expect(serverState.rows.length).toBe(0);
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
  });

  it("survives a corrupted AsyncStorage payload by treating it as empty", async () => {
    store.set("@suppr/deletedHealthSampleIds/v1", "{not-an-array}");
    __resetDeletedHealthSamplesCacheForTests();
    const set = await loadDeletedHealthSampleIds();
    expect(set.size).toBe(0);
  });
});
