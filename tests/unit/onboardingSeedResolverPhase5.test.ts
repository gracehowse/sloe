/**
 * onboardingSeedResolverPhase5 — pins the Phase 5 / B2.3 seed
 * resolution + persistence logic.
 *
 * Authority: D-2026-04-27-14 + the candidate-source decision.
 * Source: src/lib/onboarding/onboardingSeedResolver.ts
 *
 * Coverage:
 *   - resolveSeedsToRecipeIds returns resolved + missing partitions
 *     against a faked Supabase response.
 *   - Title match is case-insensitive + trims whitespace.
 *   - Unpublished recipes are treated as missing (the picker only
 *     surfaces published rows).
 *   - Resolve query failure → all picks fall into missing (caller
 *     surfaces error band per spec Surface F).
 *   - saveResolvedSeeds idempotently writes to `saves` with the
 *     unique-constraint upsert path; reports rows-saved count.
 *   - Empty pick list short-circuits both functions without I/O.
 */

import { describe, it, expect, vi } from "vitest";

import {
  resolveSeedsToRecipeIds,
  saveResolvedSeeds,
} from "../../src/lib/onboarding/onboardingSeedResolver";
import type { OnboardingSeed } from "../../src/lib/onboarding/onboardingSeeds";

function makeSeed(slug: string, matchTitle: string): OnboardingSeed {
  return {
    slug,
    matchTitle,
    title: matchTitle,
    kcal: 500,
    protein_g: 30,
    prepMins: 30,
    dietTags: [],
    cuisine: "test",
    heroEmoji: "🍽️",
  };
}

interface FakeRow {
  id: string;
  title: string;
  published: boolean;
}

function makeFakeSupabase(rows: FakeRow[]) {
  // Chain: from('recipes').select(...).eq('source_name', 'Suppr onboarding').or(...)
  // The .eq() call enforces the provenance gate per the legal-reviewer
  // P0 from docs/decisions/2026-04-27-onboarding-seed-copyright-review.md
  // §Top-issues #3 — never resolve a seed slug to a row with non-Suppr
  // provenance.
  const orMock = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eqMock = vi.fn().mockReturnValue({ or: orMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
  const upsertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue({ data: rows.map((r) => ({ recipe_id: r.id })), error: null }),
  });
  return {
    from: vi.fn().mockReturnValue({
      select: selectMock,
      upsert: upsertMock,
    }),
    _orMock: orMock,
    _eqMock: eqMock,
    _upsertMock: upsertMock,
  };
}

describe("resolveSeedsToRecipeIds — happy path", () => {
  it("resolves picks against case-insensitive title match", async () => {
    const supabase = makeFakeSupabase([
      { id: "r-1", title: "Sheet-pan harissa chicken with chickpeas", published: true },
      { id: "r-2", title: "Miso salmon with greens", published: true },
    ]);
    const picks = [
      makeSeed("a", "Sheet-pan harissa chicken with chickpeas"),
      makeSeed("b", "Miso salmon with greens"),
    ];
    const r = await resolveSeedsToRecipeIds(supabase as never, picks);
    expect(r.resolved).toHaveLength(2);
    expect(r.missing).toHaveLength(0);
    expect(r.resolved[0].recipeId).toBe("r-1");
    expect(r.resolved[1].recipeId).toBe("r-2");
  });

  it("normalises whitespace + case on the title key", async () => {
    const supabase = makeFakeSupabase([
      { id: "r-1", title: "  Miso Salmon WITH Greens  ", published: true },
    ]);
    const picks = [makeSeed("a", "miso salmon with greens")];
    const r = await resolveSeedsToRecipeIds(supabase as never, picks);
    expect(r.resolved).toHaveLength(1);
    expect(r.resolved[0].recipeId).toBe("r-1");
  });

  it("treats unpublished recipes as missing", async () => {
    const supabase = makeFakeSupabase([
      { id: "r-1", title: "Beef ragu with pappardelle", published: false },
    ]);
    const picks = [makeSeed("a", "Beef ragu with pappardelle")];
    const r = await resolveSeedsToRecipeIds(supabase as never, picks);
    expect(r.resolved).toHaveLength(0);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0].slug).toBe("a");
  });

  it("partitions resolved + missing on partial hit", async () => {
    const supabase = makeFakeSupabase([
      { id: "r-1", title: "Sheet-pan harissa chicken with chickpeas", published: true },
    ]);
    const picks = [
      makeSeed("a", "Sheet-pan harissa chicken with chickpeas"),
      makeSeed("b", "Lentil bolognese"), // not in fake DB
    ];
    const r = await resolveSeedsToRecipeIds(supabase as never, picks);
    expect(r.resolved).toHaveLength(1);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0].slug).toBe("b");
  });
});

describe("resolveSeedsToRecipeIds — error + empty", () => {
  it("returns empty on empty picks (no I/O)", async () => {
    const supabase = makeFakeSupabase([]);
    const r = await resolveSeedsToRecipeIds(supabase as never, []);
    expect(r.resolved).toHaveLength(0);
    expect(r.missing).toHaveLength(0);
    expect((supabase as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it("falls all picks into missing on query error", async () => {
    const errorOr = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "network down" },
    });
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({ or: errorOr }),
        }),
      }),
    };
    const picks = [
      makeSeed("a", "Lentil bolognese"),
      makeSeed("b", "Cottage cheese and tomato pasta"),
    ];
    const r = await resolveSeedsToRecipeIds(supabase as never, picks);
    expect(r.resolved).toHaveLength(0);
    expect(r.missing).toHaveLength(2);
  });
});

describe("saveResolvedSeeds — idempotent write", () => {
  it("upserts one row per resolved seed", async () => {
    const supabase = makeFakeSupabase([
      { id: "r-1", title: "X", published: true },
      { id: "r-2", title: "Y", published: true },
    ]);
    const result = await saveResolvedSeeds(supabase as never, {
      userId: "u-1",
      resolved: [
        { seed: makeSeed("a", "X"), recipeId: "r-1" },
        { seed: makeSeed("b", "Y"), recipeId: "r-2" },
      ],
    });
    expect(result.savedCount).toBeGreaterThanOrEqual(2);
    expect(supabase._upsertMock).toHaveBeenCalledTimes(1);
    const [rowsArg, optsArg] = supabase._upsertMock.mock.calls[0];
    expect(rowsArg).toEqual([
      { user_id: "u-1", recipe_id: "r-1" },
      { user_id: "u-1", recipe_id: "r-2" },
    ]);
    expect(optsArg.onConflict).toBe("user_id,recipe_id");
    expect(optsArg.ignoreDuplicates).toBe(true);
  });

  it("returns 0 on empty resolved list (no I/O)", async () => {
    const supabase = makeFakeSupabase([]);
    const result = await saveResolvedSeeds(supabase as never, {
      userId: "u-1",
      resolved: [],
    });
    expect(result.savedCount).toBe(0);
    expect(supabase._upsertMock).not.toHaveBeenCalled();
  });

  it("surfaces the error message on upsert failure", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "RLS rejected" } }),
    });
    const supabase = {
      from: () => ({
        upsert: upsertMock,
      }),
    };
    const result = await saveResolvedSeeds(supabase as never, {
      userId: "u-1",
      resolved: [{ seed: makeSeed("a", "X"), recipeId: "r-1" }],
    });
    expect(result.savedCount).toBe(0);
    expect(result.error).toBe("RLS rejected");
  });
});
