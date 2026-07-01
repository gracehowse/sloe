export type RecipeClaimStatus = "pending" | "verified" | "rejected" | "withdrawn";
export type RecipeClaimVerificationMethod = "oauth_handle" | "bio_code" | "dns_meta";

export const OFFICIAL_RECIPE_CLAIM_FLAG = "official_recipe_claim_v1";
export const OFFICIAL_RECIPE_CLAIM_METHOD: RecipeClaimVerificationMethod = "bio_code";

export type ClaimVerificationPayload = {
  method: RecipeClaimVerificationMethod;
  verified_at: string;
  source_url: string;
  attestation: true;
  evidence?: Record<string, unknown>;
};

type OfficialMatchInput = {
  currentRecipeId: string;
  sourceUrl?: string | null;
  published?: boolean | null;
  contentOrigin?: string | null;
};

export type OfficialMacrosClaimInput = {
  isOwner: boolean;
  isCatalogRecipe?: boolean;
  published?: boolean | null;
  contentOrigin?: string | null;
  sourceUrl?: string | null;
  ingredientCount: number;
  verifiedIngredientCount: number;
};

export type OfficialMacrosClaimBlocker =
  | "not_owner"
  | "catalog_recipe"
  | "already_official"
  | "not_public"
  | "missing_source"
  | "no_ingredients"
  | "unverified_ingredients";

export const OFFICIAL_MACROS_CLAIM_BLOCKER_COPY: Record<OfficialMacrosClaimBlocker, string> = {
  not_owner: "Only the recipe owner can mark the macros official.",
  catalog_recipe: "Catalogue recipes are already managed by Sloe.",
  already_official: "This recipe is already marked official.",
  not_public: "Publish the recipe before marking its macros official.",
  missing_source: "Add the original source link before marking it official.",
  no_ingredients: "Add ingredients before marking the macros official.",
  unverified_ingredients: "Verify every ingredient before marking the macros official.",
};

export function canShowOfficialVersion(input: OfficialMatchInput): boolean {
  const sourceUrl = (input.sourceUrl ?? "").trim();
  return sourceUrl.length > 0 && input.published !== true && input.contentOrigin !== "claimed";
}

export function officialMacrosClaimBlocker(input: OfficialMacrosClaimInput): OfficialMacrosClaimBlocker | null {
  if (!input.isOwner) return "not_owner";
  if (input.isCatalogRecipe) return "catalog_recipe";
  if (input.contentOrigin === "claimed") return "already_official";
  if (input.published !== true) return "not_public";
  if (!(input.sourceUrl ?? "").trim()) return "missing_source";
  if (input.ingredientCount <= 0) return "no_ingredients";
  if (input.verifiedIngredientCount !== input.ingredientCount) return "unverified_ingredients";
  return null;
}

export function canClaimOfficialMacros(input: OfficialMacrosClaimInput): boolean {
  return officialMacrosClaimBlocker(input) == null;
}

export function isExactOfficialSourceMatch(importedSourceUrl: string | null | undefined, officialSourceUrl: string | null | undefined): boolean {
  const imported = (importedSourceUrl ?? "").trim();
  const official = (officialSourceUrl ?? "").trim();
  return imported.length > 0 && official.length > 0 && imported === official;
}

export function claimVerificationIsVerified(payload: unknown): payload is ClaimVerificationPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Partial<ClaimVerificationPayload>;
  return (
    (value.method === "oauth_handle" || value.method === "bio_code" || value.method === "dns_meta") &&
    typeof value.verified_at === "string" &&
    typeof value.source_url === "string" &&
    value.source_url.trim().length > 0 &&
    value.attestation === true
  );
}
