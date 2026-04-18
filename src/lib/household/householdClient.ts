/**
 * Household — direct Supabase client (2026-04-18 mobile port).
 *
 * The web app originally shipped household CRUD via Next.js API routes
 * at `/app/api/household/{route,join,leave,meals}.ts`. The mobile app
 * tried to reuse those routes by calling relative URLs from React
 * Native (`fetch("/api/household")`) — which never works because there
 * is no origin and the fetch either throws or resolves to nothing, so
 * the user saw "Create Household" do nothing at all
 * (TestFlight feedback id `AAegi1DJEiscjIFi_pYaep4`).
 *
 * This file is the shared runtime path for both platforms. It talks
 * directly to Supabase using whatever client the caller passes in
 * (mobile passes `apps/mobile/lib/supabase`; web passes the browser
 * client). The output shapes mirror `GET /api/household` exactly so
 * the UI on both platforms can stay unchanged.
 *
 * Security model:
 *   - `create`, `get`, `leave`, and meal CRUD rely on the RLS policies
 *     from `supabase/migrations/20260420100000_household_planning.sql`
 *     — self-scoped reads, member-scoped writes.
 *   - `joinByInviteCode` goes through a `security definer` RPC because
 *     an auth'd non-member cannot `select` the target household via
 *     RLS (so cannot validate the invite code client-side). See
 *     `supabase/migrations/20260422100000_household_join_rpc.sql`.
 *
 * The Next.js REST routes are NOT removed — they still work for any
 * server-rendered caller (none today, but planner-grade safety). The
 * mobile + web UIs are migrated off them.
 *
 * Convention: this file follows `recipeNotesClient.ts` / `planTemplatesClient.ts`
 * — pure functions, loosely typed `SupabaseLike`, no React, no JSX.
 * Return a `{ data, error }` shape where an expected domain error
 * (already-in-household, invalid-code, cap-hit) is an `error` string;
 * unexpected infrastructure errors (network, permission denied by RLS)
 * throw so callers can surface a toast / Alert.
 */

type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

// Domain shapes — match `GET /api/household` response exactly so UIs
// don't need to change when swapping transport.

export type HouseholdSummary = {
  id: string;
  name: string;
  invite_code: string;
  isOwner: boolean;
  myRole: string;
};

export type MemberSummary = {
  userId: string;
  role: string;
  displayName: string;
  targets: { calories: number; protein: number; carbs: number; fat: number };
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  remaining: { calories: number; protein: number; carbs: number; fat: number };
};

export type HouseholdMeal = {
  id: string;
  date_key: string;
  meal_label: string;
  recipe_title: string;
  recipe_id: string | null;
  servings: number;
  calories_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  fiber_per_serving: number | null;
  notes: string | null;
  added_by: string | null;
  created_at: string;
};

export type HouseholdData = {
  household: HouseholdSummary | null;
  members: MemberSummary[];
  meals: HouseholdMeal[];
};

export type ClientResult<T> = { data: T | null; error: string | null };

const MAX_MEMBERS = 8;
const MAX_NAME_LEN = 50;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Create a household with the caller as owner. Also adds the owner
 * `household_members` row and updates `profiles.household_id`.
 *
 * Three writes happen in sequence; if step 2 or 3 fails we do NOT roll
 * back step 1 (no transactions over the Supabase HTTP API). A zombie
 * household with no members is recoverable (caller retries and hits the
 * "already in household" path via profile linkage failure) but unlikely
 * because the owner_id FK → auth.users is the only non-trivial check.
 */
export async function createHousehold(
  supabase: SupabaseLike,
  userId: string,
  name?: string,
): Promise<ClientResult<HouseholdSummary>> {
  if (!userId) return { data: null, error: "not_authenticated" };

  // Block if already in a household.
  const { data: existing, error: existingErr } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    return { data: null, error: "already_in_household" };
  }

  const cleanName = (name?.trim() || "My Household").slice(0, MAX_NAME_LEN);

  const { data: household, error: hErr } = await supabase
    .from("households")
    .insert({ name: cleanName, owner_id: userId })
    .select("id, name, invite_code")
    .single();
  if (hErr || !household) {
    return { data: null, error: hErr?.message || "create_failed" };
  }

  // Owner membership row. `role = 'owner'` — mirrors REST route.
  const { error: memErr } = await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: userId, role: "owner" });
  if (memErr) {
    // Surface but don't rollback — the household row is harmless without
    // members (the owner can leave to delete it).
    return { data: null, error: memErr.message };
  }

  // Link profile — best-effort. Failure here doesn't block the UI
  // refresh since the membership row is the source of truth.
  await supabase
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", userId);

  return {
    data: {
      id: household.id,
      name: household.name,
      invite_code: household.invite_code,
      isOwner: true,
      myRole: "owner",
    },
    error: null,
  };
}

