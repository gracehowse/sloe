import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { importErrorResponse } from "@/lib/recipes/importErrorCopy";
import { parseCookbookFromText } from "@/lib/planning/planImport/parseCookbookFromText";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (await isServerFeatureEnabled("kill_plan_import")) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Cookbook import is temporarily unavailable. Try again shortly.",
        retryAfterSec: 300,
      },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(userId);
  if (tier === "free") {
    return NextResponse.json(importErrorResponse("pro_required"), { status: 403 });
  }

  const limited = await rateLimit({
    keyPrefix: "api:cookbook-import-parse",
    userId,
    limit: 3,
    windowMs: 24 * 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { text?: string; bookName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "missing_text" }, { status: 400 });
  }

  try {
    const result = await parseCookbookFromText({
      text,
      bookName: body.bookName,
      userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          message: result.message,
          retryAfterSec: result.retryAfterSec,
        },
        { status: result.status ?? 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      bookName: result.bookName,
      recipes: result.recipes,
      parseWarnings: result.parseWarnings,
      chunkCount: result.chunkCount,
      lowConfidenceCount: result.lowConfidenceCount,
    });
  } catch (err) {
    captureRouteError(err, "/api/cookbook-import/parse", { stage: "parse" });
    throw err;
  }
}
