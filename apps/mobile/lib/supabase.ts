/**
 * Reads `supabaseUrl` and `supabaseAnonKey` from `app.json` → `expo.extra`.
 * For local dev: set those fields (or use EAS secrets / app.config that injects them).
 * `supprApiUrl` in app config is used by the tracker food search when configured.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = Constants.expoConfig?.extra as Extra | undefined;

export const supabase = createClient(extra?.supabaseUrl ?? "", extra?.supabaseAnonKey ?? "", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // ENG-1474: match the web browser client's PKCE flow. Email
    // confirmation / magic-link / password-reset links then carry a
    // `?code=` that the `suppr://auth-callback` deep-link handler
    // (`app/auth-callback.tsx`) exchanges via `exchangeCodeForSession`.
    // PKCE is the recommended flow for native deep links — the
    // code-verifier stops a link-interception attack completing the
    // exchange. `detectSessionInUrl` stays false: RN has no URL to
    // auto-detect from; the deep-link handler drives the exchange.
    flowType: "pkce",
    detectSessionInUrl: false,
  },
});

export function hasSupabaseConfig(): boolean {
  return Boolean(extra?.supabaseUrl?.trim() && extra?.supabaseAnonKey?.trim());
}