/**
 * Fetch the caller's household (or null), members with computed
 * remaining macros, and upcoming meals. Shape matches `GET /api/household`
 * exactly so the UIs don't need to change.
 *
 * Returns `{ data: { household: null, members: [], meals: [] }, error }`
 * when the caller has no household — not `null`, so the UI can still
 * render its create/join affordance.
 */
export async function getMyHousehold(
  supabase: SupabaseLike,
  userId: string,
): Promise<ClientResult<HouseholdData>> {
  if (!userId) return { data: null, error: "not_authenticated" };

  const { data: membership, error: memErr } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (memErr) throw memErr;

  if (!membership) {
    return {
      data: { household: null, members: [], meals: [] },
      error: null,
    };
  }

  const householdId = membership.household_id as string;

  // Parallel fan-out to match the REST route's shape.
  const [hResp, mResp, mealsResp] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, owner_id, invite_code, created_at")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select("id, user_id, role, display_name, joined_at")
      .eq("household_id", householdId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("household_meals")
      .select(
        "id, date_key, meal_label, recipe_title, recipe_id, servings, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving, notes, added_by, created_at",
      )
      .eq("household_id", householdId)
      .gte("date_key", todayKey())
      .order("date_key", { ascending: true })
      .order("meal_label", { ascending: true })
      .limit(28),
  ]);

  if (hResp.error) throw hResp.error;
  if (mResp.error) throw mResp.error;
  if (mealsResp.error) throw mealsResp.error;

  const household = hResp.data as {
    id: string;
    name: string;
    owner_id: string;
    invite_code: string;
    created_at: string;
  } | null;
  const members = (mResp.data ?? []) as Array<{
    id: string;
    user_id: string;
    role: string;
    display_name: string | null;
    joined_at: string;
  }>;
  const meals = (mealsResp.data ?? []) as HouseholdMeal[];

  // Member macros: targets from profiles + today's logged entries.
  const memberIds = members.map((m) => m.user_id);
  const [profilesResp, entriesResp] = await Promise.all([
    memberIds.length
      ? supabase
          .from("profiles")
          .select("id, target_calories, target_protein, target_carbs, target_fat, display_name")
          .in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? supabase
          .from("nutrition_entries")
          .select("user_id, calories, protein, carbs, fat")
          .in("user_id", memberIds)
          .eq("date_key", todayKey())
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResp.error) throw profilesResp.error;
  if (entriesResp.error) throw entriesResp.error;
  const profiles = (profilesResp.data ?? []) as Array<{
    id: string;
    target_calories: number | null;
    target_protein: number | null;
    target_carbs: number | null;
    target_fat: number | null;
    display_name: string | null;
  }>;
  const entries = (entriesResp.data ?? []) as Array<{
    user_id: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  }>;

  const memberSummaries: MemberSummary[] = members.map((m) => {
    const profile = profiles.find((p) => p.id === m.user_id);
    const todays = entries.filter((e) => e.user_id === m.user_id);
    const consumed = {
      calories: todays.reduce((s, e) => s + (Number(e.calories) || 0), 0),
      protein: todays.reduce((s, e) => s + (Number(e.protein) || 0), 0),
      carbs: todays.reduce((s, e) => s + (Number(e.carbs) || 0), 0),
      fat: todays.reduce((s, e) => s + (Number(e.fat) || 0), 0),
    };
    const targets = {
      calories: Number(profile?.target_calories) || 2000,
      protein: Number(profile?.target_protein) || 130,
      carbs: Number(profile?.target_carbs) || 250,
      fat: Number(profile?.target_fat) || 65,
    };
    return {
      userId: m.user_id,
      role: m.role,
      displayName: m.display_name || profile?.display_name || "Member",
      targets,
      consumed: {
        calories: Math.round(consumed.calories),
        protein: roundTo1(consumed.protein),
        carbs: roundTo1(consumed.carbs),
        fat: roundTo1(consumed.fat),
      },
      remaining: {
        calories: Math.max(0, Math.round(targets.calories - consumed.calories)),
        protein: Math.max(0, roundTo1(targets.protein - consumed.protein)),
        carbs: Math.max(0, roundTo1(targets.carbs - consumed.carbs)),
        fat: Math.max(0, roundTo1(targets.fat - consumed.fat)),
      },
    };
  });

  return {
    data: {
      household: household
        ? {
            id: household.id,
            name: household.name,
            invite_code: household.invite_code,
            isOwner: household.owner_id === userId,
            myRole: membership.role as string,
          }
        : null,
      members: memberSummaries,
      meals,
    },
    error: null,
  };
}

