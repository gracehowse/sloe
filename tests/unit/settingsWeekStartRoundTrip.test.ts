/**
 * Week-start-day Supabase round-trip (M11 audit, 2026-04-18).
 *
 * Covers the G8 backlog row. Exercises the `loadWeekStartDay` /
 * `saveWeekStartDay` helpers that Settings.tsx (web) and more.tsx
 * (mobile) both call. Mocks a chainable supabase-js client — same
 * pattern as `savedMealsClient.test.ts` — and locks in:
 *   - Monday tap → `update({ week_start_day: "monday" }).eq("id", uid)`
 *   - Sunday tap → same payload with "sunday"
 *   - `select("week_start_day").eq("id", uid).maybeSingle()` hydrates
 *     the UI from a stored value
 *   - unknown values resolve to null (UI falls back to its default)
 *   - failures throw (so the UI can roll back + toast)
 */
import { describe, expect, it } from "vitest";
import {
  loadWeekStartDay,
  saveWeekStartDay,
} from "@/lib/nutrition/weekStartDayClient";

type Call = {
  op: string;
  table: string;
  payload?: unknown;
  filters: Record<string, unknown>;
};

function makeSupabase(
  handlers: Partial<
    Record<
      string,
      (
        op: string,
        ctx: { payload?: unknown; filters: Record<string, unknown>; table: string },
      ) => { data: unknown; error: unknown }
    >
  >,
) {
  const calls: Call[] = [];
  function builder(table: string, op: string, payload?: unknown) {
    const filters: Record<string, unknown> = {};
    const self: any = {
      select() {
        return self;
      },
      update(p: unknown) {
        return builder(table, "update", p);
      },
      eq(col: string, val: unknown) {
        filters[`eq:${col}`] = val;
        return self;
      },
      maybeSingle: async () => {
        const k = `${op}:maybeSingle`;
        calls.push({ op: k, table, payload, filters });
        const h = handlers[table];
        return h?.(k, { payload, filters, table }) ?? { data: null, error: null };
      },
      then(resolve: any) {
        calls.push({ op, table, payload, filters });
        const h = handlers[table];
        const res = h?.(op, { payload, filters, table }) ?? { data: null, error: null };
        resolve(res);
      },
    };
    return self;
  }
  return { from: (table: string) => builder(table, "select"), calls };
}

describe("saveWeekStartDay (G8)", () => {
  it("rejects missing userId / invalid day", async () => {
    const sb = makeSupabase({});
    await expect(saveWeekStartDay(sb as any, "", "monday")).rejects.toThrow(/userId is required/);
    // @ts-expect-error — runtime guard
    await expect(saveWeekStartDay(sb as any, "u1", "tuesday")).rejects.toThrow(/monday/);
  });

  it("Monday tap issues update({ week_start_day: 'monday' }) scoped to the owner", async () => {
    let payloadSeen: unknown;
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      profiles: (op, ctx) => {
        if (op === "update") {
          payloadSeen = ctx.payload;
          filtersSeen = ctx.filters;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await saveWeekStartDay(sb as any, "user-1", "monday");
    expect(payloadSeen).toEqual({ week_start_day: "monday" });
    expect(filtersSeen?.["eq:id"]).toBe("user-1");
  });

  it("Sunday tap issues update({ week_start_day: 'sunday' }) scoped to the owner", async () => {
    let payloadSeen: unknown;
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      profiles: (op, ctx) => {
        if (op === "update") {
          payloadSeen = ctx.payload;
          filtersSeen = ctx.filters;
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    await saveWeekStartDay(sb as any, "user-2", "sunday");
    expect(payloadSeen).toEqual({ week_start_day: "sunday" });
    expect(filtersSeen?.["eq:id"]).toBe("user-2");
  });

  it("propagates the Supabase error so the UI can roll back local state", async () => {
    const sb = makeSupabase({
      profiles: () => ({ data: null, error: new Error("rls denied") }),
    });
    await expect(saveWeekStartDay(sb as any, "u1", "monday")).rejects.toThrow(/rls denied/);
  });
});

describe("loadWeekStartDay (G8)", () => {
  it("returns null (not thrown) when userId is empty and does not touch supabase", async () => {
    const sb = makeSupabase({});
    const out = await loadWeekStartDay(sb as any, "");
    expect(out).toBeNull();
    expect(sb.calls).toHaveLength(0);
  });

  it("hydrates the stored value — Monday case", async () => {
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      profiles: (_op, ctx) => {
        filtersSeen = ctx.filters;
        return { data: { week_start_day: "monday" }, error: null };
      },
    });
    const out = await loadWeekStartDay(sb as any, "user-3");
    expect(out).toBe("monday");
    expect(filtersSeen?.["eq:id"]).toBe("user-3");
  });

  it("hydrates the stored value — Sunday case", async () => {
    const sb = makeSupabase({
      profiles: () => ({ data: { week_start_day: "sunday" }, error: null }),
    });
    const out = await loadWeekStartDay(sb as any, "u1");
    expect(out).toBe("sunday");
  });

  it("returns null for unknown / absent values so the UI falls back to its default", async () => {
    const sbMissing = makeSupabase({
      profiles: () => ({ data: { week_start_day: null }, error: null }),
    });
    expect(await loadWeekStartDay(sbMissing as any, "u1")).toBeNull();

    const sbGarbage = makeSupabase({
      profiles: () => ({ data: { week_start_day: "tuesday" }, error: null }),
    });
    expect(await loadWeekStartDay(sbGarbage as any, "u1")).toBeNull();

    const sbNoRow = makeSupabase({
      profiles: () => ({ data: null, error: null }),
    });
    expect(await loadWeekStartDay(sbNoRow as any, "u1")).toBeNull();
  });

  it("returns null on error (never throws — hydration must not crash the screen)", async () => {
    const sb = makeSupabase({
      profiles: () => ({ data: null, error: new Error("network down") }),
    });
    expect(await loadWeekStartDay(sb as any, "u1")).toBeNull();
  });
});
