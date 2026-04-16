import { NextResponse } from "next/server";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";

/**
 * POST /api/household/leave
 *
 * Leave the current household. If the owner leaves, the household is deleted.
 */
export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  // Find membership
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
  }

  return NextResponse.json({ ok: true });
}
