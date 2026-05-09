/**
 * F-138 Phase 3 — "You helped N people" contributor stats.
 *
 * Returns counts of the user's contribution to the verified food
 * database. Powers the soft gamification line on the correction-saved
 * success card per the verification-pipeline decision doc:
 *
 *   "You helped N people": yes — soft, not leaderboard-y. "Your
 *   correction for X is now used by N people" appears (a) as a quiet
 *   line on the Submit-to-database success state, (b) as a contributor
 *   history section in profile.
 *
 * Definitions:
 *   - `submissions`: total user_foods rows submitted by this user
 *     (any verification_status — pending, verified, rejected).
 *   - `verifiedSubmissions`: subset that reached `verified` status.
 *   - `upvotesReceived`: sum of upvotes across the user's verified
 *     submissions. This is the "helped N people" number — it represents
 *     other authed users actively confirming the values are correct.
 *
 * RLS: this query reads only rows where `submitted_by = auth.uid()`,
 * which the existing user_foods SELECT policy permits.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContributorStats {
  /** Total submissions, any status. */
  submissions: number;
  /** Submissions that reached `verified`. */
  verifiedSubmissions: number;
  /** Sum of upvotes on the user's verified submissions. */
  upvotesReceived: number;
}

const EMPTY_STATS: ContributorStats = {
  submissions: 0,
  verifiedSubmissions: 0,
  upvotesReceived: 0,
};

export async function getMyContributorStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<ContributorStats> {
  if (!userId) return EMPTY_STATS;
  const { data, error } = await supabase
    .from("user_foods")
    .select("verification_status, upvotes")
    .eq("submitted_by", userId);
  if (error || !data) return EMPTY_STATS;
  let submissions = 0;
  let verifiedSubmissions = 0;
  let upvotesReceived = 0;
  for (const row of data) {
    submissions++;
    if (row.verification_status === "verified") {
      verifiedSubmissions++;
      upvotesReceived += Math.max(0, Number(row.upvotes) || 0);
    }
  }
  return { submissions, verifiedSubmissions, upvotesReceived };
}

/**
 * Format the success-card "you helped N people" line. Returns null when
 * the stats don't have a story to tell yet (no verified submissions
 * + no upvotes), so the success card can simply omit the line on first
 * submission rather than show "You helped 0 people" (which reads as a
 * failure / negative outcome).
 */
export function formatHelpedLine(stats: ContributorStats): string | null {
  if (stats.upvotesReceived > 0) {
    return stats.upvotesReceived === 1
      ? "Your past corrections have helped 1 other person."
      : `Your past corrections have helped ${stats.upvotesReceived} other people.`;
  }
  if (stats.verifiedSubmissions > 0) {
    return stats.verifiedSubmissions === 1
      ? "You’ve had 1 correction verified — thanks for contributing."
      : `You’ve had ${stats.verifiedSubmissions} corrections verified — thanks for contributing.`;
  }
  return null;
}
