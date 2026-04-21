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
  /**
   * F-16 household-level sharing toggle. `false` (default) means only
   * dinners are shared with other members. `true` extends sharing to
   * lunches. Owner-only write (enforced by RLS + UI); members read.
   */
  shareLunch: boolean;
};

/**
 * Per-member row. The caller's own row always carries `targets`,
 * `consumed`, and `remaining`. Other members' rows carry ONLY
 * `userId`, `role`, and `displayName` — targets / consumed / remaining
 * are stripped in `getMyHousehold` per the F-16 legal-reviewer approved
 * scope narrowing (TestFlight `AJ1AeYJ--fF`, 2026-04-19). The UI must
 * render nothing macro-flavoured when those fields are absent.
 */
export type MemberSummary = {
  userId: string;
  role: string;
  displayName: string;
  /**
   * Per-member opt-in for target sharing (H4, 2026-04-21). True means
   * the member has toggled "Share my nutrition targets with household"
   * on; false/undefined means their targets/remaining are private and
   * callers must render {@link TARGETS_PRIVATE_LABEL} (or similar) in
   * place of numbers. The caller's own row always carries this flag
   * plus targets/consumed/remaining regardless.
   */
  shareTargets?: boolean;
  targets?: { calories: number; protein: number; carbs: number; fat: number } | null;
  consumed?: { calories: number; protein: number; carbs: number; fat: number };
  remaining?: { calories: number; protein: number; carbs: number; fat: number } | null;
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

  // Block if already in a household. `order + limit(1) + maybeSingle` is
  // the defensive read: a `.maybeSingle()` alone throws PGRST "multiple
  // rows returned" when legacy duplicates exist for the same user_id
  // (see TestFlight feedback AB75VswC, 2026-04-19). The unique
  // constraint added in migration `20260424120000_household_members_unique_user`
  // formalises the one-membership-per-user invariant at the DB layer,
  // but the client stays defensive so we don't crash on databases that
  // haven't applied the migration yet.
  const { data: existing, error: existingErr } = await supabase
    .from("household_members")
    .select("household_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
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
      // New households default to dinner-only. The owner can flip this
      // later via the `Share lunches too` toggle on the household
      // screen (F-16, 2026-04-25 migration).
      shareLunch: false,
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

  // Defensive read: `order + limit(1) + maybeSingle` so legacy users
  // whose `household_members` table carries duplicate rows (orphans
  // from pre-2026-04-18 join/leave cycles) still resolve to a single
  // current household instead of throwing PGRST "multiple rows
  // returned". See TestFlight feedback AB75VswC (2026-04-19) and the
  // backing unique-constraint migration
  // `20260424120000_household_members_unique_user.sql`.
  const { data: membership, error: memErr } = await supabase
    .from("household_members")
    .select("household_id, role, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (memErr) throw memErr;

  if (!membership) {
    return {
      data: { household: null, members: [], meals: [] },
      error: null,
    };
  }

  const householdId = membership.household_id as string;

  // Parallel fan-out to match the REST route's shape. `share_lunch` is
  // read from the household row so we can decide which meal labels
  // leave the server (F-16 scope narrowing — default dinner-only,
  // lunch added only when the household opts in).
  const [hResp, mResp, mealsResp] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, owner_id, invite_code, created_at, share_lunch")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select("id, user_id, role, display_name, joined_at, share_targets")
      .eq("household_id", householdId)
      .order("joined_at", { ascending: true }),
    // Fetch all upcoming meals for the household; the meal_label filter
    // is applied client-side below. We can't push it into Postgres with
    // a straight `.in(...)` because `meal_label` is a free-form text
    // column and historical rows were written as both "Dinner" and
    // "dinner" (see `app/api/household/meals/route.ts` default vs.
    // user-typed labels). Normalising case in JS keeps the guard
    // robust regardless of which casing landed in the row.
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
    share_lunch?: boolean | null;
  } | null;
  const members = (mResp.data ?? []) as Array<{
    id: string;
    user_id: string;
    role: string;
    display_name: string | null;
    joined_at: string;
    share_targets?: boolean | null;
  }>;
  const rawMeals = (mealsResp.data ?? []) as HouseholdMeal[];

  // F-16 scope narrowing (legal-approved, TestFlight `AJ1AeYJ--fF`):
  // Only dinners are shared by default. Lunches are added when the
  // household flips `share_lunch`. Breakfasts and snacks are NEVER
  // shared — no opt-in exists for them.
  const shareLunch = Boolean(household?.share_lunch);
  const allowedLabels = shareLunch ? new Set(["dinner", "lunch"]) : new Set(["dinner"]);
  const meals = rawMeals.filter((m) => {
    const label = (m.meal_label ?? "").trim().toLowerCase();
    return allowedLabels.has(label);
  });

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
    // Prefer the live profile display_name over the snapshot captured at
    // join time. A stale snapshot can leak a user's legacy (pre-transition)
    // name to other household members after they update their profile.
    const displayName = profile?.display_name || m.display_name || "Member";
    const isSelf = m.user_id === userId;
    const sharesTargets = Boolean(m.share_targets);

    // H4 consent gate (2026-04-21): a member's targets/remaining leave
    // their row only when the member has explicitly opted in via the
    // `share_targets` toggle. Default off. The caller's own row is
    // always revealed to themselves. This supersedes the F-16 blanket
    // strip: other members can now opt in per-member, but targets stay
    // private by default. The mirror guard on the REST route
    // (`app/api/household/route.ts`) enforces the same rule server-side.
    if (!isSelf && !sharesTargets) {
      return {
        userId: m.user_id,
        role: m.role,
        displayName,
        shareTargets: false,
        targets: null,
        remaining: null,
      };
    }

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
      displayName,
      shareTargets: isSelf ? sharesTargets : true,
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
            shareLunch: Boolean(household.share_lunch),
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

  // Defensive read: mirrors `getMyHousehold` / `createHousehold` so a
  // user whose membership table still has legacy duplicates can still
  // leave cleanly (otherwise they'd be permanently stuck on the
  // "Couldn't load" alert with no way out). Picks the most recent
  // membership — that's the one `getMyHousehold` would also resolve,
  // so leave acts on the same row the user sees.
  const { data: membership, error: memErr } = await supabase
    .from("household_members")
    .select("household_id, role, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (memErr) throw memErr;
  if (!membership) return { data: null, error: "not_in_household" };

  const householdId = membership.household_id as string;
  const wasOwner = membership.role === "owner";

  // Invariant: on leave, both sources-of-truth must be reset to keep
  // the unique constraint intact. `household_members` (the membership
  // row) AND `profiles.household_id` (the profile pointer) are both
  // cleared below. Dropping either side is how duplicate memberships
  // accumulated historically (AB75VswC) — never skip one.

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

/**
 * Owner-only toggle for `households.share_lunch`. Writes through RLS
 * ("Household owner full access" / "Owners can update own household" —
 * both enforce `owner_id = auth.uid()`), so a member attempting to
 * flip it gets `PGRST` row-not-found and the caller surfaces an
 * `update_failed` error. The UI should only render the control for
 * owners — this function is the belt + braces server-side.
 */
export async function setHouseholdShareLunch(
  supabase: SupabaseLike,
  householdId: string,
  shareLunch: boolean,
): Promise<ClientResult<{ shareLunch: boolean }>> {
  if (!householdId) return { data: null, error: "missing_household_id" };
  const { error } = await supabase
    .from("households")
    .update({ share_lunch: shareLunch })
    .eq("id", householdId);
  if (error) return { data: null, error: (error as any)?.message || "update_failed" };
  return { data: { shareLunch }, error: null };
}

/**
 * Toggle the caller's own `household_members.share_targets` flag (H4,
 * 2026-04-21). RLS policy `Members can update own share_targets`
 * enforces `user_id = auth.uid()` so a member cannot flip another
 * member's row even if they pass a foreign userId — the update
 * silently matches zero rows in that case and returns `update_failed`.
 */
export async function setHouseholdMemberShareTargets(
  supabase: SupabaseLike,
  userId: string,
  shareTargets: boolean,
): Promise<ClientResult<{ shareTargets: boolean }>> {
  if (!userId) return { data: null, error: "not_authenticated" };
  const { error } = await supabase
    .from("household_members")
    .update({ share_targets: shareTargets })
    .eq("user_id", userId);
  if (error) return { data: null, error: (error as any)?.message || "update_failed" };
  return { data: { shareTargets }, error: null };
}

export const __test__ = {
  MAX_MEMBERS,
  MAX_NAME_LEN,
};
