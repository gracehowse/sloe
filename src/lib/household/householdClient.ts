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
 *   - `getMyHousehold`'s co-member targets/consumed-today (the H4
 *     `share_targets` opt-in) go through a second `security definer`
 *     RPC, `get_household_shared_targets`, for the same underlying
 *     reason: `profiles` and `nutrition_entries` SELECT RLS is
 *     strictly self-only with no household carve-out, so a direct
 *     cross-member read is RLS-inert (silently returns zero rows, no
 *     error). ENG-1602 (2026-07-21) fixed a real bug here — the
 *     RLS-inert read was previously masked by hardcoded fallback
 *     numbers instead of routed through this RPC. See
 *     `supabase/migrations/20260721100000_eng1602_household_shared_targets_rpc.sql`.
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

import {
  coerceSharePreset,
  slotAllowedForPreset,
  type CustomShareGrid,
  type SharePreset,
} from "./sharePresetFilter";

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
   *
   * ENG-1602 (2026-07-21): `shareTargets: true` does NOT guarantee
   * `targets`/`remaining` are non-null for another member — the
   * `get_household_shared_targets` RPC can legitimately return no row
   * for an opted-in member (narrow read-time race, or targets never
   * set). Callers must branch on `targets`/`remaining` being non-null,
   * not on `shareTargets` alone, and render the same private/no-data
   * state either way — never a fabricated number.
   */
  shareTargets?: boolean;
  targets?: { calories: number; protein: number; carbs: number; fat: number } | null;
  consumed?: { calories: number; protein: number; carbs: number; fat: number };
  remaining?: { calories: number; protein: number; carbs: number; fat: number } | null;
  /**
   * Netflix-model v1 (2026-05-01): per-member sharing preset. Drives
   * what meals the member sees in the household surface. The caller's
   * own preset governs the filter in `getMyHousehold`; other members'
   * presets are exposed so the UI can label rows ("Alex shares dinners
   * only"). Defaults to `"dinners"` for rows pre-dating the migration.
   */
  sharePreset?: SharePreset;
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
  /**
   * T8 (full-sweep 2026-04-24): resolved at read-time from the cook's
   * **live** `profiles.display_name` (looked up via `added_by`). Falls
   * back to `null` when the cook has left the app entirely / profile
   * was cascade-deleted; UIs render "A member" for null. The DB still
   * carries a `cook_display_name` snapshot column (2026-05-01 migration)
   * for admin / forensic use, but the client **never** reads it:
   * snapshots become stale when a user renames (e.g. after transition),
   * which produced a dead-name leak on meal attribution. See
   * docs/decisions/2026-04-24-full-sweep-ship-verdict.md T8.
   */
  cookDisplayName: string | null;
  created_at: string;
};

/** Raw `household_meals` row shape as returned by the SELECT. Internal. */
type RawHouseholdMealRow = Omit<HouseholdMeal, "cookDisplayName">;

export type HouseholdData = {
  household: HouseholdSummary | null;
  members: MemberSummary[];
  meals: HouseholdMeal[];
};

export type ClientResult<T> = { data: T | null; error: string | null };

const MAX_MEMBERS = 8;
const MAX_NAME_LEN = 50;

/**
 * Local-calendar today key. Build 41 (2026-05-01) household-calories
 * fix: previously used `new Date().toISOString().slice(0, 10)` which
 * is the UTC date, but `nutrition_entries.date_key` and
 * `household_meals.date_key` are written from the user's LOCAL date
 * (`dateKeyFromDate(new Date())` everywhere else in the app). The
 * mismatch between UTC and local calendar dates around midnight (or
 * any non-zero offset) made `getMyHousehold` either miss today's
 * entries or pull yesterday's, producing the "calories wildly high
 * vs target" feedback (TestFlight `AJ_dfDvM2j6rnkOAgHTpwig`).
 *
 * Use the same local-calendar derivation as the rest of the app so
 * every read sees the same key the writer wrote.
 */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Error envelope for createHousehold. Carries a stable code, a
 * human-readable message, and the raw PG error for telemetry. The
 * caller MUST surface `message` to the user; `code` lets the UI
 * branch (e.g. "already_in_household" vs every other failure).
 */
