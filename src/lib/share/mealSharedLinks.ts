/**
 * ENG-1648 — "My shared links" management: shared types, status derivation,
 * and copy. Web + mobile import via `@suppr/shared/share/mealSharedLinks`.
 *
 * Listing reads `meal_shares` directly (RLS: `meal_shares_select_own`);
 * revocation goes through `revoke_meal_share` RPC in `mealShareClient.ts`.
 */

export type MealShareViewState = "active" | "expired" | "revoked";

/** Row shape from `meal_shares` SELECT (owner-scoped via RLS). */
export type MealShareRow = {
  id: string;
  token: string;
  title: string;
  mealSlot: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export const MEAL_SHARED_LINKS_SETTINGS_LABEL = "My shared links";

export const MEAL_SHARED_LINKS_SETTINGS_SUB =
  "See meal links you've sent and revoke any you no longer want active.";

export const MEAL_SHARED_LINKS_PRIVACY_COPY =
  "Shared links show meal contents only — never your targets or full diary. Links expire after 30 days unless you revoke them sooner.";

export const MEAL_SHARED_LINKS_OPEN_FLAG = "suppr.open_meal_shared_links";

export function mealShareViewState(
  row: Pick<MealShareRow, "revokedAt" | "expiresAt">,
  now: Date = new Date(),
): MealShareViewState {
  if (row.revokedAt) return "revoked";
  const expiresMs = Date.parse(row.expiresAt);
  if (Number.isFinite(expiresMs) && expiresMs <= now.getTime()) return "expired";
  return "active";
}

export function mealShareViewStateLabel(state: MealShareViewState): string {
  switch (state) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function mealSharedLinksCountLabel(count: number): string {
  if (count === 0) return "No shared meal links";
  if (count === 1) return "1 shared meal link";
  return `${count} shared meal links`;
}

/** Parse a Supabase row (snake_case wire) into the shared shape. */
export function parseMealShareRow(raw: unknown): MealShareRow | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const token = typeof r.token === "string" ? r.token : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const mealSlot = typeof r.meal_slot === "string" ? r.meal_slot : "";
  const createdAt = typeof r.created_at === "string" ? r.created_at : "";
  const expiresAt = typeof r.expires_at === "string" ? r.expires_at : "";
  const revokedAt =
    typeof r.revoked_at === "string" && r.revoked_at.trim() ? r.revoked_at : null;
  if (!id || !token || !title || !mealSlot || !createdAt || !expiresAt) return null;
  return { id, token, title, mealSlot, createdAt, expiresAt, revokedAt };
}

/** Short locale date for list rows — caller supplies `Intl` options for parity. */
export function formatMealShareDate(
  iso: string,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString(locale, options);
}
