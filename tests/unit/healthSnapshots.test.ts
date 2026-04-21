/**
 * getLatestHealthSnapshot + formatHealthSnapshotSyncedAgo +
 * isHealthSnapshotStale — web adapter unit tests.
 *
 * Mirrors the contract used by the Progress-page Apple Health card:
 * empty accounts return `null` (not an error), transport errors throw,
 * the latest captured_at wins, and the stale threshold is 24h.
 */
import { describe, expect, it } from "vitest";
import {
  getLatestHealthSnapshot,
  formatHealthSnapshotSyncedAgo,
  isHealthSnapshotStale,
} from "../../src/lib/health/healthSnapshots";

type QueryResult = { data: unknown; error: { message: string } | null };

function makeClient(result: QueryResult) {
  const calls: Array<Record<string, unknown>> = [];
  const builder: any = {
    select: (cols: string) => {
      calls.push({ op: "select", cols });
      return builder;
    },
    eq: (col: string, val: unknown) => {
      calls.push({ op: "eq", col, val });
      return builder;
    },
    order: (col: string, opts: Record<string, unknown>) => {
      calls.push({ op: "order", col, ...opts });
      return builder;
    },
    limit: (n: number) => {
      calls.push({ op: "limit", n });
      return builder;
    },
    maybeSingle: async () => result,
  };
  return {
    from: (table: string) => {
      calls.push({ op: "from", table });
      return builder;
    },
    __calls: calls,
  };
}

describe("getLatestHealthSnapshot", () => {
  it("returns null when the account has never synced (no rows)", async () => {
    const client = makeClient({ data: null, error: null });
    const result = await getLatestHealthSnapshot(client as any, "user-1");
    expect(result).toBeNull();
    // Confirms we queried the right table, column, and ordering.
    expect(client.__calls).toEqual(
      expect.arrayContaining([
        { op: "from", table: "health_snapshots" },
        { op: "eq", col: "user_id", val: "user-1" },
        expect.objectContaining({ op: "order", col: "captured_at", ascending: false }),
        { op: "limit", n: 1 },
      ]),
    );
  });

  it("returns a normalised snapshot on the success path", async () => {
    const client = makeClient({
      data: {
        captured_at: "2026-04-21T09:00:00Z",
        steps: 6421,
        active_energy_kcal: 312,
        resting_burn_kcal: 1604,
        // numeric columns come back as strings over supabase-js.
        weight_kg: "71.40",
        source: "healthkit",
        device_id: "device-abc",
      },
      error: null,
    });
    const result = await getLatestHealthSnapshot(client as any, "user-1");
    expect(result).toEqual({
      capturedAt: "2026-04-21T09:00:00Z",
      steps: 6421,
      activeEnergyKcal: 312,
      restingBurnKcal: 1604,
      weightKg: 71.4,
      source: "healthkit",
      deviceId: "device-abc",
    });
  });

  it("propagates null metric columns (partial state) without fabricating zeros", async () => {
    const client = makeClient({
      data: {
        captured_at: "2026-04-21T09:00:00Z",
        steps: 1200,
        active_energy_kcal: null,
        resting_burn_kcal: null,
        weight_kg: null,
        source: "healthkit",
        device_id: null,
      },
      error: null,
    });
    const result = await getLatestHealthSnapshot(client as any, "user-1");
    expect(result).toMatchObject({
      steps: 1200,
      activeEnergyKcal: null,
      restingBurnKcal: null,
      weightKg: null,
    });
  });

  it("throws when the transport errors", async () => {
    const client = makeClient({ data: null, error: { message: "boom" } });
    await expect(getLatestHealthSnapshot(client as any, "user-1")).rejects.toThrow(/boom/);
  });

  it("short-circuits on empty userId without hitting the network", async () => {
    const client = makeClient({ data: null, error: null });
    const result = await getLatestHealthSnapshot(client as any, "");
    expect(result).toBeNull();
    expect(client.__calls).toEqual([]);
  });
});

describe("formatHealthSnapshotSyncedAgo", () => {
  const now = new Date("2026-04-21T12:00:00Z");

  it("formats seconds-old captures as 'just now'", () => {
    expect(formatHealthSnapshotSyncedAgo("2026-04-21T11:59:45Z", now)).toBe("just now");
  });

  it("formats minutes, hours, days, weeks, months, years", () => {
    expect(formatHealthSnapshotSyncedAgo("2026-04-21T11:45:00Z", now)).toBe("15 min");
    expect(formatHealthSnapshotSyncedAgo("2026-04-21T09:00:00Z", now)).toBe("3h");
    expect(formatHealthSnapshotSyncedAgo("2026-04-19T12:00:00Z", now)).toBe("2d");
    expect(formatHealthSnapshotSyncedAgo("2026-04-07T12:00:00Z", now)).toBe("2w");
    expect(formatHealthSnapshotSyncedAgo("2026-02-01T12:00:00Z", now)).toBe("2mo");
    expect(formatHealthSnapshotSyncedAgo("2024-04-21T12:00:00Z", now)).toBe("2y");
  });

  it("returns 'just now' for future-dated captures (clock skew)", () => {
    expect(formatHealthSnapshotSyncedAgo("2026-04-21T12:00:30Z", now)).toBe("just now");
  });
});

describe("isHealthSnapshotStale", () => {
  const now = new Date("2026-04-21T12:00:00Z");
  it("returns true when > 24h old", () => {
    expect(isHealthSnapshotStale("2026-04-20T11:00:00Z", now)).toBe(true);
  });
  it("returns false when exactly under 24h", () => {
    expect(isHealthSnapshotStale("2026-04-20T13:00:00Z", now)).toBe(false);
  });
});
