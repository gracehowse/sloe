import { NextResponse } from "next/server";
import { AiBudgetExceededError, callAiVision } from "@/lib/server/aiProvider";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { normalizeImageForAi } from "@/lib/server/normalizeImageForAi";
import { extractPdfText } from "@/lib/planning/planImport/extractPdfText";
import { buildPlanImportImageExtractPrompt } from "@/lib/planning/planImport/extractPlanImportImagePrompt";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_LEN = 64_000;

// ENG-1487 finding #2 (2026-07-10): the image branch below is a Sonnet
// vision call at maxTokens 8000 (~20p/call per the red-team's estimate) —
// roughly 10x the cost class of a photo-log Haiku call — but this route had
// no tier gate at all, so a farmed free account could hit the flat 30/day
// cap for ~£6/account/day. The free allowance is set tighter than
// photo-log's 5/week (FREE_PHOTO_LOG_WEEKLY_LIMIT) to keep per-account
// free-tier vision cost roughly comparable across features despite the
// higher per-call price. Scoped to the image path only — the PDF path
// above never calls the AI vision budget, so it isn't gated by tier.
const FREE_IMAGE_EXTRACT_WEEKLY_LIMIT = 3;
const FREE_IMAGE_EXTRACT_WINDOW_MS = 7 * 24 * 60 * 60_000;

type ExtractSource = "pdf" | "image";

function isExtractSource(v: string | null): v is ExtractSource {
  return v === "pdf" || v === "image";
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  if (await isServerFeatureEnabled("kill_plan_import")) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Plan import is temporarily unavailable. Try again shortly.",
        retryAfterSec: 300,
      },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    keyPrefix: "api:plan-import-extract",
    userId,
    limit: 30,
    windowMs: 24 * 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const sourceRaw = form.get("source");
  const source = typeof sourceRaw === "string" ? sourceRaw : null;
  if (!isExtractSource(source)) {
    return NextResponse.json({ ok: false, error: "invalid_source" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  if (source === "pdf") {
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "invalid_pdf_type" }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { ok: false, error: "file_too_large", maxBytes: MAX_PDF_BYTES },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const text = await extractPdfText(buffer);
      return NextResponse.json({ ok: true, source: "pdf", text, fileName: file.name });
    } catch (err) {
      const code = err instanceof Error ? err.message : "pdf_extract_failed";
      if (code === "pdf_text_too_short") {
        return NextResponse.json(
          {
            ok: false,
            error: code,
            message: "Could not read enough text from this PDF. Try the full program file or paste instead.",
          },
          { status: 422 },
        );
      }
      captureRouteError(err, "/api/plan-import/extract", { stage: "pdf", fileName: file.name });
      return NextResponse.json(
        { ok: false, error: "pdf_extract_failed", message: "Could not read this PDF. Try paste instead." },
        { status: 422 },
      );
    }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", maxBytes: MAX_IMAGE_BYTES },
      { status: 413 },
    );
  }

  // ENG-1487 finding #2: tier gate on the image (vision-call) path only —
  // see FREE_IMAGE_EXTRACT_WEEKLY_LIMIT above for why this is separate from,
  // and tighter than, the flat per-request rateLimit already applied above.
  const tier = await getUserTier(userId);
  if (tier !== "pro") {
    const freeLimited = await rateLimit({
      keyPrefix: "api:plan-import-extract:image:free-quota",
      userId,
      limit: FREE_IMAGE_EXTRACT_WEEKLY_LIMIT,
      windowMs: FREE_IMAGE_EXTRACT_WINDOW_MS,
    });
    if (!freeLimited.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "upgrade_required",
          message:
            "You've used all your free plan-photo imports this week. Pro unlocks more imports a day.",
          freeQuotaRemaining: 0,
        },
        { status: 403 },
      );
    }
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let normalized;
  try {
    normalized = await normalizeImageForAi(rawBuffer);
  } catch (err) {
    captureRouteError(err, "/api/plan-import/extract", { stage: "normalize", fileName: file.name });
    return NextResponse.json({ ok: false, error: "invalid_image" }, { status: 400 });
  }

  let aiResult;
  try {
    const dataUrl = `data:${normalized.mediaType};base64,${normalized.buffer.toString("base64")}`;
    aiResult = await callAiVision({
      callSite: "plan-import-extract-image",
      userId,
      systemPrompt: buildPlanImportImageExtractPrompt(),
      userText: "Transcribe all meal-plan text from this image.",
      imageDataUrl: dataUrl,
      maxTokens: 8000,
      temperature: 0.1,
    });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        {
          ok: false,
          error: "ai_capacity_reached",
          message: "AI is temporarily at capacity. Try again in a few hours.",
          retryAfterSec: err.retryAfterSec,
        },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSec) } },
      );
    }
    captureRouteError(err, "/api/plan-import/extract", { stage: "vision" });
    throw err;
  }

  if (!aiResult.ok) {
    return NextResponse.json(
      { ok: false, error: aiResult.error, message: aiResult.message },
      { status: aiResult.status },
    );
  }

  const text = aiResult.text.trim().slice(0, MAX_TEXT_LEN);
  if (text.length < 80) {
    return NextResponse.json(
      {
        ok: false,
        error: "image_text_too_short",
        message: "Could not read enough text from this photo. Try a clearer shot or paste instead.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, source: "image", text, fileName: file.name });
}
