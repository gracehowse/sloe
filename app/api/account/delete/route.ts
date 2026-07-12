import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { assertOrigin } from "@/lib/api/assertOrigin";
import { captureRouteError } from "@/lib/observability/captureRouteError";

// Stripe SDK uses Node APIs — pin the runtime (mirrors the other Stripe
// routes: app/api/stripe/{checkout,subscription-status,webhook}/route.ts).
export const runtime = "nodejs";

/** Server-side Stripe client, or null when `STRIPE_SECRET_KEY` is unset
 *  (dev / CI / tests). Same guard shape as every other Stripe route so a
 *  missing key degrades gracefully instead of throwing. */
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

/**
 * DELETE /api/account/delete
 *
 * Permanently deletes the authenticated user's account.
 *
 * H3 fix (2026-04-21) — transactional semantics:
 *   Previously the route ran sequential deletes then `auth.admin.deleteUser`
 *   and returned `{ ok: true }` even when intermediate deletes failed
 *   (as long as the auth user itself was deleted), leaving orphaned rows.
 *   Now: if ANY data-delete step fails with a non-ignorable error, we
 *   abort BEFORE deleting the auth user and return 500 with structured
 *   details. The auth.admin.deleteUser call is the final step, gated on
 *   all prior deletes succeeding. Supabase has no cross-table tx
 *   primitive from the JS client, so this is the strongest guarantee
 *   available without a server-side RPC.
 *
 * ENG-1539 fix (2026-07-12) — cancel Stripe billing before deletion:
 *   The cascade removed the DB rows + auth user but never cancelled the
 *   user's Stripe subscription, so a deleted Pro user kept being charged.
 *   Step 5c now cancels every non-terminal subscription on the profile's
 *   `stripe_customer_id` and is gated by the same `errors`/abort contract:
 *   a cancel failure aborts the auth-user delete so billing and account
 *   state can never diverge. (Analytics/PostHog identity purge is NOT done
 *   here — the server only holds the PostHog ingest key, which cannot
 *   delete a person; that needs a personal API key + a follow-up.)
 *
 * Requires: Authorization header or session cookie.
 * Requires: SUPABASE_SERVICE_ROLE_KEY (server-side only).
 */
