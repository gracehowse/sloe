/**
 * F-138 Phase 3 — `getMyContributorStats` + `formatHelpedLine`.
 *
 * Pure-function tests for the soft "you helped N people" line on the
 * correction-saved success card. The DB-side query is a single
 * RLS-scoped SELECT against user_foods (submitted_by = auth.uid());
 * tests here pin the formatter + the count rollup.
 */
import { describe, it, expect } from "vitest";
import {
  formatHelpedLine,
  getMyContributorStats,
  type ContributorStats,
} from "../../lib/contributorStats";

const empty: ContributorStats = {
  submissions: 0,
  verifiedSubmissions: 0,
  upvotesReceived: 0,
};

describe("formatHelpedLine", () => {
  it("returns null when there's nothing to say (first submission)", () => {
    expect(formatHelpedLine(empty)).toBeNull();
  });

  it("returns null when only pending submissions exist", () => {
    expect(
      formatHelpedLine({
        submissions: 3,
        verifiedSubmissions: 0,
        upvotesReceived: 0,
      }),
    ).toBeNull();
  });

  it("upvote line uses singular when 1 person helped", () => {
    expect(
      formatHelpedLine({
        submissions: 2,
        verifiedSubmissions: 1,
        upvotesReceived: 1,
      }),
    ).toBe("Your past corrections have helped 1 other person.");
  });

  it("upvote line uses plural with count when >1 helped", () => {
    expect(
      formatHelpedLine({
        submissions: 5,
        verifiedSubmissions: 2,
        upvotesReceived: 12,
      }),
    ).toBe("Your past corrections have helped 12 other people.");
  });

  it("falls back to verified-count line when no upvotes yet", () => {
    expect(
      formatHelpedLine({
        submissions: 4,
        verifiedSubmissions: 1,
        upvotesReceived: 0,
      }),
    ).toBe(
      "You’ve had 1 correction verified — thanks for contributing.",
    );
    expect(
      formatHelpedLine({
        submissions: 4,
        verifiedSubmissions: 3,
        upvotesReceived: 0,
      }),
    ).toBe(
      "You’ve had 3 corrections verified — thanks for contributing.",
    );
  });

  it("uses upvote line whenever upvotes > 0, regardless of verified count", () => {
    // The upvote count is the "helped N people" headline number — even
    // if verified count is higher, upvotes are the active signal of
    // other users confirming, so the upvote line wins.
    expect(
      formatHelpedLine({
        submissions: 10,
        verifiedSubmissions: 8,
        upvotesReceived: 3,
      }),
    ).toBe("Your past corrections have helped 3 other people.");
  });
});

// Build a minimal supabase-shaped mock: returns the rows configured by
// the test, no real network. Mirrors the SupabaseClient shape just
// enough for `getMyContributorStats` to type-check.
type MockRow = { verification_status: string; upvotes: number | null };
function mockSupabase(rows: MockRow[] | null, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: rows, error }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("getMyContributorStats", () => {
  it("returns the empty stats when userId is empty", async () => {
    const r = await getMyContributorStats(mockSupabase([]), "");
    expect(r).toEqual(empty);
  });

  it("returns empty stats when the query errors", async () => {
    const r = await getMyContributorStats(
      mockSupabase(null, new Error("boom")),
      "u-1",
    );
    expect(r).toEqual(empty);
  });

  it("counts submissions across all statuses", async () => {
    const r = await getMyContributorStats(
      mockSupabase([
        { verification_status: "pending", upvotes: 0 },
        { verification_status: "verified", upvotes: 4 },
        { verification_status: "rejected", upvotes: 0 },
      ]),
      "u-1",
    );
    expect(r.submissions).toBe(3);
    expect(r.verifiedSubmissions).toBe(1);
    expect(r.upvotesReceived).toBe(4);
  });

  it("only counts upvotes from verified rows (rejected/pending are excluded)", async () => {
    const r = await getMyContributorStats(
      mockSupabase([
        // Pending row with stale upvotes — must NOT count.
        { verification_status: "pending", upvotes: 99 },
        { verification_status: "verified", upvotes: 5 },
        { verification_status: "verified", upvotes: 7 },
        // Rejected row with stale upvotes — must NOT count.
        { verification_status: "rejected", upvotes: 50 },
      ]),
      "u-1",
    );
    expect(r.verifiedSubmissions).toBe(2);
    expect(r.upvotesReceived).toBe(12);
  });

  it("clamps negative upvotes to 0 (defence-in-depth)", async () => {
    // upvotes can never be negative under the trigger, but the
    // formatter shouldn't propagate junk if the column drifts.
    const r = await getMyContributorStats(
      mockSupabase([
        { verification_status: "verified", upvotes: -3 },
        { verification_status: "verified", upvotes: 6 },
      ]),
      "u-1",
    );
    expect(r.upvotesReceived).toBe(6);
  });

  it("treats null upvotes as 0 (legacy rows)", async () => {
    const r = await getMyContributorStats(
      mockSupabase([
        { verification_status: "verified", upvotes: null },
        { verification_status: "verified", upvotes: 2 },
      ]),
      "u-1",
    );
    expect(r.upvotesReceived).toBe(2);
  });
});
