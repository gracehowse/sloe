import type { UserTier } from "@/lib/supabase/serverAnonClient";

/** Hidden per-user abuse guard — not communicated in product copy (ENG-865). */
export const IMAGE_GEN_ABUSE_GUARD_DAILY = 25;

export type ImageGenRecipeState = {
  image_source?: string | null;
};

export type ImageGenRequestFlags = {
  regenerate?: boolean;
  remove?: boolean;
};

/** True when the request would replace an existing Sloe hero (Pro-gated). */
export function isRegenerateImageGenRequest(
  recipe: ImageGenRecipeState,
  flags: ImageGenRequestFlags,
): boolean {
  if (flags.remove) return false;
  if (flags.regenerate === true) return true;
  return recipe.image_source === "ai_generated";
}

/**
 * ENG-865 Option A — first base Sloe hero is free; regenerate / restyle
 * when a Sloe hero already exists requires Pro. Removal stays free.
 */
export function requiresProForImageGen(
  tier: UserTier,
  recipe: ImageGenRecipeState,
  flags: ImageGenRequestFlags,
): boolean {
  if (tier === "pro") return false;
  return isRegenerateImageGenRequest(recipe, flags);
}

export function imageGenAbuseGuardDailyLimit(): number {
  const raw = process.env.IMAGE_GEN_ABUSE_GUARD_DAILY?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : IMAGE_GEN_ABUSE_GUARD_DAILY;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : IMAGE_GEN_ABUSE_GUARD_DAILY;
}
