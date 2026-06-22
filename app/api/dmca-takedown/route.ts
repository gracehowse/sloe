/**
 * POST /api/dmca-takedown — accepts copyright takedown requests submitted
 * via the form on /dmca.
 *
 * Anonymous endpoint: the reporter does NOT need a Suppr account, and
 * generally won't have one — they're a creator (or rights agent) asking us
 * to remove a recipe imported from their public post. We accept anon
 * submissions, rate-limit by IP, and persist via the service-role client
 * (the `dmca_takedowns` table is service-role-only per its RLS policy).
 *
 * Validation is strict (length caps + URL parse) so noisy / malformed
 * submissions don't pollute reviewer triage. We always respond with a
 * stable shape so the form can render clear feedback.
 *
 * Network metadata (IP, User-Agent) is captured for abuse defence — a
 * spammed-takedown attack would otherwise be cheap to mount.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getTrustedClientIp } from "@/lib/server/clientIp";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import { assertOrigin } from "@/lib/api/assertOrigin";

type Payload = {
  reporterEmail?: unknown;
  originalPostUrl?: unknown;
  supprRecipeId?: unknown;
  description?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 200;
const MAX_URL_LEN = 2000;
const MAX_RECIPE_ID_LEN = 200;
const MAX_DESCRIPTION_LEN = 5000;

function badRequest(field: string, message: string) {
  return NextResponse.json(
    { ok: false, error: "invalid_input", field, message },
    { status: 400 },
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  // Read network metadata directly off the Request object so this route
  // works in vitest (where `next/headers` requires a request scope) and
  // matches how `rateLimit` extracts IP from headers internally.
  const h = req.headers;
  // IP-based rate limit only — the endpoint is anonymous on purpose.
  // Conservative budget (5 per hour per IP). Real takedown agents file
  // notices much less frequently than this.
  const rl = await rateLimit({
    keyPrefix: "api:dmca-takedown",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message:
          "Too many takedown submissions from this network. If your request is urgent, email dmca@getsloe.com instead.",
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

  const reporterEmail = typeof body.reporterEmail === "string" ? body.reporterEmail.trim() : "";
  const originalPostUrl = typeof body.originalPostUrl === "string" ? body.originalPostUrl.trim() : "";
  const supprRecipeId =
    typeof body.supprRecipeId === "string" && body.supprRecipeId.trim().length > 0
      ? body.supprRecipeId.trim()
      : null;
  const description =
    typeof body.description === "string" && body.description.trim().length > 0
      ? body.description.trim()
      : null;

  if (!reporterEmail) return badRequest("reporterEmail", "Email is required.");
  if (reporterEmail.length > MAX_EMAIL_LEN)
    return badRequest("reporterEmail", `Email must be ${MAX_EMAIL_LEN} characters or fewer.`);
  if (!EMAIL_RE.test(reporterEmail)) return badRequest("reporterEmail", "Enter a valid email address.");

  if (!originalPostUrl) return badRequest("originalPostUrl", "The URL of the original post is required.");
  if (originalPostUrl.length > MAX_URL_LEN)
    return badRequest("originalPostUrl", `URL must be ${MAX_URL_LEN} characters or fewer.`);
  if (!isHttpUrl(originalPostUrl)) return badRequest("originalPostUrl", "Enter a valid http(s) URL.");

  if (supprRecipeId && supprRecipeId.length > MAX_RECIPE_ID_LEN)
    return badRequest("supprRecipeId", `Recipe id / link must be ${MAX_RECIPE_ID_LEN} characters or fewer.`);

  if (description && description.length > MAX_DESCRIPTION_LEN)
    return badRequest("description", `Description must be ${MAX_DESCRIPTION_LEN} characters or fewer.`);

  const admin = getSupabaseAdminClient();
  if (!admin) {
    // The takedown channel is legally required to work even if the
    // service-role key is unavailable. Fail loudly so ops alerts fire,
    // and tell the reporter to email instead.
    console.error("[dmca-takedown] SUPABASE_SERVICE_ROLE_KEY missing — cannot persist submission");
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message:
          "We're temporarily unable to record submissions through the form. Please email dmca@getsloe.com directly.",
      },
      { status: 503 },
    );
  }

  const reporterIp = getTrustedClientIp(h);
  const reporterUserAgent = h.get("user-agent");

  const { error } = await admin.from("dmca_takedowns").insert({
    reporter_email: reporterEmail,
    original_post_url: originalPostUrl,
    suppr_recipe_id: supprRecipeId,
    description,
    reporter_ip: reporterIp,
    reporter_user_agent: reporterUserAgent,
  });

  if (error) {
    console.error("[dmca-takedown] insert failed:", error.message);
    return NextResponse.json(
      {
        ok: false,
        error: "persist_failed",
        message:
          "We couldn't record your submission. Please email dmca@getsloe.com so we can act on it directly.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Submission received. We'll review it and respond to the email you provided within 7 business days.",
  });
}
