export type RecipeClaimStatus = "pending" | "verified" | "rejected" | "withdrawn";
export type RecipeClaimVerificationMethod = "oauth_handle" | "bio_code" | "dns_meta";

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

export function canShowOfficialVersion(input: OfficialMatchInput): boolean {
  const sourceUrl = (input.sourceUrl ?? "").trim();
  return sourceUrl.length > 0 && input.published !== true && input.contentOrigin !== "claimed";
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
