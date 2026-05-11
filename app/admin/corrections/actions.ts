"use server";

/**
 * F-138 Phase 4 — server actions for the admin corrections queue.
 *
 * Spec: docs/planning/F-138-P4-admin-queue-spec.md (§3.4)
 *
 * Four actions per row:
 *   1. approveCorrection      — flip pending → verified. Triggers handle
 *                                verified_at / verified_by / canonical
 *                                recompute (P0 migration lines 332–356).
 *   2. rejectCorrection       — flip pending → rejected. Trigger drops
 *                                from canonical if it was the source.
 *   3. editAndApproveCorrection — write user-edited macro values AND set
 *                                verification_status = 'verified' in one
 *                                UPDATE. The macro-edit reset trigger
 *                                fires only on `verified → verified`
 *                                macro changes (P0 line 192), so a
 *                                combined pending → verified write is
 *                                safe.
 *   4. clearFlagsForReapproved — when admin re-approves a verified row
 *                                that had been flagged by users, clear
 *                                `flagged_for_admin_at` so it doesn't
 *                                bounce back into the queue. Recommended
 *                                in spec §7 question 1.
 *
 * All actions use the service-role client because the row state-machine
 * trigger gates writes against `admin_users` membership — using the
 * caller's anon session would fail RLS. We re-verify the admin gate at
 * the action boundary (defence-in-depth: page.tsx already gates the
 * route, but actions are individually invokable).
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import { createSupabaseServiceRoleClient } from "../../../src/lib/supabase/serverAnonClient.ts";

const ADMIN_PATH = "/admin/corrections";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>;

async function getCallerUserIdAndAssertAdmin(): Promise<
  | { ok: true; userId: string; admin: AdminClient }
  | { ok: false; reason: "unauthenticated" | "not_admin" | "no_service_role" }
> {
  const cookieStore = await cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || `https://${projectId}.supabase.co`;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || publicAnonKey;
  const sessionClient = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // middleware owns writes
      },
    },
  });
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { ok: false, reason: "no_service_role" };

  const { data: adminRow } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) return { ok: false, reason: "not_admin" };

  return { ok: true, userId: user.id, admin };
}

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function approveCorrection(rowId: string): Promise<ActionResult> {
  const auth = await getCallerUserIdAndAssertAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason };
  // The state-machine trigger stamps verified_at / verified_by from
  // auth.uid() inside the DB — but we're using service role here, so
  // the trigger sees the service-role role. Set verified_by manually
  // so the audit trail is correct.
  const { error } = await auth.admin
    .from("user_foods")
    .update({
      verification_status: "verified",
      verified_by: auth.userId,
      verified_at: new Date().toISOString(),
      // Spec §7 Q1 (recommended yes) — admin re-approval clears the
      // flag flag so the row doesn't loop back into the queue. Safe
      // when transitioning from pending → verified too (no-op).
      flagged_for_admin_at: null,
    })
    .eq("id", rowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

export async function rejectCorrection(rowId: string): Promise<ActionResult> {
  const auth = await getCallerUserIdAndAssertAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason };
  const { error } = await auth.admin
    .from("user_foods")
    .update({
      verification_status: "rejected",
      verified_by: auth.userId,
      verified_at: new Date().toISOString(),
      flagged_for_admin_at: null,
    })
    .eq("id", rowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

export type EditPayload = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
  serving_size_g?: number | null;
};

export async function editAndApproveCorrection(
  rowId: string,
  edits: EditPayload,
): Promise<ActionResult> {
  const auth = await getCallerUserIdAndAssertAdmin();
  if (!auth.ok) return { ok: false, error: auth.reason };
  // Validate the payload — refuse negative or non-finite values. The
  // DB has CHECK constraints (calories >= 0 etc.) but failing here
  // gives a nicer error than a Postgres 23514.
  const cleaned: Record<string, number | null> = {};
  for (const key of Object.keys(edits) as Array<keyof EditPayload>) {
    const v = edits[key];
    if (v === undefined) continue;
    if (v === null) {
      cleaned[key] = null;
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return { ok: false, error: `Invalid value for ${key}` };
    }
    cleaned[key] = v;
  }
  if (Object.keys(cleaned).length === 0) {
    return { ok: false, error: "No edits supplied" };
  }
  const { error } = await auth.admin
    .from("user_foods")
    .update({
      ...cleaned,
      verification_status: "verified",
      verified_by: auth.userId,
      verified_at: new Date().toISOString(),
      flagged_for_admin_at: null,
    })
    .eq("id", rowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
