import { NextResponse } from "next/server";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { assertOrigin } from "@/lib/api/assertOrigin";
import { randomBytes } from "node:crypto";

/** Invite-code lifespan (M1). Rotated + re-stamped every time membership
 *  churns (owner reset, member leave, owner leave-delete). */
export const INVITE_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteCode(): string {
  // 6 bytes → 12 hex chars, matches the DB default (gen_random_bytes(6)).
  return randomBytes(6).toString("hex");
}

export function inviteExpiryIso(now: number = Date.now()): string {
  return new Date(now + INVITE_CODE_TTL_MS).toISOString();
}

/**
 * GET /api/household
 *
 * Returns the user's household (if any), including members and today's meals.
 *
 * H4 fix (2026-04-21): each member's `target_calories/protein/carbs/fat`
 * is gated on that member's `share_targets` flag. When `share_targets`
 * is false/null, the response returns `targets: null` and `remaining:
 * null` for that member instead of leaking their private diet goals.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  // Service-role: user-scoped by userId to prevent cross-tenant access.
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ ok: true, household: null });
  }

  const householdId = membership.household_id as string;

  // Fetch household details, members, and upcoming meals in parallel
  const [{ data: household }, { data: members }, { data: meals }] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, owner_id, invite_code, invite_code_expires_at, created_at")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select("id, user_id, role, display_name, joined_at, share_targets")
      .eq("household_id", householdId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("household_meals")
      .select("id, date_key, meal_label, recipe_title, recipe_id, servings, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving, notes, added_by, created_at")
      .eq("household_id", householdId)
      .gte("date_key", new Date().toISOString().slice(0, 10))
      .order("date_key", { ascending: true })
      .order("meal_label", { ascending: true })
      .limit(28), // 7 days × 4 meals
  ]);

  // Fetch each member's target macros for remaining calculation
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const { data: memberProfiles } = await supabase
    .from("profiles")
    .select("id, target_calories, target_protein, target_carbs, target_fat, display_name")
    .in("id", memberIds);

  // Fetch each member's today's logged nutrition
  const todayKey = new Date().toISOString().slice(0, 10);
  const { data: todayEntries } = await supabase
    .from("nutrition_entries")
    .select("user_id, calories, protein, carbs, fat")
    .in("user_id", memberIds)
    .eq("date_key", todayKey);

  // Compute per-member consumed and remaining
  const memberSummaries = (members ?? []).map((m) => {
    const uid = m.user_id as string;
    const profile = (memberProfiles ?? []).find((p) => p.id === uid);
    const entries = (todayEntries ?? []).filter((e) => e.user_id === uid);

    // H4: consent gate. A member's own row is always shown with targets
    // so the caller can see their own numbers; everyone else must have
    // opted in via share_targets = true.
    const isSelf = uid === userId;
    const sharesTargets = Boolean((m as { share_targets?: boolean | null }).share_targets);
    const revealTargets = isSelf || sharesTargets;

    const consumed = {
      calories: entries.reduce((s, e) => s + (Number(e.calories) || 0), 0),
      protein: entries.reduce((s, e) => s + (Number(e.protein) || 0), 0),
      carbs: entries.reduce((s, e) => s + (Number(e.carbs) || 0), 0),
      fat: entries.reduce((s, e) => s + (Number(e.fat) || 0), 0),
    };

    const base = {
      userId: uid,
      role: m.role,
      displayName:
        (m.display_name as string) || (profile?.display_name as string) || "Member",
      shareTargets: sharesTargets,
      consumed: {
        calories: Math.round(consumed.calories),
        protein: Math.round(consumed.protein * 10) / 10,
        carbs: Math.round(consumed.carbs * 10) / 10,
        fat: Math.round(consumed.fat * 10) / 10,
      },
    };

    if (!revealTargets) {
      return {
        ...base,
        targets: null,
        remaining: null,
      };
    }

    const targets = {
      calories: Number(profile?.target_calories) || 2000,
      protein: Number(profile?.target_protein) || 130,
      carbs: Number(profile?.target_carbs) || 250,
      fat: Number(profile?.target_fat) || 65,
    };
    return {
      ...base,
      targets,
      remaining: {
        calories: Math.max(0, Math.round(targets.calories - consumed.calories)),
        protein: Math.max(0, Math.round((targets.protein - consumed.protein) * 10) / 10),
        carbs: Math.max(0, Math.round((targets.carbs - consumed.carbs) * 10) / 10),
        fat: Math.max(0, Math.round((targets.fat - consumed.fat) * 10) / 10),
      },
    };
  });

  return NextResponse.json({
    ok: true,
    household: {
      ...household,
      isOwner: (household as any)?.owner_id === userId,
      myRole: membership.role,
    },
    members: memberSummaries,
    meals: meals ?? [],
  });
}

/**
 * POST /api/household
 *
 * Create a new household. The creator becomes the owner.
 *
 * Also used by the owner to rotate the invite code — if the caller is
 * already the owner of a household, POST rotates `invite_code` and
 * stamps `invite_code_expires_at = now() + 7d` (M1 fix, 2026-04-21).
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

  let body: { name?: string; rotateInvite?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  // Check if user already belongs to a household
  const { data: existing } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Owner rotating the invite — the expected path when an invite
    // has expired or when a member has been removed.
    if (body.rotateInvite && existing.role === "owner") {
      const newCode = generateInviteCode();
      const newExpiry = inviteExpiryIso();
      const { data: updated, error: rotErr } = await supabase
        .from("households")
        .update({ invite_code: newCode, invite_code_expires_at: newExpiry })
        .eq("id", existing.household_id)
        .eq("owner_id", userId)
        .select("id, name, invite_code, invite_code_expires_at")
        .single();
      if (rotErr || !updated) {
        return NextResponse.json(
          { ok: false, error: "rotate_failed", message: rotErr?.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, household: updated });
    }
    return NextResponse.json(
      { ok: false, error: "already_in_household", message: "You already belong to a household. Leave it first to create a new one." },
      { status: 409 },
    );
  }

  const name = (body.name ?? "My Household").trim().slice(0, 50);

  // Create household with a fresh invite + expiry (M1).
  const { data: household, error: hError } = await supabase
    .from("households")
    .insert({
      name,
      owner_id: userId,
      invite_code: generateInviteCode(),
      invite_code_expires_at: inviteExpiryIso(),
    })
    .select("id, name, invite_code, invite_code_expires_at")
    .single();

  if (hError || !household) {
    return NextResponse.json({ ok: false, error: "create_failed", message: hError?.message }, { status: 500 });
  }

  // Add owner as a member
  await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: userId, role: "owner" });

  // Link profile
  await supabase
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", userId);

  return NextResponse.json({ ok: true, household });
}
