import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  barcode: string;
  displayName: string;
  source: "OpenFoodFacts" | "Community";
  externalId?: string | null;
  foodId?: string | null;
  createdBy?: string | null;
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function serverSupabase() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const b = body as Partial<Body>;
  const barcode = String(b.barcode ?? "").replace(/\D/g, "");
  const displayName = String(b.displayName ?? "").trim();
  const source = b.source;
  if (!barcode || barcode.length < 8) return NextResponse.json({ ok: false, error: "invalid_barcode" }, { status: 400 });
  if (!displayName) return NextResponse.json({ ok: false, error: "missing_display_name" }, { status: 400 });
  if (source !== "OpenFoodFacts" && source !== "Community") {
    return NextResponse.json({ ok: false, error: "invalid_source" }, { status: 400 });
  }

  const sb = serverSupabase();

  // Create or reuse a canonical food row
  let foodId = typeof b.foodId === "string" && b.foodId ? b.foodId : null;
  if (!foodId) {
    const { data: foodRow, error: foodErr } = await sb
      .from("foods")
      .insert({ display_name: displayName, brand: null, is_verified: false })
      .select("id")
      .single();
    if (foodErr || !foodRow) {
      return NextResponse.json({ ok: false, error: "food_create_failed", message: foodErr?.message }, { status: 500 });
    }
    foodId = foodRow.id as string;
  }

  const createdBy = typeof b.createdBy === "string" ? b.createdBy : null;
  const externalId = typeof b.externalId === "string" ? b.externalId : null;

  // Ensure a food_sources row exists when we have a source external id.
  // This allows future scans/imports to prefer the canonical food + source mapping.
  if (externalId) {
    const { error: fsErr } = await sb.from("food_sources").upsert(
      {
        food_id: foodId,
        source,
        external_id: externalId,
        source_url: source === "OpenFoodFacts" ? `https://world.openfoodfacts.org/product/${externalId}` : null,
        confidence: null,
      },
      { onConflict: "source,external_id" },
    );
    if (fsErr) {
      return NextResponse.json({ ok: false, error: "food_source_upsert_failed", message: fsErr.message }, { status: 500 });
    }
  }

  const { error: upErr } = await sb.from("barcode_mappings").upsert(
    {
      barcode,
      food_id: foodId,
      source,
      external_id: externalId,
      display_name: displayName,
      created_by: createdBy,
      is_verified: false,
    },
    { onConflict: "barcode" },
  );

  if (upErr) {
    return NextResponse.json({ ok: false, error: "upsert_failed", message: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, barcode, foodId });
}

