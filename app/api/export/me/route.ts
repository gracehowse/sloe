/**
 * GET /api/export/me — "Export everything" data dump.
 *
 * Returns a single JSON blob with every Suppr record we hold for the
 * authenticated user. Counters the universal "lock-in anxiety"
 * pattern surfaced by the 2026-04-30 user-sentiment audit
 * (Paprika "recipes disappeared after upgrade", MFP "history gone
 * after update", Recime/Honeydew "data vanished post-payment").
 *
 * GDPR Article 20 ("right to data portability") is the legal floor;
 * this endpoint exceeds it by being one tap deep, zero-friction,
 * and authenticated-only — no email round-trip, no support ticket.
 *
 * Auth: `getUserIdFromRequest` (Authorization bearer token from
 * mobile, sb-* session cookie from web). 401 on miss.
 *
 * Rate limit: 1 request / 60s per user. The bucket is keyed on
 * `userId` (passed into `rateLimit`) so an IP-rotating attacker
 * can't drain another user's bucket and a shared NAT can't starve
 * legitimate users either.
 *
 * Schema version: bumped on every breaking shape change. Consumers
 * (re-import tooling we don't yet ship, third-party migrations) should
 * gate on `schemaVersion`. Bump only when keys move / disappear; new
 * additive keys are non-breaking.
 *
 * Why JSON (not CSV) for v1: preserves nested structure (plan_meals
 * inside meal_plan_days, ingredients inside recipes) and round-trips
 * cleanly. The existing CSV path
 * (`src/lib/export/nutritionLogToCsv.ts`) stays — it's the
 * spreadsheet-friendly view of the meal log only.
 */

import { NextResponse } from "next/server";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { AnalyticsEvents } from "@/lib/analytics/events";
import {
  SUPPR_EXPORT_SCHEMA_VERSION,
  SUPPR_EXPORT_LOG_DAYS,
} from "@/lib/export/exportEverythingSchema";

// Next.js 15 forbids non-handler exports from a `route.ts` file.
// Schema constants live in `src/lib/export/exportEverythingSchema.ts`
// — import them there if you need them in tests or callers.

type ExportPayload = {
  schemaVersion: number;
  exportedAt: string;
  userId: string;
  windowDays: number;
  profile: Record<string, unknown> | null;
  recipes: unknown[];
  recipeIngredients: unknown[];
  saves: unknown[];
  mealLog: unknown[];
  weightHistory: unknown[];
  customFoods: unknown[];
  plans: unknown[];
  planDays: unknown[];
  planMeals: unknown[];
  shopping: unknown[];
  savedMeals: unknown[];
  savedMealItems: unknown[];
  recipeNotes: unknown[];
};

