import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";

/**
 * Prefer `router.back()` when the stack has history; otherwise `replace` so the control
 * never no-ops (avoids “dead” back when the stack was reset or the screen was cold-opened).
 */
export function useSafeBack(fallback: Href = "/(tabs)"): () => void {
  const router = useRouter();
  const navigation = useNavigation();
  return useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }, [router, navigation, fallback]);
}
