// Shared "Your name" save logic for the Settings field on both
// platforms (web `src/app/components/Settings.tsx`, mobile
// `apps/mobile/components/settings/SettingsBundleContent.tsx`).
//
// Why this lives here: the save path is identical across web + mobile —
// trim, write the auth user's `user_metadata.full_name`, treat empty as
// "clear the name". Keeping it in one place (per the no-duplication
// rule) means the persist shape can't drift between platforms, and it's
// unit-testable against a mocked client without rendering either screen.
//
// IMPORTANT: this writes the auth user's metadata via
// `supabase.auth.updateUser`, NOT a `profiles` column. The display name is
// read from `user_metadata` (the avatar initial + Profile identity), and
// writing entitlement-adjacent `profiles` columns client-side risks the
// tier-lockdown trigger (`feedback_persist_path_guardrails`). An
// empty/whitespace value is written as "" to clear the name.
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimal shape of the bits of the Supabase client this helper touches.
 *  Lets tests pass a tiny fake without constructing a full client. */
export interface AuthUpdateClientLike {
  auth: {
    updateUser: (attributes: {
      data: Record<string, unknown>;
    }) => Promise<{ error: { message: string } | null }>;
  };
}

export type SaveDisplayNameResult =
  | { ok: true; value: string; changed: boolean }
  | { ok: false; message: string };

/**
 * Persist the user's display name to `user_metadata.full_name`.
 *
 * - Trims `rawInput`. An empty/whitespace input clears the name (writes
 *   `""`), so the Today greeting falls back to "Good morning".
 * - No-ops (no network write) when the trimmed value already equals
 *   `currentName` (also trimmed) — returns `{ ok: true, changed: false }`.
 * - On a Supabase error returns `{ ok: false, message }` so the caller
 *   can surface it (alert / toast). Never throws for an auth error; a
 *   thrown/rejected client (network down) is caught and normalised.
 *
 * @param client    Supabase client (real or a minimal fake in tests).
 * @param rawInput  The text from the "Your name" field.
 * @param currentName The name currently stored (used for the no-op guard).
 */
export async function saveDisplayName(
  client: AuthUpdateClientLike | SupabaseClient,
  rawInput: string,
  currentName: string,
): Promise<SaveDisplayNameResult> {
  const trimmed = rawInput.trim();
  if (trimmed === currentName.trim()) {
    return { ok: true, value: trimmed, changed: false };
  }
  try {
    const { error } = await (client as AuthUpdateClientLike).auth.updateUser({
      data: { full_name: trimmed },
    });
    if (error) {
      return { ok: false, message: error.message || "Couldn't save your name" };
    }
    return { ok: true, value: trimmed, changed: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Couldn't save your name",
    };
  }
}