export async function DELETE(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sb = createSupabaseServiceRoleClient();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: "Account deletion unavailable — service key not configured" },
      { status: 503 },
    );
  }

  const errors: string[] = [];

  // Service-role: user-scoped by userId throughout. Every DELETE below filters
  // by the authenticated caller's id (user_id / author_id / reporter_id /
  // follower_id / plan_day_id derived from user_id), so a compromised or
  // missing RLS policy still cannot leak or destroy another user's rows.
  try {
    // 1. meal_plan_meals (needs day IDs)
    const { data: dayRows, error: dayReadErr } = await sb
      .from("meal_plan_days")
      .select("id")
      .eq("user_id", userId);
    if (dayReadErr && !isIgnorable(dayReadErr)) {
      errors.push(`meal_plan_days_read: ${dayReadErr.message}`);
    }
    const dayIds = (dayRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    if (dayIds.length > 0) {
      const { error } = await sb.from("meal_plan_meals").delete().in("plan_day_id", dayIds);
      if (error && !isIgnorable(error)) errors.push(`meal_plan_meals: ${error.message}`);
    }

    // 2. Remaining user-owned tables keyed by user_id / reporter_id / follower_id.
    const tablesToDelete: Array<{ table: string; column: string }> = [
      { table: "meal_plan_days", column: "user_id" },
      { table: "shopping_items", column: "user_id" },
      { table: "nutrition_entries", column: "user_id" },
      { table: "saves", column: "user_id" },
      { table: "app_notifications", column: "user_id" },
      { table: "creator_publish_notifications", column: "user_id" },
      { table: "recipe_plan_add_events", column: "user_id" },
      { table: "food_reports", column: "reporter_id" },
      { table: "author_follows", column: "follower_id" },
    ];

    for (const { table, column } of tablesToDelete) {
      const { error } = await sb.from(table).delete().eq(column, userId);
      if (error && !isIgnorable(error)) errors.push(`${table}: ${error.message}`);
    }

    // 3. Private (unpublished) recipes + their ingredients.
    const { data: recipes, error: recReadErr } = await sb
      .from("recipes")
      .select("id")
      .eq("author_id", userId)
      .eq("published", false);
    if (recReadErr && !isIgnorable(recReadErr)) {
      errors.push(`recipes_read: ${recReadErr.message}`);
    }
    const recipeIds = (recipes ?? []).map((r: { id: string }) => r.id);
    if (recipeIds.length > 0) {
      const { error: ingErr } = await sb
        .from("recipe_ingredients")
        .delete()
        .in("recipe_id", recipeIds);
      if (ingErr && !isIgnorable(ingErr)) errors.push(`recipe_ingredients: ${ingErr.message}`);
      const { error: recErr } = await sb.from("recipes").delete().in("id", recipeIds);
      if (recErr && !isIgnorable(recErr)) errors.push(`recipes: ${recErr.message}`);
    }

    // 4. Unattribute published recipes (keep them, remove author link).
    const { error: unattrErr } = await sb
      .from("recipes")
      .update({ author_id: null })
      .eq("author_id", userId);
    if (unattrErr && !isIgnorable(unattrErr)) errors.push(`recipes_unattribute: ${unattrErr.message}`);

    // 5. Legacy JSONB tables.
    for (const table of ["nutrition_journals", "shopping_lists"]) {
      const { error } = await sb.from(table).delete().eq("user_id", userId);
      if (error && !isIgnorable(error)) errors.push(`${table}: ${error.message}`);
    }

    // 5b. Storage object cleanup — `food-evidence` bucket.
    //
    // P1 (security review 2026-05-11): F-138 Phase 3 introduced the
    // `food-evidence` private bucket where users upload label photos to
    // back their barcode corrections. Files live under `{userId}/...`
    // per the bucket's RLS policy. Storage objects are NOT cascaded
    // when `auth.users` rows are deleted — only DB FKs cascade. Without
    // this step, a deleted user's evidence photos persist in the
    // bucket forever (GDPR erasure regression).
    //
    // We list all objects under the user's prefix, then bulk-remove.
    // Errors on missing-bucket / no-objects are non-fatal (treated as
    // success). Other errors block the auth-user delete via the
    // `errors` array — same gating as every other step.
    try {
      const { data: evidenceObjects, error: listErr } = await sb.storage
        .from("food-evidence")
        .list(userId, { limit: 1000 });
      if (listErr && !isIgnorableStorageError(listErr)) {
        errors.push(`food_evidence_list: ${listErr.message}`);
      } else if (evidenceObjects && evidenceObjects.length > 0) {
        const paths = evidenceObjects
          .map((o) => `${userId}/${o.name}`)
          .filter(Boolean);
        if (paths.length > 0) {
          const { error: removeErr } = await sb.storage
            .from("food-evidence")
            .remove(paths);
          if (removeErr && !isIgnorableStorageError(removeErr)) {
            errors.push(`food_evidence_remove: ${removeErr.message}`);
          }
        }
      }
    } catch (err) {
      // Bucket may not exist in some environments (pre-F-138 migrations,
      // local dev without storage seeded). Treat as no-op.
      const msg = (err as Error)?.message ?? "";
      if (!/bucket.*not.*found/i.test(msg)) {
        errors.push(`food_evidence_threw: ${msg}`);
      }
    }

    // 5c. Stripe subscription cancellation (ENG-1539).
    //
    // Before this step the cascade deleted the profile + auth user but NEVER
    // cancelled the user's Stripe subscription, so a deleted Pro user kept
    // being charged indefinitely (billing P1). Read the persisted
    // `profiles.stripe_customer_id` (written by the checkout webhook —
    // src/lib/stripe/webhookProcess.ts) HERE, before step 6 deletes the
    // profile row, then cancel every non-terminal subscription on that
    // customer immediately (stops billing now).
    //
    // Gated like every other step: a cancel failure pushes to `errors`,
    // which aborts the auth-user delete (step 7) so the client retries. The
    // retry is idempotent — an already-canceled subscription is skipped, not
    // re-cancelled. STRIPE_SECRET_KEY unset (dev / tests) → `getStripe()`
    // returns null and the whole step is skipped gracefully (no throw),
    // mirroring the other Stripe routes.
    const stripe = getStripe();
    if (stripe) {
      const { data: billingRows, error: billingReadErr } = await sb
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId);
      if (billingReadErr && !isIgnorable(billingReadErr)) {
        errors.push(`profiles_billing_read: ${billingReadErr.message}`);
      }
      const stripeCustomerId =
        (billingRows?.[0]?.stripe_customer_id as string | null | undefined) ?? null;
      if (stripeCustomerId) {
        try {
          const subs = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: "all",
            limit: 100,
          });
          for (const sub of subs.data) {
            // Already-terminal subs bill nothing and error on cancel — skip.
            if (sub.status === "canceled" || sub.status === "incomplete_expired") {
              continue;
            }
            await stripe.subscriptions.cancel(sub.id);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "stripe_error";
          errors.push(`stripe_subscription_cancel: ${msg}`);
        }
      }
    }

    // 6. Gate: if any prior step reported a real error, DO NOT delete the
    //    profile row or the auth user. Returning a 500 lets the client retry
    //    idempotently — all the per-table deletes above are safe to re-run.
    //
    //    ENG-1539 review fix (2026-07-12): the profile-row delete MUST come
    //    after this gate. `profiles.stripe_customer_id` is the only record of
    //    the Stripe customer, and step 5c reads it to cancel billing. If we
    //    deleted the profile before the gate (the original ordering) and the
    //    Stripe cancel had failed, the abort would still have destroyed the
    //    customer id — so the idempotent retry would find no id, skip the
    //    cancel, and fully delete the account with the subscription still
    //    billing. Deferring the profile delete until after a clean gate keeps
    //    the customer id available for every retry until cancellation lands.
    if (errors.length > 0) {
      console.error("[account/delete] Aborting deletion — prior errors:", errors);
      return NextResponse.json(
        {
          ok: false,
          error: "deletion_incomplete",
          message:
            "Some account data could not be deleted. Your account was not removed — retry the request.",
          details: errors,
        },
        { status: 500 },
      );
    }

    // 7. Profile row — only once every prior step (incl. Stripe cancel)
    //    succeeded, so a failed cancel never strands an uncancellable sub.
    const { error: profileErr } = await sb.from("profiles").delete().eq("id", userId);
    if (profileErr) {
      console.error("[account/delete] Profile delete failed post-gate:", profileErr.message);
      return NextResponse.json(
        {
          ok: false,
          error: "deletion_incomplete",
          message:
            "Your account data was cleared but the profile could not be removed — retry the request.",
          details: [`profiles: ${profileErr.message}`],
        },
        { status: 500 },
      );
    }

    // 8. Delete the auth user — last, and only if everything else succeeded.
    //
    // Cascade coverage (auto-handled by `auth.admin.deleteUser` via
    // `on delete cascade` FKs to `auth.users(id)`; no explicit delete
    // needed — verified 2026-05-11):
    //   - `user_custom_foods.user_id`              → cascade delete
    //   - `daily_targets.user_id`                  → cascade delete
    //   - `goal_history.user_id`                   → cascade delete (F-149)
    //   - `admin_users.user_id`                    → cascade delete
    //   - `user_food_votes.voter_id`               → cascade delete
    //   - `user_food_flags.flagger_id`             → cascade delete (F-138 P3)
    //   - `recipe_cook_history.user_id`            → cascade delete
    //   - `households` member rows (household_members.user_id) → cascade
    //
    // Un-attributed via `on delete set null` (kept public, source-link
    // dropped — same pattern as published recipes above):
    //   - `user_foods.submitted_by`                → set null
    //   - `verified_food_canonical.source_user_food_id` → set null
    //     (via user_foods cascade → set null chain)
    //
    // Explicitly deleted above (no FK cascade or we want gating):
    //   - meal_plan_meals, meal_plan_days
    //   - shopping_items, shopping_lists, nutrition_entries, saves
    //   - app_notifications, creator_publish_notifications
    //   - recipe_plan_add_events, food_reports, author_follows
    //   - nutrition_journals, profiles, private recipes + ingredients
    //   - food-evidence storage objects (step 5b)
    //   - Stripe subscriptions cancelled (step 5c — ENG-1539)
    const { error: authErr } = await sb.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[account/delete] auth.admin.deleteUser failed:", authErr.message);
      return NextResponse.json(
        {
          ok: false,
          error: "auth_delete_failed",
          message: authErr.message,
          details: [`auth: ${authErr.message}`],
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error)?.message ?? "unknown";
    console.error("[account/delete] Unhandled error:", msg);
    captureRouteError(err, "/api/account/delete");
    return NextResponse.json(
      {
        ok: false,
        error: "deletion_failed",
        message: msg,
        details: errors.length > 0 ? errors : undefined,
      },
      { status: 500 },
    );
  }
}

function isIgnorable(err: { message: string; code?: string } | null): boolean {
  if (!err) return true;
  const m = String(err.message).toLowerCase();
  const code = String(err.code ?? "");
  if (code === "PGRST205" || code === "42P01") return true;
  return m.includes("could not find the table") || m.includes("does not exist") || m.includes("permission");
}

function isIgnorableStorageError(err: { message: string } | null): boolean {
  if (!err) return true;
  const m = String(err.message).toLowerCase();
  // Bucket not seeded in this environment, or listing returned nothing
  // because the user uploaded no evidence photos. Either is fine.
  return (
    m.includes("bucket not found") ||
    m.includes("not found") ||
    m.includes("the resource was not found")
  );
}
