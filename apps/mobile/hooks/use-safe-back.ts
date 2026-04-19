import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";

import { safeBack } from "@/lib/safeBack";

/**
 * Prefer `router.back()` when the stack has history; otherwise `replace` so the control
 * never no-ops (avoids "dead" back when the stack was reset or the screen was cold-opened).
 *
 * Delegates to the pure `safeBack` helper in `lib/safeBack.ts` so non-hook
 * callers (e.g. `headerLeft` overrides set via `navigation.setOptions`)
 * share the same decision logic.
 */
export function useSafeBack(fallback: Href = "/(tabs)"): () => void {
  const router = useRouter();
  const navigation = useNavigation();
  return useCallback(() => {
    // `navigation.canGoBack()` covers the react-navigation tree; expo-router's
    // `router.canGoBack()` covers the URL/history stack. Either returning `true`
    // means a real back target exists — trust the union so we don't fall through
    // to the fallback when the native header could have gone back fine.
    const navBackable = typeof navigation.canGoBack === "function" && navigation.canGoBack();
    if (navBackable) {
      router.back();
      return;
    }
    safeBack(router, fallback);
  }, [router, navigation, fallback]);
}
