import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { assertOrigin } from "@/lib/api/assertOrigin";

/** Distinct upvoters required to auto-promote a user-submitted food
 *  from `pending` to `verified`. Higher is harder to Sybil-attack; 3
 *  is the floor where a single bad actor cannot self-verify. See
 *  security audit H2 (2026-04-21). */
const PROMOTE_DISTINCT_UPVOTES = 3;

/**
 * POST /api/user-foods/vote
 *
 * Upvote or downvote a user-submitted food.
 * Body: { userFoodId: string, vote: 1 | -1 }
 */
export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const rl = await rateLimit({ keyPrefix: "api:user-foods-vote", limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { userFoodId, vote } = body as { userFoodId?: string; vote?: number };

  if (!userFoodId || (vote !== 1 && vote !== -1)) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", message: "userFoodId (string) and vote (1 or -1) are required." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  // Service-role: user-scoped by voter_id (userId) to prevent cross-tenant
  // ballot-stuffing. onConflict is (user_food_id, voter_id) so a given user
  // can only hold one vote per food; a forged body can only overwrite the
  // caller's own prior vote, never another user's.
  //
  // Upsert vote (idempotent — updates if already voted)
  const { error: voteError } = await supabase
    .from("user_food_votes")
    .upsert(
      { user_food_id: userFoodId, voter_id: userId, vote },
      { onConflict: "user_food_id,voter_id" },
    );

  if (voteError) {
    return NextResponse.json({ ok: false, error: "vote_failed", message: voteError.message }, { status: 500 });
  }

  // Recount votes and update the user_foods aggregate columns.
  //
  // H2 fix (2026-04-21): promotion from `pending` to `verified` must be
  // based on COUNT(DISTINCT voter_id), not raw upvote row count. The
  // `(user_food_id, voter_id)` unique constraint already prevents one
  // voter from inserting multiple +1 rows, but we dedupe defensively so
  // any future schema change that loosens the constraint still can't be
  // used to Sybil-promote. Downvote rows are excluded from the distinct
  // count (a voter who switched from +1 to -1 should not count toward
  // promotion).
  const { data: voteRows } = await supabase
    .from("user_food_votes")
    .select("voter_id, vote")
    .eq("user_food_id", userFoodId);

  const rows = voteRows ?? [];
  const distinctUpvoters = new Set<string>();
  let upvotes = 0;
  let downvotes = 0;
  for (const r of rows as Array<{ voter_id: string; vote: number }>) {
    if (r.vote === 1) {
      upvotes += 1;
      if (r.voter_id) distinctUpvoters.add(r.voter_id);
    } else if (r.vote === -1) {
      downvotes += 1;
    }
  }
  const distinctUpvoteCount = distinctUpvoters.size;

  // Load the current verification status so we only promote `pending`
  // rows. Already-verified or explicitly-rejected rows must not be
  // flipped back by vote drift.
  const { data: current } = await supabase
    .from("user_foods")
    .select("verification_status")
    .eq("id", userFoodId)
    .maybeSingle();

  const shouldPromote =
    current?.verification_status === "pending" &&
    distinctUpvoteCount >= PROMOTE_DISTINCT_UPVOTES;

  const update: Record<string, unknown> = { upvotes, downvotes };
  if (shouldPromote) {
    update.verification_status = "verified";
    update.verified_at = new Date().toISOString();
  }

  // Service-role: intentionally cross-tenant — user_foods aggregate counters
  // (upvotes/downvotes/verification_status) are community-owned metadata, not
  // tenant-owned. Scoped by the row id that the caller voted on.
  await supabase.from("user_foods").update(update).eq("id", userFoodId);

  return NextResponse.json({
    ok: true,
    upvotes,
    downvotes,
    distinctUpvoters: distinctUpvoteCount,
    promoted: shouldPromote,
  });
}