function dateKeyDaysAgo(days: number): string {
  const t = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Convenience: most table reads have the shape `{ data, error }`
 *  and a missing-table error we want to swallow on older / partial
 *  Supabase environments. Returns `[]` for any "table not found"
 *  response so the export never 500s on a deployment with a partial
 *  schema. Real network / RLS errors propagate. */
function isMissingTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; code?: string };
  if (e.code === "PGRST205" || e.code === "42P01") return true;
  const m = (e.message ?? "").toLowerCase();
  return (
    m.includes("could not find the table") ||
    m.includes("does not exist") ||
    m.includes("schema cache")
  );
}

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // Rate limit: 1 export / 60s per user. Generous enough that a
  // user accidentally double-tapping the row hits the limit cleanly
  // (the second tap gets a structured 429), strict enough that bots
  // can't scrape the full dataset cheaply.
  const rl = await rateLimit({
    keyPrefix: "api:export:me",
    limit: 1,
    windowMs: 60_000,
    userId,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message:
          "You can export once per minute. Try again in a moment.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  const sb = createSupabaseServiceRoleClient();
  if (!sb) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message:
          "Export is temporarily unavailable — service key not configured.",
      },
      { status: 503 },
    );
  }

  const sinceIso = isoDaysAgo(SUPPR_EXPORT_LOG_DAYS);
  const sinceDateKey = dateKeyDaysAgo(SUPPR_EXPORT_LOG_DAYS);

  try {
    // Run reads in parallel — order is independent. Each step swallows
    // missing-table errors so deployments without the optional
    // tables (e.g. user_recipe_notes on older DBs) still produce a
    // usable export.
    const [
      profileRes,
      recipesRes,
      savesRes,
      mealLogRes,
      weightRes,
      customFoodsRes,
      plansRes,
      planDaysRes,
      shoppingRes,
      savedMealsRes,
      recipeNotesRes,
    ] = await Promise.all([
      sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
      sb.from("recipes").select("*").eq("author_id", userId),
      sb.from("saves").select("*").eq("user_id", userId),
      sb
        .from("nutrition_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("date_key", sinceDateKey)
        .order("date_key", { ascending: true }),
      sb
        .from("health_snapshots")
        .select("*")
        .eq("user_id", userId)
        .gte("captured_at", sinceIso)
        .order("captured_at", { ascending: true }),
      sb.from("user_custom_foods").select("*").eq("user_id", userId),
      sb.from("meal_plans").select("*").eq("user_id", userId),
      sb.from("meal_plan_days").select("*").eq("user_id", userId),
      sb
        .from("shopping_items")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true),
      sb.from("user_saved_meals").select("*").eq("user_id", userId),
      sb.from("user_recipe_notes").select("*").eq("user_id", userId),
    ]);

    // Unwrap each. Missing-table errors degrade to empty array; any
    // other error surfaces as a 500 (we'd rather block than ship a
    // silently-truncated export — that's exactly the lock-in
    // anxiety the feature is meant to counter).
    function unwrap<T>(
      res: { data: T | null; error: unknown },
      label: string,
      fallback: T,
    ): T {
      if (res.error) {
        if (isMissingTable(res.error)) return fallback;
        throw new Error(
          `${label}: ${(res.error as { message?: string }).message ?? "unknown"}`,
        );
      }
      return (res.data ?? fallback) as T;
    }

    const profile = unwrap<Record<string, unknown> | null>(
      profileRes,
      "profile",
      null,
    );
    const recipes = unwrap<unknown[]>(recipesRes, "recipes", []);
    const saves = unwrap<unknown[]>(savesRes, "saves", []);
    const mealLog = unwrap<unknown[]>(mealLogRes, "mealLog", []);
    const weightHistory = unwrap<unknown[]>(weightRes, "weightHistory", []);
    const customFoods = unwrap<unknown[]>(
      customFoodsRes,
      "customFoods",
      [],
    );
    const plans = unwrap<unknown[]>(plansRes, "plans", []);
    const planDays = unwrap<unknown[]>(planDaysRes, "planDays", []);
    const shopping = unwrap<unknown[]>(shoppingRes, "shopping", []);
    const savedMeals = unwrap<unknown[]>(savedMealsRes, "savedMeals", []);
    const recipeNotes = unwrap<unknown[]>(
      recipeNotesRes,
      "recipeNotes",
      [],
    );

    // Two follow-up reads need IDs from the parallel batch above.
    // Run them serially (only) when there's something to fetch.
    const recipeIds = recipes
      .map((r) => (r as { id?: string }).id)
      .filter((v): v is string => typeof v === "string");
    const planDayIds = planDays
      .map((d) => (d as { id?: string }).id)
      .filter((v): v is string => typeof v === "string");
    const savedMealIds = savedMeals
      .map((m) => (m as { id?: string }).id)
      .filter((v): v is string => typeof v === "string");

    const [recipeIngRes, planMealsRes, savedMealItemsRes] = await Promise.all([
      recipeIds.length
        ? sb.from("recipe_ingredients").select("*").in("recipe_id", recipeIds)
        : Promise.resolve({ data: [], error: null }),
      planDayIds.length
        ? sb.from("meal_plan_meals").select("*").in("plan_day_id", planDayIds)
        : Promise.resolve({ data: [], error: null }),
      savedMealIds.length
        ? sb
            .from("user_saved_meal_items")
            .select("*")
            .in("saved_meal_id", savedMealIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const recipeIngredients = unwrap<unknown[]>(
      recipeIngRes as { data: unknown[] | null; error: unknown },
      "recipeIngredients",
      [],
    );
    const planMeals = unwrap<unknown[]>(
      planMealsRes as { data: unknown[] | null; error: unknown },
      "planMeals",
      [],
    );
    const savedMealItems = unwrap<unknown[]>(
      savedMealItemsRes as { data: unknown[] | null; error: unknown },
      "savedMealItems",
      [],
    );

    const payload: ExportPayload = {
      schemaVersion: SUPPR_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      userId,
      windowDays: SUPPR_EXPORT_LOG_DAYS,
      profile,
      recipes,
      recipeIngredients,
      saves,
      mealLog,
      weightHistory,
      customFoods,
      plans,
      planDays,
      planMeals,
      shopping,
      savedMeals,
      savedMealItems,
      recipeNotes,
    };

    const body = JSON.stringify(payload, null, 2);
    const sizeBytes = new TextEncoder().encode(body).length;

    // Fire-and-forget analytics. Resolved-or-rejected, the response
    // ships either way. PostHog is the moat-tracking surface here:
    // we want to know how often this is used because that's how we
    // tell whether the lock-in counter-message is reaching users.
    void serverTrack(AnalyticsEvents.data_export_initiated, userId, {
      sizeBytes,
      recipeCount: recipes.length,
      mealLogCount: mealLog.length,
      weightCount: weightHistory.length,
      customFoodCount: customFoods.length,
      planCount: plans.length,
      shoppingCount: shopping.length,
      schemaVersion: SUPPR_EXPORT_SCHEMA_VERSION,
      platform: req.headers.get("user-agent")?.toLowerCase().includes("expo")
        ? "ios"
        : "web",
    });

    const filename = `suppr-export-${userId}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Prevent caches / proxies from holding a copy. The blob
        // contains every PII record we have on this user — the
        // browser saves it once and that's it.
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = (err as Error)?.message ?? "unknown";
    console.error("[export/me] failed:", message);
    return NextResponse.json(
      {
        ok: false,
        error: "export_failed",
        message,
      },
      { status: 500 },
    );
  }
}
