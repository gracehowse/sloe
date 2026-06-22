/**
 * POST /api/recipe-report — accepts non-copyright recipe content reports
 * submitted via the per-recipe "Report an issue" sheet (ENG-1225 #19).
 *
 * Copyright claims go to /api/dmca-takedown instead; this is the durable,
 * logged queue for "incorrect nutrition", "inappropriate / unsafe", and
 * "other" — the mechanism the UK OSA / EU DSA expect once user-generated /
 * imported recipe content is live. Persists via the service-role client
 * (`recipe_reports` is service-role-only per its RLS policy).
 *
 * IP-rate-limited; network metadata captured for abuse defence.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import { assertOrigin } from "@/lib/api/assertOrigin";

type Payload = {
  recipeId?: unknown;
  reason?: unknown;
  description?: unknown;
};

const REASONS = new Set(["incorrect", "unsafe", "other"]);
const MAX_RECIPE_ID_LEN = 200;
const MAX_DESCRIPTION_LEN = 5000;
const SUPPORT_EMAIL = "support@getsloe.com";

function badRequest(field: string, message: string) {
  return NextResponse.json(
    { ok: false, error: "invalid_input", field, message },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const h = req.headers;
  // IP-based rate limit (10/hour/IP — a touch higher than DMCA since in-app
  // reports are cheaper/more frequent than formal takedown notices).
  const rl = await rateLimit({
    keyPrefix: "api:recipe-report",
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: `Too many reports from this network. If it's urgent, email ${SUPPORT_EMAIL}.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const recipeId =
    typeof body.recipeId === "string" ? body.recipeId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const description =
    typeof body.description === "string" && body.description.trim().length > 0
      ? body.description.trim()
      : null;

  if (!recipeId) return badRequest("recipeId", "A recipe is required.");
  if (recipeId.length > MAX_RECIPE_ID_LEN)
    return badRequest("recipeId", `Recipe id must be ${MAX_RECIPE_ID_LEN} characters or fewer.`);
  if (!REASONS.has(reason)) return badRequest("reason", "Pick a valid reason.");
  if (description && description.length > MAX_DESCRIPTION_LEN)
    return badRequest("description", `Description must be ${MAX_DESCRIPTION_LEN} characters or fewer.`);

  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.error("[recipe-report] SUPABASE_SERVICE_ROLE_KEY missing — cannot persist report");
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message: `We're temporarily unable to record reports. Please email ${SUPPORT_EMAIL} directly.`,
      },
      { status: 503 },
    );
  }

  const reporterIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const reporterUserAgent = h.get("user-agent");

  const { error } = await admin.from("recipe_reports").insert({
    suppr_recipe_id: recipeId,
    reason,
    description,
    reporter_ip: reporterIp,
    reporter_user_agent: reporterUserAgent,
  });

  if (error) {
    console.error("[recipe-report] insert failed:", error.message);
    return NextResponse.json(
      {
        ok: false,
        error: "persist_failed",
        message: `We couldn't record your report. Please email ${SUPPORT_EMAIL} so we can act on it.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Report received. We review reports within 5 business days.",
  });
}
