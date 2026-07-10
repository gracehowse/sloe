/**
 * `suppr://auth-callback` — completes a PKCE email round-trip (ENG-1474).
 *
 * GoTrue redirects email-confirmation / magic-link / password-reset links
 * for a PKCE-initiated request to this deep link with a `?code=…` (and an
 * optional `next` relative path). Expo Router maps `suppr://auth-callback`
 * → this route (the `_layout.tsx` share-forwarder returns `"ignore"` for it,
 * per `decideDeepLinkAction`), so the code + next arrive as search params.
 *
 * This mirrors web's `app/auth/callback/route.ts`: exchange the code for a
 * session, then route to a guarded `next` destination (open-redirect guard
 * `safeAuthRedirectPath`) — default `/(tabs)`, `/onboarding` honoured.
 * On a missing / failed code it forwards to `/login` with an error the
 * login screen surfaces via its existing `message` idiom.
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "@/lib/supabase";
import { safeAuthRedirectPath } from "@/lib/safeAuthRedirectPath";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Spacing, Type } from "@/constants/theme";

/** First value of an Expo Router search param (handles string | string[]). */
function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function AuthCallbackScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ code?: string | string[]; next?: string | string[] }>();
  const [failed, setFailed] = useState(false);
  // Guard against a double-exchange if the effect re-runs (Strict Mode /
  // re-render): exchangeCodeForSession consumes a single-use code.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const code = firstParam(params.code)?.trim();
    const next = firstParam(params.next);

    if (!code) {
      router.replace("/login?error=oauth");
      return;
    }

    void (async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace(
            `/login?error=oauth&error_description=${encodeURIComponent(error.message)}`,
          );
          return;
        }
        // Success — the auth context's onAuthStateChange picks up the new
        // session; route to the guarded destination.
        router.replace(safeAuthRedirectPath(next) as Parameters<typeof router.replace>[0]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sign-in link could not be completed.";
        setFailed(true);
        router.replace(`/login?error=oauth&error_description=${encodeURIComponent(msg)}`);
      }
    })();
  }, [params.code, params.next]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.tint} />
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        {failed ? "Finishing up…" : "Signing you in…"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  caption: {
    ...Type.body,
    textAlign: "center",
  },
});
