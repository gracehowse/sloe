import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * ENG-1306 — body-metric day maps move from client-side full-map
 * read-modify-write (last writer clobbers a racing writer's days) to
 * server-side per-day jsonb upserts via the `upsert_body_metric_days` RPC.
 *
 * Three layers pinned here:
 *   1. the staged SQL migration's guardrails,
 *   2. the recipes import unique-index migration's conservative dedupe,
 *   3. the web writers actually calling the RPC (behaviour + anti-drift).
 * Mobile writers are pinned in
 * apps/mobile/tests/unit/upsertBodyMetricDaysWiring.test.ts.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("ENG-1306 migration — upsert_body_metric_days RPC", () => {
  const SQL = read("supabase/migrations/20260702125200_eng1306_upsert_body_metric_days_rpc.sql");

  it("is SECURITY INVOKER and only touches auth.uid()'s own row", () => {
    expect(SQL).toMatch(/security invoker/);
    expect(SQL).toMatch(/auth\.uid\(\)/);
    expect(SQL).not.toMatch(/security definer/i);
  });

  it("validates day keys and value types before writing", () => {
    expect(SQL).toContain("^\\d{4}-\\d{2}-\\d{2}$");
    expect(SQL).toMatch(/jsonb_typeof\(v_val\) not in \('number', 'null'\)/);
  });

  it("locks the profile row so concurrent patches serialise (merge, not clobber)", () => {
    expect(SQL).toMatch(/for update/);
  });

  it("prunes both maps to the newest 400 days (app-side MAX_*_JSONB_DAYS parity)", () => {
    expect(SQL.match(/order by key desc limit 400/g)?.length).toBe(2);
  });

  it("is executable by authenticated only", () => {
    expect(SQL).toMatch(/revoke all on function public\.upsert_body_metric_days\(jsonb, jsonb\) from public, anon/);
    expect(SQL).toMatch(/grant execute on function public\.upsert_body_metric_days\(jsonb, jsonb\) to authenticated/);
  });
});

describe("ENG-1306 migration — recipes import unique index", () => {
  const SQL = read("supabase/migrations/20260702125100_eng1306_recipes_import_source_url_unique.sql");

  it("creates the partial unique index scoped to imported stubs only", () => {
    expect(SQL).toMatch(/create unique index if not exists recipes_import_author_source_url_unique/);
    expect(SQL).toMatch(/on public\.recipes \(author_id, source_url\)/);
    expect(SQL).toMatch(/source_url is not null/);
    expect(SQL).toMatch(/content_origin = 'imported_stub'/);
  });

  it("dedupes conservatively — keeps the earliest row, nulls source_url on later dupes, deletes nothing", () => {
    expect(SQL).toMatch(/order by created_at asc, id asc/);
    expect(SQL).toMatch(/set source_url = null/);
    expect(SQL).not.toMatch(/delete\s+from/i);
    expect(SQL).not.toMatch(/drop\s+table/i);
  });
});

describe("web weight writer — persistWeightDayPatch behaviour", () => {
  it("sends a per-day patch to the RPC and returns the server-merged map + scalar", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/nutrition/refreshAdaptiveTdee.ts", () => ({
      refreshAdaptiveTdeeForUser: vi.fn().mockResolvedValue(undefined),
    }));
    const { persistWeightDayPatch } = await import("../../src/lib/progress/weightData.ts");

    const rpc = vi.fn().mockResolvedValue({
      data: {
        weight_kg_by_day: { "2026-07-01": 71.2, "2026-07-02": 70.9 },
        weight_kg: 70.9,
      },
      error: null,
    });
    const result = await persistWeightDayPatch({
      supabase: { rpc },
      userId: "user-1",
      patch: { "2026-07-02": 70.9 },
    });
    expect(rpc).toHaveBeenCalledWith("upsert_body_metric_days", {
      p_weight_patch: { "2026-07-02": 70.9 },
    });
    expect(result).toEqual({
      weightKgByDay: { "2026-07-01": 71.2, "2026-07-02": 70.9 },
      weightKg: 70.9,
    });
    vi.doUnmock("../../src/lib/nutrition/refreshAdaptiveTdee.ts");
  });

  it("throws on RPC failure so callers can roll back optimistic state", async () => {
    vi.resetModules();
    vi.doMock("../../src/lib/nutrition/refreshAdaptiveTdee.ts", () => ({
      refreshAdaptiveTdeeForUser: vi.fn().mockResolvedValue(undefined),
    }));
    const { persistWeightDayPatch } = await import("../../src/lib/progress/weightData.ts");
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(
      persistWeightDayPatch({ supabase: { rpc }, userId: "user-1", patch: { "2026-07-02": 70.9 } }),
    ).rejects.toThrow("boom");
    vi.doUnmock("../../src/lib/nutrition/refreshAdaptiveTdee.ts");
  });
});

describe("web writers — anti-drift pins", () => {
  const WEIGHT_DATA = read("src/lib/progress/weightData.ts");
  const PROGRESS = read("src/app/components/ProgressDashboard.tsx");

  it("weightData.ts no longer full-map-updates profiles", () => {
    expect(WEIGHT_DATA).toContain('rpc("upsert_body_metric_days"');
    expect(WEIGHT_DATA).not.toMatch(/\.update\(\{\s*weight_kg/);
  });

  it("ProgressDashboard routes weight AND body fat through the per-day RPC", () => {
    expect(PROGRESS).toContain("persistWeightDayPatch({ supabase, userId: authedUserId, patch: { [tk]: kg } })");
    expect(PROGRESS).toContain("p_body_fat_patch: { [tk]: rounded }");
    expect(PROGRESS).not.toMatch(/persistProfilePatch\(\{ body_fat_pct/);
  });
});
