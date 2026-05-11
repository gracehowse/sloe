/**
 * F-149 (2026-05-11) — `goal_history` table write + read helpers.
 *
 * The helper records new goal-shape rows only when the values differ
 * from the most-recent existing row. Past-day reads consult the bulk
 * lookup to find what goal was effective on each requested date.
 */

import { describe, it, expect, vi } from "vitest";
import {
  recordGoalHistory,
  getGoalEffectiveForDates,
} from "@/lib/nutrition/goalHistory";

type Op = {
  table: string;
  kind: "select" | "insert";
  payload?: unknown;
};

function buildSupabaseStub(opts: {
  existingMostRecent?: Record<string, unknown> | null;
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
  forDatesRows?: Array<Record<string, unknown>>;
  forDatesError?: { message: string } | null;
}) {
  const ops: Op[] = [];

  function buildSelectChain(rows: Array<Record<string, unknown>>, error: { message: string } | null) {
    const chain: any = {
      eq: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: rows[0] ?? null, error }),
    };
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error });
    return chain;
  }

  function from(table: string) {
    return {
      select: () => {
        ops.push({ table, kind: "select" });
        if (table === "goal_history") {
          // The read in recordGoalHistory ends with .maybeSingle(); the
          // read in getGoalEffectiveForDates ends with .order() then
          // await. We share one chain that supports both.
          const rows = opts.existingMostRecent ? [opts.existingMostRecent] : opts.forDatesRows ?? [];
          return buildSelectChain(rows, opts.selectError ?? opts.forDatesError ?? null);
        }
        return buildSelectChain([], null);
      },
      insert: async (payload: unknown) => {
        ops.push({ table, kind: "insert", payload });
        return { error: opts.insertError ?? null };
      },
    };
  }

  return { from, ops };
}

describe("recordGoalHistory — write contract", () => {
  it("inserts when no prior row exists (new user)", async () => {
    const stub = buildSupabaseStub({ existingMostRecent: null });
    const res = await recordGoalHistory(
      stub as any,
      "user-1",
      {
        goal: "cut",
        plan_pace: "steady",
        activity_level: "moderate",
        target_calories: 2100,
        target_protein_g: 160,
        target_carbs_g: 220,
        target_fat_g: 70,
        target_fiber_g: 30,
      },
      "onboarding",
      { now: new Date("2026-05-11T08:00:00Z") },
    );
    expect(res.inserted).toBe(true);
    const insertOp = stub.ops.find((o) => o.kind === "insert");
    expect(insertOp).toBeDefined();
    const payload = insertOp!.payload as Record<string, unknown>;
    expect(payload.user_id).toBe("user-1");
    expect(payload.source).toBe("onboarding");
    expect(payload.goal).toBe("cut");
    expect(payload.target_calories).toBe(2100);
    expect(typeof payload.effective_from).toBe("string");
  });

  it("no-ops when the goal-shape matches the most-recent row (dedupe)", async () => {
    const sameShape = {
      goal: "cut",
      plan_pace: "steady",
      activity_level: "moderate",
      target_calories: 2100,
      target_protein_g: 160,
      target_carbs_g: 220,
      target_fat_g: 70,
      target_fiber_g: 30,
      maintenance_tdee: null,
    };
    const stub = buildSupabaseStub({ existingMostRecent: sameShape });
    const res = await recordGoalHistory(
      stub as any,
      "user-1",
      sameShape,
      "settings_save",
    );
    expect(res.inserted).toBe(false);
    expect(res.reason).toBe("no_change");
    expect(stub.ops.some((o) => o.kind === "insert")).toBe(false);
  });

  it("inserts when activity_level changes but other fields are identical", async () => {
    const existing = {
      goal: "cut",
      plan_pace: "steady",
      activity_level: "moderate",
      target_calories: 2100,
      target_protein_g: 160,
      target_carbs_g: 220,
      target_fat_g: 70,
      target_fiber_g: 30,
    };
    const stub = buildSupabaseStub({ existingMostRecent: existing });
    const res = await recordGoalHistory(
      stub as any,
      "user-1",
      { ...existing, activity_level: "very_active" },
      "settings_save",
    );
    expect(res.inserted).toBe(true);
  });

  it("returns no_user_id when userId is missing", async () => {
    const stub = buildSupabaseStub({});
    const res = await recordGoalHistory(stub as any, null, {}, "admin");
    expect(res.inserted).toBe(false);
    expect(res.reason).toBe("no_user_id");
    expect(stub.ops.length).toBe(0);
  });

  it("swallows read error (e.g. migration not applied) and reports reason", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stub = buildSupabaseStub({ selectError: { message: "relation does not exist" } });
    const res = await recordGoalHistory(stub as any, "user-1", { goal: "cut" }, "settings_save");
    expect(res.inserted).toBe(false);
    expect(res.reason).toBe("read_failed");
    warn.mockRestore();
  });

  it("uses options.effectiveFrom override when supplied", async () => {
    const stub = buildSupabaseStub({ existingMostRecent: null });
    await recordGoalHistory(
      stub as any,
      "user-1",
      { goal: "cut" },
      "onboarding",
      { effectiveFrom: "2026-01-15" },
    );
    const insertOp = stub.ops.find((o) => o.kind === "insert");
    expect((insertOp!.payload as any).effective_from).toBe("2026-01-15");
  });
});

