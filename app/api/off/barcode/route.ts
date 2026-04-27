import { NextResponse } from "next/server";
import { fetchProductByBarcode } from "@/lib/openFoodFacts/fetchProductByBarcode";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasSupabaseServiceConfig, ServerEnv } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";

function serverSupabase() {
  return createClient(
    process.env[ServerEnv.NEXT_PUBLIC_SUPABASE_URL]!,
    process.env[ServerEnv.SUPABASE_SERVICE_ROLE_KEY]!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // P0-6 (2026-04-25): per-user scoping.
  const rl = await rateLimit({ keyPrefix: "api:off-barcode", userId, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").trim();
  if (!code) return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });

  const cleaned = code.replace(/\D/g, "");

  // Prefer any stored correction mapping for this barcode (remember prior match).
  let preferredName: string | null = null;
  let preferredExternalId: string | null = null;
  try {
    if (hasSupabaseServiceConfig()) {
      const sb = serverSupabase();
      const { data: mapping } = await sb
        .from("barcode_mappings")
        .select("display_name, food_id, external_id, source")
        .eq("barcode", cleaned)
        .maybeSingle();

      if (mapping) {
        preferredName = (mapping.display_name as string) ?? null;
        preferredExternalId = (mapping.external_id as string) ?? null;

        const foodId = mapping.food_id as string | null;
        if (!preferredExternalId && foodId) {
          const { data: srcRow } = await sb
            .from("food_sources")
            .select("external_id")
            .eq("food_id", foodId)
            .eq("source", "OpenFoodFacts")
            .maybeSingle();
          preferredExternalId = (srcRow?.external_id as string) ?? null;
        }
      }
    }
  } catch {
    // Ignore mapping lookup failures; fall back to OFF directly.
  }

  const lookupCode = (preferredExternalId ?? cleaned).trim();
  const r = await fetchProductByBarcode(lookupCode);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error, message: r.message }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    product: preferredName ? { ...r.product, name: preferredName } : r.product,
    preferred: preferredName
      ? { source: "barcode_mappings", displayName: preferredName, externalId: preferredExternalId ?? lookupCode }
      : null,
  });
}

