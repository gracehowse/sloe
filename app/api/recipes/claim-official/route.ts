import { NextResponse } from "next/server";

import {
  getAccessTokenFromRequest,
  createUserScopedClient,
} from "@/lib/supabase/serverAnonClient";

export async function POST(request: Request) {
  // The RPC's ownership check is `auth.uid()`, so it MUST run on a client that
  // carries the caller's JWT — not the service-role client (auth.uid() would be
  // NULL and the call would 400). Identity comes from the verified token only;
  // never from a caller-supplied user id (that would be an IDOR).
  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createUserScopedClient(accessToken);
  const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !userData?.user?.id) {
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

  const { error } = await supabase.rpc("mark_recipe_macros_official", {
    p_recipe_id: body.recipeId,
    p_method: body.method,
    p_source_url: body.sourceUrl,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