export type CreateHouseholdError = {
  code:
    | "not_authenticated"
    | "already_in_household"
    | "create_household_failed"
    | "create_member_failed";
  message: string;
  /** Raw error for telemetry / Sentry breadcrumb. Never log to user. */
  raw?: unknown;
};

/**
 * Create a household with the caller as owner. Also adds the owner
 * `household_members` row and updates `profiles.household_id`.
 *
 * Three writes happen in sequence:
 *   1. Insert into `households` (creates the row + computes invite_code)
 *   2. Insert into `household_members` (owner membership row)
 *   3. Update `profiles.household_id` (best-effort linkage)
 *
 * F-142 (2026-05-10): if step 2 fails we now roll back step 1 by
 * deleting the just-created household. Without rollback, retries
 * accumulate zombie household rows (the existing-membership check at
 * step 0 reads `household_members`, so an orphan `households` row
 * doesn't block re-attempts). A zombie household with the owner as
 * the only id holder also wouldn't surface to the user — they'd see
 * "Couldn't create household" and silently leak rows.
 *
 * The error envelope returns a stable `code` + a friendly `message`
 * so the caller can decide whether to retry, surface to the user, or
 * capture telemetry — see `CreateHouseholdError`.
 */
export async function createHousehold(
  supabase: SupabaseLike,
  userId: string,
  name?: string,
): Promise<{ data: HouseholdSummary | null; error: CreateHouseholdError | null }> {
  if (!userId) {
    return { data: null, error: { code: "not_authenticated", message: "Not signed in." } };
  }

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
    return {
      data: null,
      error: {
        code: "already_in_household",
        message: "You already belong to a household. Leave it first to create a new one.",
      },
    };
  }

  const cleanName = (name?.trim() || "My Household").slice(0, MAX_NAME_LEN);

  const { data: household, error: hErr } = await supabase
    .from("households")
    .insert({ name: cleanName, owner_id: userId })
    .select("id, name, invite_code")
    .single();
  if (hErr || !household) {
    return {
      data: null,
      error: {
        code: "create_household_failed",
        message: "Couldn't create your household. Try again, or contact support if it keeps happening.",
        raw: hErr,
      },
    };
  }

  // Owner membership row. `role = 'owner'` — mirrors REST route.
  const { error: memErr } = await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: userId, role: "owner" });
  if (memErr) {
    // F-142 rollback: delete the orphan household row before returning.
    // Best-effort — if the rollback itself fails, we still surface the
    // primary error rather than mask it. Worst case, we have a zombie
    // household but the user gets the actionable error and can retry
    // (the next attempt will see no membership and re-enter this flow,
    // producing a different name `households` row — accepted leak vs
    // silent silent failure).
    try {
      await supabase.from("households").delete().eq("id", household.id);
    } catch {
      // swallowed — rollback is best-effort
    }
    return {
      data: null,
      error: {
        code: "create_member_failed",
        message: "Couldn't add you as an owner of the new household. Try again.",
        raw: memErr,
      },
    };
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
      .select("id, name, owner_id, invite_code, created_at, share_lunch, disbanded_at")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select("id, user_id, role, display_name, joined_at, share_targets, share_preset")
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
        // T8: `cook_display_name` intentionally omitted — resolved from
        // live `profiles.display_name` via `added_by` below to prevent
        // dead-name leak on post-transition rename.
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
    disbanded_at?: string | null;
  } | null;

  // Netflix-model v1 (2026-05-01): a household that has been soft-deleted
  // stays in the database for a retention window but must not leak back
  // into the UI. Treat it as "not in a household".
  if (household?.disbanded_at) {
    return {
      data: { household: null, members: [], meals: [] },
      error: null,
    };
  }

  const members = (mResp.data ?? []) as Array<{
    id: string;
    user_id: string;
    role: string;
    display_name: string | null;
    joined_at: string;
    share_targets?: boolean | null;
    share_preset?: string | null;
  }>;
  const rawMeals = (mealsResp.data ?? []) as RawHouseholdMealRow[];

  // Netflix-model v1: each member chooses their own preset. The viewer's
  // preset governs the meals returned on this call. Legacy rows without
  // a preset fall back to `dinners` (matches the DB default). The
  // household-wide `share_lunch` flag is kept as a legacy read-side
  // signal for clients not yet migrated to preset-aware copy; it is
  // derived from the viewer's preset so the two sources can't drift.
  const viewerMember = members.find((m) => m.user_id === userId);
  const viewerPreset = coerceSharePreset(viewerMember?.share_preset);

  // Custom-preset support lands in a follow-up — the per-cell grid
  // (`household_member_share_targets`) is not read in this commit; the
  // `custom` preset currently resolves to "share nothing" until the
  // read-through wires up.
  const customGrid: CustomShareGrid | null = null;

  const filteredRaw = rawMeals.filter((m) =>
    slotAllowedForPreset(viewerPreset, m.date_key, m.meal_label, customGrid),
  );

  // Member macros: caller's OWN targets from `profiles` + today's OWN
  // logged entries — both reads are self-scoped and satisfied directly
  // by RLS (`profiles_select_own` / "Own nutrition entries": both
  // `auth.uid() = <id column>`). Also fetch profiles for `added_by`
  // cooks who may not be current household members (left / deleted) —
  // so we can resolve the meal cook name against a live
  // `profiles.display_name` instead of the stale `cook_display_name`
  // snapshot that would leak dead-names. NOTE: RLS means this `.in(...)`
  // profiles read only ever returns the CALLER's own row in production
  // regardless of how many ids are requested — other members' rows are
  // silently filtered by RLS, which is why display name still falls
  // back to the `household_members.display_name` snapshot below.
  //
  // ENG-1602 (2026-07-21): co-members' targets + today's consumed macros
  // used to come from a second cross-member `.in(...)` query against
  // these SAME two tables. That query was RLS-inert (self-only SELECT,
  // no household carve-out on `profiles` or `nutrition_entries`) — it
  // silently returned zero rows, and the fallback below masked that with
  // hardcoded 2000/130/250/65 numbers. Every opted-in member saw
  // identical fabricated data. Fixed by routing co-member reads through
  // `get_household_shared_targets`, a SECURITY DEFINER RPC that
  // re-verifies co-membership + `share_targets = true` itself and
  // returns ONLY the derived numbers (see the migration file for the
  // full root-cause writeup + why an RPC beats an RLS carve-out here).
  const memberIds = members.map((m) => m.user_id);
  const cookIds = Array.from(
    new Set(
      filteredRaw
        .map((m) => m.added_by)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const profileLookupIds = Array.from(new Set([...memberIds, ...cookIds]));
  const [profilesResp, entriesResp, sharedResp] = await Promise.all([
    profileLookupIds.length
      ? supabase
          .from("profiles")
          .select("id, target_calories, target_protein, target_carbs, target_fat, display_name")
          .in("id", profileLookupIds)
      : Promise.resolve({ data: [], error: null }),
    // Self-scoped only — RLS would filter anything else anyway. Kept
    // explicit (`.eq("user_id", userId)` rather than `.in(memberIds)`)
    // so the query shape documents the real access boundary instead of
    // implying a cross-member read that RLS silently no-ops.
    supabase
      .from("nutrition_entries")
      .select("user_id, calories, protein, carbs, fat")
      .eq("user_id", userId)
      .eq("date_key", todayKey()),
    // ENG-1602: co-members' targets + today's consumed macros, computed
    // server-side. `p_date_key` is passed explicitly as the CALLER's own
    // local `todayKey()` — never left to the RPC's `current_date`
    // default, which would read the DB session's (UTC) day and
    // reintroduce the Build-41 UTC-vs-local mismatch for any non-UTC
    // household member.
    supabase.rpc("get_household_shared_targets", { p_date_key: todayKey() }),
  ]);
  if (profilesResp.error) throw profilesResp.error;
  if (entriesResp.error) throw entriesResp.error;
  if (sharedResp.error) throw sharedResp.error;
  const profiles = (profilesResp.data ?? []) as Array<{
    id: string;
    target_calories: number | null;
    target_protein: number | null;
    target_carbs: number | null;
    target_fat: number | null;
    display_name: string | null;
  }>;
  // Keyed by co-member user_id. Only opted-in co-members the RPC's own
  // server-side checks approved ever appear here — absence means "not
  // opted in" or "RPC found nothing to share", and both render the same
  // private/no-data UI state below (never a fabricated number).
  const sharedTargetsByUserId = new Map<
    string,
    {
      target_calories: number | null;
      target_protein: number | null;
      target_carbs: number | null;
      target_fat: number | null;
      consumed_calories: number | null;
      consumed_protein: number | null;
      consumed_carbs: number | null;
      consumed_fat: number | null;
    }
  >();
  for (const row of (sharedResp.data ?? []) as Array<{
    user_id: string;
    target_calories: number | null;
    target_protein: number | null;
    target_carbs: number | null;
    target_fat: number | null;
    consumed_calories: number | null;
    consumed_protein: number | null;
    consumed_carbs: number | null;
    consumed_fat: number | null;
  }>) {
    sharedTargetsByUserId.set(row.user_id, row);
  }

  // T8: resolve cook attribution at read-time from live profile data.
  // Profile missing / display_name missing → null → UI renders "A member".
  // Never reads the `cook_display_name` column snapshot (dead-name guard).
  const liveDisplayName = new Map<string, string>();
  for (const p of profiles) {
    if (p.display_name) liveDisplayName.set(p.id, p.display_name);
  }
  const meals: HouseholdMeal[] = filteredRaw.map((raw) => ({
    ...raw,
    cookDisplayName: raw.added_by ? liveDisplayName.get(raw.added_by) ?? null : null,
  }));
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
    const memberPreset = coerceSharePreset(m.share_preset);

    if (!isSelf && !sharesTargets) {
      return {
        userId: m.user_id,
        role: m.role,
        displayName,
        shareTargets: false,
        targets: null,
        remaining: null,
        sharePreset: memberPreset,
      };
    }

    if (!isSelf) {
      // ENG-1602: opted-in co-member. `profile?.target_*` is NOT used
      // here — RLS means `profile` never resolves for anyone but the
      // caller, which is exactly the bug this fix removes. The RPC
      // result is the only legitimate source for another member's
      // targets/consumed, and it has already re-verified co-membership
      // + share_targets=true server-side.
      const shared = sharedTargetsByUserId.get(m.user_id);
      if (!shared || shared.target_calories == null) {
        // Legitimately nothing to show: either the RPC found no
        // matching row (e.g. `share_targets` flipped off between the
        // `household_members` read above and this RPC call — a narrow
        // read-time race, not a steady-state outcome) or the co-member
        // has opted in but has never set numeric targets (pre-onboarding
        // profile). Either way, render the SAME private/no-data state as
        // the opted-out branch above — never fabricate 2000/130/250/65
        // or any other placeholder. Intentional reuse of that state, not
        // a gap: a distinct "unavailable" vs "private" copy would need a
        // product decision this ticket doesn't make.
        return {
          userId: m.user_id,
          role: m.role,
          displayName,
          shareTargets: true,
          targets: null,
          remaining: null,
          sharePreset: memberPreset,
        };
      }
      const targets = {
        calories: Number(shared.target_calories) || 0,
        protein: Number(shared.target_protein) || 0,
        carbs: Number(shared.target_carbs) || 0,
        fat: Number(shared.target_fat) || 0,
      };
      const consumed = {
        calories: Number(shared.consumed_calories) || 0,
        protein: Number(shared.consumed_protein) || 0,
        carbs: Number(shared.consumed_carbs) || 0,
        fat: Number(shared.consumed_fat) || 0,
      };
      return {
        userId: m.user_id,
        role: m.role,
        displayName,
        shareTargets: true,
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
        sharePreset: memberPreset,
      };
    }

    // Self: unchanged from pre-ENG-1602 behaviour. `profile` here always
    // resolves to the caller's own row (RLS self-read), so this was never
    // part of the cross-member RLS bug. The 2000/130/250/65 fallback is a
    // long-standing, separate product decision for "no target set yet"
    // (pre-onboarding), not a fabrication of someone else's data.
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
      shareTargets: sharesTargets,
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
      sharePreset: memberPreset,
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

    // Netflix-model v1 (2026-05-01) — if that was the last member,
    // flag the household as disbanded so reads stop returning it but
    // `household_meals` stay queryable for any lingering history
    // references. `POST /api/cron/household-purge` (ENG-1359,
    // `src/lib/server/householdPurgeJob.ts`) hard-deletes households
    // disbanded >= 30 days ago via a daily GitHub Actions cron
    // (`.github/workflows/scheduled-crons.yml`, 07:00 UTC). This
    // branch only fires when the non-owner leaves a household whose
    // owner has already departed — typical member leaves don't
    // trigger it.
    const { count: remaining } = (await supabase
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)) as { count: number | null };

    if (remaining === 0) {
      await supabase
        .from("households")
        .update({ disbanded_at: new Date().toISOString() })
        .eq("id", householdId);
    }
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

/**
 * Netflix-model v1 (2026-05-01) — per-member share preset write.
 *
 * RLS: `household_members` has "Members can update own share_targets"
 * keyed to `user_id = auth.uid()`. The same predicate lets callers
 * update their own `share_preset` (presets live on the same row;
 * Supabase's `UPDATE` policies are table-level, not column-level).
 * A member cannot flip another member's preset — the update silently
 * matches zero rows and the caller surfaces `update_failed`.
 */
export async function setMemberSharePreset(
  supabase: SupabaseLike,
  userId: string,
  preset: SharePreset,
): Promise<ClientResult<{ sharePreset: SharePreset }>> {
  if (!userId) return { data: null, error: "not_authenticated" };
  const { error } = await supabase
    .from("household_members")
    .update({ share_preset: preset })
    .eq("user_id", userId);
  if (error) return { data: null, error: (error as any)?.message || "update_failed" };
  return { data: { sharePreset: preset }, error: null };
}

/**
 * Netflix-model v1 (2026-05-01) — snapshot the cook's display_name at
 * insert time. Callers should use this helper rather than inserting
 * `household_meals` directly so historical attribution survives the
 * cook leaving the household. Safe no-op when the current membership
 * row has no display_name (stays null — UI falls back to "A member").
 */
export async function insertHouseholdMealWithCookSnapshot(
  supabase: SupabaseLike,
  userId: string,
  row: Omit<Partial<HouseholdMeal>, "added_by" | "cookDisplayName"> & {
    household_id: string;
    date_key: string;
    recipe_title: string;
  },
): Promise<ClientResult<{ id: string }>> {
  if (!userId) return { data: null, error: "not_authenticated" };

  // Resolve current membership display_name for the snapshot. One row
  // by construction: we insert under the caller's membership and the
  // unique constraint ensures a single (household_id, user_id).
  const { data: member, error: memErr } = await supabase
    .from("household_members")
    .select("display_name")
    .eq("household_id", row.household_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (memErr) throw memErr;

  // Fall back to profiles.display_name if the member row is missing
  // one (legacy rows / pre-snapshot data). Still nullable — that's
  // acceptable per the column's NULL contract.
  let cookName = (member as any)?.display_name ?? null;
  if (!cookName) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    cookName = (profile as any)?.display_name ?? null;
  }

  const { data, error } = await supabase
    .from("household_meals")
    .insert({ ...row, added_by: userId, cook_display_name: cookName })
    .select("id")
    .single();
  if (error) return { data: null, error: (error as any)?.message || "insert_failed" };
  return { data: { id: (data as any).id }, error: null };
}

// ─── F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`, 2026-05-06) ────────
// Email-targeted invite flow. The "+ Add" button on Household settings
// was a dead navigation; this gives it a real flow. The owner enters
// an email, an invite row is persisted, and the moment the invitee
// next opens Suppr they see "X invited you to their household —
// Accept / Decline" on the /household surface. No email delivery in
// v1 — the invitee finds the invite via JWT-email match in `auth.email()`.
// Migration: `supabase/migrations/20260507120000_household_invites.sql`.

export type HouseholdInvite = {
  id: string;
  household_id: string;
  inviter_user_id: string;
  invitee_email: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
};

/** Inviter-facing: email a household invite to `invitee_email`. */
export async function sendHouseholdInvite(
  supabase: SupabaseLike,
  householdId: string,
  inviteeEmail: string,
): Promise<ClientResult<HouseholdInvite>> {
  const email = (inviteeEmail || "").trim();
  if (!email) return { data: null, error: "missing_email" };

  const { data, error } = await supabase.rpc("household_invite_send", {
    p_household_id: householdId,
    p_invitee_email: email,
  });

  if (error) {
    const code = (error as any)?.message || (error as any)?.code || "invite_failed";
    if (typeof code === "string" && code.includes("invalid_email")) return { data: null, error: "invalid_email" };
    if (typeof code === "string" && code.includes("not_household_owner")) return { data: null, error: "not_household_owner" };
    if (typeof code === "string" && code.includes("cannot_invite_self")) return { data: null, error: "cannot_invite_self" };
    return { data: null, error: "invite_failed" };
  }

  return { data: data as HouseholdInvite, error: null };
}

/** Inviter-facing: cancel a still-pending outgoing invite. */
export async function cancelHouseholdInvite(
  supabase: SupabaseLike,
  inviteId: string,
): Promise<ClientResult<HouseholdInvite>> {
  const { data, error } = await supabase.rpc("household_invite_cancel", {
    p_invite_id: inviteId,
  });
  if (error) return { data: null, error: "cancel_failed" };
  return { data: data as HouseholdInvite, error: null };
}

/** Invitee-facing: accept a pending invite (RPC enforces email match). */
export async function acceptHouseholdInvite(
  supabase: SupabaseLike,
  inviteId: string,
): Promise<ClientResult<{ household_id: string; user_id: string }>> {
  const { data, error } = await supabase.rpc("household_invite_accept", {
    p_invite_id: inviteId,
  });
  if (error) return { data: null, error: "accept_failed" };
  const payload = (data ?? {}) as { household_id?: string; user_id?: string };
  return {
    data: {
      household_id: String(payload.household_id ?? ""),
      user_id: String(payload.user_id ?? ""),
    },
    error: null,
  };
}

/** Invitee-facing: decline a pending invite. */
export async function declineHouseholdInvite(
  supabase: SupabaseLike,
  inviteId: string,
): Promise<ClientResult<HouseholdInvite>> {
  const { data, error } = await supabase.rpc("household_invite_decline", {
    p_invite_id: inviteId,
  });
  if (error) return { data: null, error: "decline_failed" };
  return { data: data as HouseholdInvite, error: null };
}

/** Inviter-facing: list invites the caller has sent for `householdId`. */
export async function listSentHouseholdInvites(
  supabase: SupabaseLike,
  householdId: string,
): Promise<ClientResult<HouseholdInvite[]>> {
  const { data, error } = await supabase
    .from("household_invites")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: "load_failed" };
  return { data: (data ?? []) as HouseholdInvite[], error: null };
}

/**
 * Invitee-facing: list invites addressed to the caller's email (RLS
 * scopes by JWT email). Used by the /household banner that surfaces
 * "X invited you to their household — Accept / Decline".
 */
export async function listReceivedHouseholdInvites(
  supabase: SupabaseLike,
): Promise<ClientResult<HouseholdInvite[]>> {
  const { data, error } = await supabase
    .from("household_invites")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: "load_failed" };
  return { data: (data ?? []) as HouseholdInvite[], error: null };
}

export const __test__ = {
  MAX_MEMBERS,
  MAX_NAME_LEN,
};
