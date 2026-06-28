import { NextResponse } from "next/server";

import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    recipeId?: string;
    method?: string;
    sourceUrl?: string;
  };

  if (!body.recipeId || !body.method || !body.sourceUrl) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_unavailable" }, { status: 503 });
  }
  const { error } = await admin.rpc("mark_recipe_macros_official", {
    p_recipe_id: body.recipeId,
    p_method: body.method,
    p_source_url: body.sourceUrl,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
