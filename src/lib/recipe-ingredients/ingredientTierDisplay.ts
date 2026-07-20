import type { IngredientVerificationTier } from "./ingredientVerificationStatus.ts";

// Ingredient tier → colour + label (F-120; ENG-1431: estimated is amber, not
// red — ENG-1296). Shared by the legacy tile grid and the ENG-1611 text rows.
export const ING_TIER_COLOR: Record<IngredientVerificationTier, string> = {
  verified: "var(--success)", partial: "var(--warning)",
  estimated: "var(--warning)", unverified: "var(--foreground-tertiary)",
};
export const ING_TIER_LABEL: Record<IngredientVerificationTier, string> = {
  verified: "Structured", partial: "Partial match",
  estimated: "Estimated", unverified: "Unverified",
};
