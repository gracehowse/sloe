import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";

/**
 * POST /api/user-foods/vote
 *
 * Upvote or downvote a user-submitted food.
 * Body: { userFoodId: string, vote: 1 | -1 }
 */
export async function POST(req: Request) {
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

  // Recount votes and update the user_foods aggregate columns
  const { data: voteCounts } = await supabase
    .from("user_food_votes")
    .select("vote")
    .eq("user_food_id", userFoodId);

  const upvotes = (voteCounts ?? []).filter((v) => v.vote === 1).length;
  const downvotes = (voteCounts ?? []).filter((v) => v.vote === -1).length;

  await supabase
    .from("user_foods")
    .update({ upvotes, downvotes })
    .eq("id", userFoodId);

  return NextResponse.json({ ok: true, upvotes, downvotes });
}
