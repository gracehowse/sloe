import { NextResponse } from "next/server";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { rateLimit } from "@/lib/server/rateLimit";
import { assertOrigin } from "@/lib/api/assertOrigin";

/**
 * POST /api/household/join
 *
 * Join a household using an invite code.
 * Body: { inviteCode: string, displayName?: string }
 */
export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  // Privacy audit M1 (2026-04-18): invite codes are 12-hex (~48 bits), so
  // brute-force is impractical, but stuffing wasn't blocked. Cap to 5
  // attempts per minute per IP to make automated guessing pointless and
  // keep the failure surface small for honest users who mistype once.
  const limited = await rateLimit({ keyPrefix: "household_join", limit: 5, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many attempts. Try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  let body: { inviteCode?: string; displayName?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const inviteCode = body.inviteCode?.trim();
  if (!inviteCode) {
    return NextResponse.json({ ok: false, error: "missing_code", message: "Invite code is required." }, { status: 400 });
  }

  // Check user isn't already in a household
  const { data: existing } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "already_in_household", message: "Leave your current household first." },
      { status: 409 },
    );
  }

  // Service-role: intentionally cross-tenant — invite codes are the access
  // token; looking up a household by its code is the whole point of joining.
  // Rate-limited above (5/min/IP) to blunt code-stuffing attacks.
  const { data: household } = await supabase
    .from("households")
    .select("id, name, invite_code_expires_at")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!household) {
    return NextResponse.json(
      { ok: false, error: "invalid_code", message: "No household found with that invite code." },
      { status: 404 },
    );
  }

  // M1 fix (2026-04-21): reject expired invite codes. NULL = no expiry
  // (legacy rows from before the invite-expiry migration) — the owner
  // can rotate via POST /api/household with { rotateInvite: true } to
  // stamp a fresh 7-day expiry.
  const expiresAt = (household as { invite_code_expires_at?: string | null })
    .invite_code_expires_at;
  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt);
    if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          error: "invite_expired",
          message: "This invite code has expired. Ask the household owner for a new one.",
        },
        { status: 410 },
      );
    }
  }

  // Check household size (max 8 members)
  const { count } = await supabase
    .from("household_members")
    .select("id", { count: "exact", head: true })
    .eq("household_id", household.id);

  if ((count ?? 0) >= 8) {
    return NextResponse.json(
      { ok: false, error: "household_full", message: "This household has reached the maximum of 8 members." },
      { status: 422 },
    );
  }

  // Join
  const { error: joinError } = await supabase
    .from("household_members")
    .insert({
      household_id: household.id,
      user_id: userId,
      role: "member",
      display_name: body.displayName?.trim().slice(0, 30) || null,
    });

  if (joinError) {
    return NextResponse.json({ ok: false, error: "join_failed", message: joinError.message }, { status: 500 });
  }

  // Link profile
  await supabase
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", userId);

  return NextResponse.json({ ok: true, household });
}
