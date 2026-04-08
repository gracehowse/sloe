/**
 * Home route (`/`) profile completeness check after auth.
 * Keeps logic testable and avoids misrouting users on transient Supabase errors.
 */

export type ProfileGateRow = {
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  sex: string | null;
  activity_level: string | null;
  goal: string | null;
} | null;

export function isProfileRowComplete(profile: ProfileGateRow): boolean {
  if (!profile) return false;
  return Boolean(
    profile.target_calories &&
      profile.target_protein &&
      profile.target_carbs &&
      profile.target_fat &&
      profile.age &&
      profile.height_cm &&
      profile.weight_kg &&
      profile.sex &&
      profile.activity_level &&
      profile.goal,
  );
}

/** True when error likely means “retry” rather than “no profile row”. */
export function isTransientProfileFetchError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  if (!m) return false;
  return (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504")
  );
}

export function isMissingProfilesTableError(message: string | undefined): boolean {
  const msg = message ?? "";
  return (
    msg.includes("Could not find the table") ||
    msg.toLowerCase().includes("schema cache") ||
    msg.toLowerCase().includes("does not exist")
  );
}
