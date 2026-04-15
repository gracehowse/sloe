import type { User } from "@supabase/supabase-js";

/** Whole years since `dob` (ISO `YYYY-MM-DD`). */
export function ageFromIsoDateString(dob: string | null | undefined): number | null {
  if (!dob || typeof dob !== "string") return null;
  const d = new Date(`${dob.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  if (age < 3 || age > 120) return null;
  return age;
}

/** Best-effort display name from OAuth / email when `profiles.display_name` is empty. */
export function displayNameFromAuthUser(user: User | null | undefined): string {
  if (!user) return "";
  const m = user.user_metadata as Record<string, unknown>;
  const candidates = [m.full_name, m.name, m.preferred_username, m.display_name, m.user_name];
  for (const x of candidates) {
    if (typeof x === "string" && x.trim()) return x.trim();
  }
  const email = user.email;
  if (email && email.includes("@")) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return "";
}
