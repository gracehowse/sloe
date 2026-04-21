import { NextResponse } from "next/server";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { assertOrigin } from "@/lib/api/assertOrigin";
import { generateInviteCode, inviteExpiryIso } from "../route";

/**
 * POST /api/household/leave
 *
 * Leave the current household. If the owner leaves, the household is deleted.
 *
 * M1 fix (2026-04-21): when a non-owner member leaves, rotate the
 * invite code and re-stamp its 7-day expiry. This ensures an
 * ex-member cannot silently re-join with a code they still have.
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

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  // Service-role: user-scoped by userId to prevent cross-tenant access.
  // householdId is derived from the caller's own membership row, so subsequent
  // deletes/updates can only affect a household the caller actually belongs to.
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ ok: false, error: "not_in_household" }, { status: 404 });
  }

  const householdId = membership.household_id as string;

  if (membership.role === "owner") {
    // Owner leaving → delete the entire household (cascades to members + meals)
    await supabase.from("households").delete().eq("id", householdId);
    // Clear household_id from all member profiles
    await supabase
      .from("profiles")
      .update({ household_id: null })
      .eq("household_id", householdId);
  } else {
    // Member leaving → just remove membership
    await supabase
      .from("household_members")
      .delete()
      .eq("household_id", householdId)
      .eq("user_id", userId);
    // Clear household_id from profile
    await supabase
      .from("profiles")
      .update({ household_id: null })
      .eq("id", userId);
    // M1: rotate the invite so the departing member's copy is dead on arrival.
    await supabase
      .from("households")
      .update({
        invite_code: generateInviteCode(),
        invite_code_expires_at: inviteExpiryIso(),
      })
      .eq("id", householdId);
  }

  return NextResponse.json({ ok: true });
}
