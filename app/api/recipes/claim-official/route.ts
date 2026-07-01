import { NextResponse } from "next/server";

import { assertOrigin } from "@/lib/api/assertOrigin";
import {
  OFFICIAL_RECIPE_CLAIM_METHOD,
  claimVerificationIsVerified,
  officialMacrosClaimBlocker,
} from "@/lib/recipes/officialRecipeClaim";
import { rateLimit } from "@/lib/server/rateLimit";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import {
  createSupabaseServiceRoleClient,
  getUserIdFromRequest,
} from "@/lib/supabase/serverAnonClient";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ClaimOfficialBody = {
  recipeId?: unknown;
};

type RecipeLookupRow = {
  id: string;
  author_id: string | null;
  source_url: string | null;
  published: boolean | null;
  content_origin: string | null;
  is_verified: boolean | null;
  claimed_by: string | null;
};

type IngredientVerificationRow = {
  id: string;
  is_verified: boolean | null;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json({ ok: status >= 200 && status < 300, ...body }, { status });
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const userId = await getUserIdFromRequest(req);
  if (!userId) return json(401, { error: "unauthorized" });

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const rl = await rateLimit({
    keyPrefix: "api:recipes-claim-official",
    userId,
    limit: 10,
    windowMs: 3600_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: ClaimOfficialBody;
  try {
    body = (await req.json()) as ClaimOfficialBody;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const recipeId = typeof body.recipeId === "string" ? body.recipeId.trim() : "";
  if (!UUID_RE.test(recipeId)) {
    return json(400, { error: "invalid_recipe_id", field: "recipeId" });
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return json(503, { error: "server_misconfigured" });

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, author_id, source_url, published, content_origin, is_verified, claimed_by")
    .eq("id", recipeId)
    .maybeSingle();

  if (recipeError) return json(500, { error: "lookup_failed", message: recipeError.message });
  const row = recipe as RecipeLookupRow | null;
  if (!row || row.author_id !== userId) return json(404, { error: "not_found" });
  if (row.content_origin === "claimed" && row.claimed_by === userId) {
    return json(200, { recipeId, claimed: true, alreadyClaimed: true });
  }
  if (row.content_origin === "claimed") return json(409, { error: "already_claimed" });

  const { data: ingredients, error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .select("id, is_verified")
    .eq("recipe_id", recipeId);

  if (ingredientError) {
    return json(500, { error: "ingredients_lookup_failed", message: ingredientError.message });
  }

  const ingredientRows = (ingredients ?? []) as IngredientVerificationRow[];
  const blocker = officialMacrosClaimBlocker({
    isOwner: true,
    published: row.published,
    contentOrigin: row.content_origin,
    sourceUrl: row.source_url,
    ingredientCount: ingredientRows.length,
    verifiedIngredientCount: ingredientRows.filter((ingredient) => ingredient.is_verified === true).length,
  });
  if (blocker) return json(422, { error: blocker });

  const now = new Date().toISOString();
  const verification = {
    method: OFFICIAL_RECIPE_CLAIM_METHOD,
    source_url: row.source_url!.trim(),
    attestation: true,
    verified_at: now,
    evidence: {
      kind: "owner_macro_attestation",
      recipe_id: recipeId,
    },
  };
  if (!claimVerificationIsVerified(verification)) {
    return json(500, { error: "invalid_claim_payload" });
  }

  const { error: updateError } = await supabase
    .from("recipes")
    .update({
      is_verified: true,
      verified_source: "owner_confirmed",
      verified_at: now,
      verified_confidence: 1,
      content_origin: "claimed",
      claimed_by: userId,
      claimed_at: now,
      claim_verification: verification,
    })
    .eq("id", recipeId)
    .eq("author_id", userId);

  if (updateError) {
    return json(500, { error: "claim_failed", message: updateError.message });
  }

  const claimRow = {
    recipe_id: recipeId,
    claimant_id: userId,
    source_url: row.source_url!.trim(),
    status: "verified",
    verification,
    attested_at: now,
    verified_at: now,
    updated_at: now,
  };

  const { data: existingClaim, error: existingClaimError } = await supabase
    .from("recipe_claims")
    .select("id")
    .eq("recipe_id", recipeId)
    .eq("claimant_id", userId)
    .eq("status", "verified")
    .maybeSingle();

  if (existingClaimError) {
    return json(500, { error: "claim_audit_lookup_failed", message: existingClaimError.message });
  }

  if ((existingClaim as { id?: string } | null)?.id) {
    const { error } = await supabase
      .from("recipe_claims")
      .update(claimRow)
      .eq("id", (existingClaim as { id: string }).id);
    if (error) return json(500, { error: "claim_audit_failed", message: error.message });
  } else {
    const { error } = await supabase.from("recipe_claims").insert(claimRow);
    if (error && error.code === "23505") {
      const { error: retryError } = await supabase
        .from("recipe_claims")
        .update(claimRow)
        .eq("recipe_id", recipeId)
        .eq("claimant_id", userId)
        .eq("status", "verified");
      if (retryError) {
        return json(500, { error: "claim_audit_failed", message: retryError.message });
      }
    } else if (error) {
      return json(500, { error: "claim_audit_failed", message: error.message });
    }
  }

  return json(200, { recipeId, claimed: true });
}
