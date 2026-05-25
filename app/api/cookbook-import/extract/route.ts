import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { extractPdfText } from "@/lib/planning/planImport/extractPdfText";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** PDF text extraction for cookbook import (shared pipeline with plan-import). */
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

  const limited = await rateLimit({
    keyPrefix: "api:cookbook-import-extract",
    userId,
    limit: 10,
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

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
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
          message:
            "Could not read enough text from this PDF. Export a searchable PDF from your scanner app, then try again.",
        },
        { status: 422 },
      );
    }
    captureRouteError(err, "/api/cookbook-import/extract", { stage: "pdf", fileName: file.name });
    return NextResponse.json(
      { ok: false, error: "pdf_extract_failed", message: "Could not read this PDF." },
      { status: 422 },
    );
  }
}
