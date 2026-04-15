import { normalizeMacroTargets, type UserProfile } from "../../types/profile.ts";

const KEY = "suppr-profile-v2";

const LEGACY_KEY = "suppr-profile-v1";

export function loadLocalProfile(expectedUserId?: string | null): UserProfile | null {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile & { preferActivityAdjustedCalories?: boolean };
    if (expectedUserId && parsed?.id && parsed.id !== expectedUserId) {
      return null;
    }
    if (parsed.preferActivityAdjustedCalories === undefined) {
      parsed.preferActivityAdjustedCalories = false;
    }
    if (parsed.targets) {
      parsed.targets = normalizeMacroTargets(parsed.targets);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalProfile(profile: UserProfile): void {
  const normalized: UserProfile = {
    ...profile,
    preferActivityAdjustedCalories: profile.preferActivityAdjustedCalories ?? false,
    targets: profile.targets ? normalizeMacroTargets(profile.targets) : null,
  };
  localStorage.setItem(KEY, JSON.stringify(normalized));
}

export function clearLocalProfile(): void {
  localStorage.removeItem(KEY);
}

export function isProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.targets?.calories &&
      profile.targets?.protein &&
      profile.targets?.carbs &&
      profile.targets?.fat &&
      profile.age &&
      profile.heightCm &&
      profile.weightKg &&
      profile.sex &&
      profile.activityLevel &&
      profile.goal,
  );
}

