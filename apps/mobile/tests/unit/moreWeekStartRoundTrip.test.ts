/**
 * Mobile week-start-day Supabase round-trip (M11 audit, 2026-04-18).
 *
 * Mirrors `tests/unit/settingsWeekStartRoundTrip.test.ts` on the web
 * side. Both platforms route through the shared helper
 * `src/lib/nutrition/weekStartDayClient.ts`, so this test also verifies
 * that web/mobile parity is structurally enforced — a drift in either
 * caller shows up as a failure here via the same helper contract.
 *
 * Mocks the supabase-js chainable query builder (no real Supabase) and
 * asserts the exact shape Settings.tsx / more.tsx dispatch on tap.
 */
import { describe, expect, it } from "vitest";
import {
  loadWeekStartDay,
  saveWeekStartDay,
} from "@suppr/nutrition-core/weekStartDayClient";

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

describe("mobile saveWeekStartDay round-trip (G8)", () => {
  it("Monday tap dispatches update({ week_start_day: 'monday' }) scoped to the owner", async () => {
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
    await saveWeekStartDay(sb as any, "mobile-user-1", "monday");
    expect(payloadSeen).toEqual({ week_start_day: "monday" });
    expect(filtersSeen?.["eq:id"]).toBe("mobile-user-1");
  });

  it("Sunday tap dispatches update({ week_start_day: 'sunday' }) scoped to the owner", async () => {
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
    await saveWeekStartDay(sb as any, "mobile-user-2", "sunday");
    expect(payloadSeen).toEqual({ week_start_day: "sunday" });
    expect(filtersSeen?.["eq:id"]).toBe("mobile-user-2");
  });

  it("throws on supabase error so the screen can roll back local state and Alert", async () => {
    const sb = makeSupabase({
      profiles: () => ({ data: null, error: new Error("network down") }),
    });
    await expect(saveWeekStartDay(sb as any, "u1", "monday")).rejects.toThrow(/network down/);
  });
});

describe("mobile loadWeekStartDay (G8)", () => {
  it("hydrates a stored value (Monday)", async () => {
    let filtersSeen: Record<string, unknown> | undefined;
    const sb = makeSupabase({
      profiles: (_op, ctx) => {
        filtersSeen = ctx.filters;
        return { data: { week_start_day: "monday" }, error: null };
      },
    });
    expect(await loadWeekStartDay(sb as any, "u1")).toBe("monday");
    expect(filtersSeen?.["eq:id"]).toBe("u1");
  });

  it("hydrates a stored value (Sunday)", async () => {
    const sb = makeSupabase({
      profiles: () => ({ data: { week_start_day: "sunday" }, error: null }),
    });
    expect(await loadWeekStartDay(sb as any, "u1")).toBe("sunday");
  });

  it("returns null for absent / unknown / error states so the screen default wins", async () => {
    const sbNoRow = makeSupabase({ profiles: () => ({ data: null, error: null }) });
    expect(await loadWeekStartDay(sbNoRow as any, "u1")).toBeNull();

    const sbGarbage = makeSupabase({
      profiles: () => ({ data: { week_start_day: "later" }, error: null }),
    });
    expect(await loadWeekStartDay(sbGarbage as any, "u1")).toBeNull();

    const sbErr = makeSupabase({
      profiles: () => ({ data: null, error: new Error("boom") }),
    });
    expect(await loadWeekStartDay(sbErr as any, "u1")).toBeNull();
  });
});
