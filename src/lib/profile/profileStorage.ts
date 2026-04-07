import type { UserProfile } from "../../types/profile.ts";

const KEY = "platemate-profile-v1";

export function loadLocalProfile(expectedUserId?: string | null): UserProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (expectedUserId && parsed?.id && parsed.id !== expectedUserId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalProfile(profile: UserProfile): void {
  localStorage.setItem(KEY, JSON.stringify(profile));
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

