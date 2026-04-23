/**
 * writeHealthSnapshot — mobile write path for the `health_snapshots`
 * table (D4, 2026-04-21). Pins:
 *  - Payload shape matches the migration column set.
 *  - 15-minute throttle is enforced (no second insert within the
 *    window) and `explicit: true` bypasses it.
 *  - "No data to snapshot" path never inserts (no useless rows).
 *  - A transport error is caught, not thrown.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase mock — a tiny recorder for `from().insert()` and
// `from().select().eq().maybeSingle()`.
type ProfileRow = {
  steps_by_day?: Record<string, number>;
  activity_burn_by_day?: Record<string, number>;
  basal_burn_by_day?: Record<string, number>;
  weight_kg_by_day?: Record<string, number>;
  weight_kg?: number | null;
};

let mockProfile: ProfileRow | null = null;
let insertPayloads: Array<Record<string, unknown>> = [];
let insertError: { message: string } | null = null;

const selectEqChain = {
  eq: vi.fn(() => selectEqChain),
  maybeSingle: vi.fn(async () => ({ data: mockProfile, error: null })),
};
const selectMock = vi.fn(() => selectEqChain);
const insertMock = vi.fn(async (payload: Record<string, unknown>) => {
  insertPayloads.push(payload);
  return { error: insertError };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "profiles") return { select: selectMock };
      if (table === "health_snapshots") return { insert: insertMock };
      throw new Error(`unexpected table ${table}`);
    }),
  },
}));

vi.mock("../../lib/errorTracking", () => ({ captureException: vi.fn() }));
vi.mock("expo-constants", () => ({
  default: {
    executionEnvironment: "standalone",
    appOwnership: "standalone",
    sessionId: "session-abc",
    installationId: "install-xyz",
    expoConfig: { extra: {} },
  },
  ExecutionEnvironment: {
    StoreClient: "storeClient",
    Standalone: "standalone",
    Bare: "bare",
  },
}));

// Import after mocks so the module picks them up.
import {
  writeHealthSnapshot,
  __resetHealthSnapshotThrottleForTests,
} from "../../lib/healthSync";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

beforeEach(() => {
  __resetHealthSnapshotThrottleForTests();
  insertPayloads = [];
  insertError = null;
  mockProfile = null;
  selectMock.mockClear();
  insertMock.mockClear();
  selectEqChain.eq.mockClear();
  selectEqChain.maybeSingle.mockClear();
});

describe("writeHealthSnapshot", () => {
  it("inserts a row with today's bucket values and the expected columns", async () => {
    const day = todayKey();
    mockProfile = {
      steps_by_day: { [day]: 6421 },
      activity_burn_by_day: { [day]: 312 },
      basal_burn_by_day: { [day]: 1604 },
      weight_kg_by_day: {},
      weight_kg: 71.4,
    };

    const result = await writeHealthSnapshot("user-1");

    expect(result).toEqual({ wrote: true, throttled: false });
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toEqual({
      user_id: "user-1",
      steps: 6421,
      active_energy_kcal: 312,
      resting_burn_kcal: 1604,
      weight_kg: 71.4,
      source: "healthkit",
      device_id: "install-xyz",
    });
  });

  it("throttles the next write within 15 minutes", async () => {
    const day = todayKey();
    mockProfile = { steps_by_day: { [day]: 100 } };

    await writeHealthSnapshot("user-1");
    const second = await writeHealthSnapshot("user-1");

    expect(second).toEqual({ wrote: false, throttled: true });
    expect(insertPayloads).toHaveLength(1);
  });

  it("bypasses the throttle when explicit=true (user-triggered refresh)", async () => {
    const day = todayKey();
    mockProfile = { steps_by_day: { [day]: 100 } };

    await writeHealthSnapshot("user-1");
    const second = await writeHealthSnapshot("user-1", { explicit: true });

    expect(second).toEqual({ wrote: true, throttled: false });
    expect(insertPayloads).toHaveLength(2);
  });

  it("does NOT insert a row when there is nothing meaningful to snapshot", async () => {
    mockProfile = {
      steps_by_day: {},
      activity_burn_by_day: {},
      basal_burn_by_day: {},
      weight_kg_by_day: {},
      weight_kg: null,
    };

    const result = await writeHealthSnapshot("user-1");
    expect(result).toEqual({ wrote: false, throttled: false });
    expect(insertPayloads).toHaveLength(0);
  });

  it("swallows a transport error rather than rejecting the caller", async () => {
    const day = todayKey();
    mockProfile = { steps_by_day: { [day]: 100 } };
    insertError = { message: "insert failed" };

    const result = await writeHealthSnapshot("user-1");
    expect(result).toEqual({ wrote: false, throttled: false });
  });

  it("short-circuits on empty userId (no network)", async () => {
    const result = await writeHealthSnapshot("");
    expect(result).toEqual({ wrote: false, throttled: false });
    expect(selectMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });
});