describe("getGoalEffectiveForDates — bulk read", () => {
  it("returns null for every date when goal_history is empty", async () => {
    const stub = buildSupabaseStub({ forDatesRows: [] });
    const out = await getGoalEffectiveForDates(stub as any, "user-1", [
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
    expect(out["2026-05-01"]).toBeNull();
    expect(out["2026-05-02"]).toBeNull();
    expect(out["2026-05-03"]).toBeNull();
  });

  it("resolves each date to the most-recent row whose effective_from <= date", async () => {
    const stub = buildSupabaseStub({
      forDatesRows: [
        {
          goal: "cut",
          plan_pace: "steady",
          activity_level: "moderate",
          target_calories: 2000,
          target_protein_g: null,
          target_carbs_g: null,
          target_fat_g: null,
          target_fiber_g: null,
          maintenance_tdee: null,
          effective_from: "2026-04-01",
          recorded_at: "2026-04-01T08:00:00Z",
        },
        {
          goal: "cut",
          plan_pace: "accelerated",
          activity_level: "moderate",
          target_calories: 1800,
          target_protein_g: null,
          target_carbs_g: null,
          target_fat_g: null,
          target_fiber_g: null,
          maintenance_tdee: null,
          effective_from: "2026-04-15",
          recorded_at: "2026-04-15T08:00:00Z",
        },
        {
          goal: "maintain",
          plan_pace: null,
          activity_level: "very_active",
          target_calories: 2400,
          target_protein_g: null,
          target_carbs_g: null,
          target_fat_g: null,
          target_fiber_g: null,
          maintenance_tdee: null,
          effective_from: "2026-05-01",
          recorded_at: "2026-05-01T08:00:00Z",
        },
      ],
    });
    const out = await getGoalEffectiveForDates(stub as any, "user-1", [
      "2026-04-10",
      "2026-04-20",
      "2026-05-05",
    ]);
    expect(out["2026-04-10"]?.target_calories).toBe(2000);
    expect(out["2026-04-10"]?.plan_pace).toBe("steady");
    expect(out["2026-04-20"]?.target_calories).toBe(1800);
    expect(out["2026-04-20"]?.plan_pace).toBe("accelerated");
    expect(out["2026-05-05"]?.target_calories).toBe(2400);
    expect(out["2026-05-05"]?.goal).toBe("maintain");
  });

  it("returns null for dates earlier than the earliest effective_from", async () => {
    const stub = buildSupabaseStub({
      forDatesRows: [
        {
          goal: "cut",
          plan_pace: "steady",
          activity_level: "moderate",
          target_calories: 2000,
          target_protein_g: null,
          target_carbs_g: null,
          target_fat_g: null,
          target_fiber_g: null,
          maintenance_tdee: null,
          effective_from: "2026-04-15",
          recorded_at: "2026-04-15T08:00:00Z",
        },
      ],
    });
    const out = await getGoalEffectiveForDates(stub as any, "user-1", [
      "2026-04-01",
      "2026-04-20",
    ]);
    expect(out["2026-04-01"]).toBeNull();
    expect(out["2026-04-20"]?.target_calories).toBe(2000);
  });

  it("returns all-null map when read fails", async () => {
    const stub = buildSupabaseStub({ forDatesError: { message: "relation does not exist" } });
    const out = await getGoalEffectiveForDates(stub as any, "user-1", ["2026-05-01"]);
    expect(out["2026-05-01"]).toBeNull();
  });

  it("no-ops when userId is empty or no dates supplied", async () => {
    const stub1 = buildSupabaseStub({ forDatesRows: [] });
    expect(await getGoalEffectiveForDates(stub1 as any, "", ["2026-05-01"])).toEqual({
      "2026-05-01": null,
    });
    expect(stub1.ops.length).toBe(0);

    const stub2 = buildSupabaseStub({ forDatesRows: [] });
    expect(await getGoalEffectiveForDates(stub2 as any, "user-1", [])).toEqual({});
    expect(stub2.ops.length).toBe(0);
  });
});