/**
 * Join a household by invite code. Delegates to the
 * `household_join_by_invite_code` RPC because RLS cannot let a non-member
 * select the target household to validate the code — see the migration
 * file for the full rationale.
 */
export async function joinHouseholdByInviteCode(
  supabase: SupabaseLike,
  inviteCode: string,
  displayName?: string,
): Promise<ClientResult<{ household_id: string; household_name: string; already_member: boolean }>> {
  const trimmed = inviteCode?.trim();
  if (!trimmed) return { data: null, error: "missing_code" };

  const { data, error } = await supabase.rpc("household_join_by_invite_code", {
    p_invite_code: trimmed,
    p_display_name: displayName?.trim() || null,
  });
  if (error) throw error;

  const payload = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    message?: string;
    household_id?: string;
    household_name?: string;
    already_member?: boolean;
  };

  if (!payload.ok) {
    // Surface the RPC's domain error code as the client error string.
    return { data: null, error: payload.error || payload.message || "join_failed" };
  }
  return {
    data: {
      household_id: String(payload.household_id ?? ""),
      household_name: String(payload.household_name ?? ""),
      already_member: Boolean(payload.already_member),
    },
    error: null,
  };
}

/**
 * Leave the caller's current household.
 *
 * Owner-leaves-deletes-household semantics from the legacy REST route
 * are preserved: the `households` row is cascaded which takes down all
 * members + meals; profiles are then nulled out. Members-leave just
 * remove their own row. Both paths null `profiles.household_id` for
 * the caller.
 *
 * RLS supports these writes directly:
 *   - households DELETE requires owner_id = auth.uid() — enforced.
 *   - household_members DELETE requires user_id = auth.uid() — enforced.
 *   - profiles UPDATE is owner-only — enforced.
 */
export async function leaveHousehold(
  supabase: SupabaseLike,
  userId: string,
): Promise<ClientResult<{ wasOwner: boolean }>> {
  if (!userId) return { data: null, error: "not_authenticated" };

  const { data: membership, error: memErr } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (memErr) throw memErr;
  if (!membership) return { data: null, error: "not_in_household" };

  const householdId = membership.household_id as string;
  const wasOwner = membership.role === "owner";

  if (wasOwner) {
    // Owner delete cascades members + meals via FK ON DELETE CASCADE.
    const { error: delErr } = await supabase
      .from("households")
      .delete()
      .eq("id", householdId);
    if (delErr) throw delErr;
    // Best-effort null the household link for any profiles that still
    // point at the (now-deleted) household. RLS only lets each user
    // null their own, so in practice this only clears the owner's own
    // profile row — non-owners will null their own on their next
    // `leaveHousehold` / session refresh.
    await supabase
      .from("profiles")
      .update({ household_id: null })
      .eq("id", userId);
  } else {
    const { error: delErr } = await supabase
      .from("household_members")
      .delete()
      .eq("household_id", householdId)
      .eq("user_id", userId);
    if (delErr) throw delErr;
    await supabase
      .from("profiles")
      .update({ household_id: null })
      .eq("id", userId);
  }

  return { data: { wasOwner }, error: null };
}

export const __test__ = {
  MAX_MEMBERS,
  MAX_NAME_LEN,
};
