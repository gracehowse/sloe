/**
 * Write the current IANA timezone for a signed-in user into
 * `profiles.tz_iana`. The weekly recap push cron reads this column so
 * the push lands at 18:00 local time instead of 18:00 UTC
 * (see docs/decisions/2026-04-20-weekly-recap-tz-aware-fanout.md).
 *
 * Pure-ish: takes a Supabase client + userId and does a single
 * `profiles.update(...)`. Failure is swallowed with a warn — the
 * worst case is the user gets the push at 18:00 UTC for another
 * week until we read their tz on next login.
 *
 * The helper is invoked from:
 *   - web `AuthSessionContext.tsx` on initial session + auth state change
 *   - mobile `context/auth.tsx` on initial session + auth state change + app foreground
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` returns the IANA
 * Olson name (e.g. "Europe/London", "America/Cayman", "Asia/Singapore").
 * Available in all modern browsers and on React Native with the
 * bundled Hermes / JSC Intl.
 */

// Minimal supabase surface we depend on. Declared structurally so the
// helper doesn't need to import from `@supabase/supabase-js` (avoids a
// version-pin coupling between web + mobile variants of the client).
// `eq(...)` returns a thenable (`PostgrestFilterBuilder`) — we type it
// as a PromiseLike so both native Promises and the builder work.
type SupabaseClientLike = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export function resolveCurrentIanaTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === "string" && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}

export async function syncProfileTimezone(
  supabase: SupabaseClientLike,
  userId: string,
): Promise<{ ok: boolean; tz: string | null }> {
  const tz = resolveCurrentIanaTimezone();
  if (!tz) return { ok: false, tz: null };

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ tz_iana: tz })
      .eq("id", userId);
    if (error) {
      // Most likely cause pre-migration: "column tz_iana does not
      // exist". Harmless — the cron falls back to the pre-migration
      // UTC behaviour for users with null tz. Log at warn so real
      // RLS / network issues are still surfaced.
      if (typeof console !== "undefined") {
        console.warn("[tzSync] profiles.tz_iana update failed:", error.message);
      }
      return { ok: false, tz };
    }
    return { ok: true, tz };
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[tzSync] profiles.tz_iana update threw:", err);
    }
    return { ok: false, tz };
  }
}
