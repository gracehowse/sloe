import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { Neon, Spacing, Radius } from "@/constants/theme";

type Extra = { platemateApiUrl?: string };
function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.platemateApiUrl ?? "").replace(/\/$/, "");
}

type ImportState = "checking" | "importing" | "success" | "error" | "no_url";

export default function ImportSharedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const [state, setState] = useState<ImportState>("checking");
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = apiBase();

  useEffect(() => {
    (async () => {
      // Check URL param first (from deep link), then clipboard (from share extension)
      let url = params.url ?? null;

      if (!url) {
        try {
          const clip = await Clipboard.getStringAsync();
          if (clip && /^https?:\/\//i.test(clip.trim())) {
            // Check if it's a recipe-like URL (social or recipe site)
            const isRecipeUrl =
              /instagram\.com|tiktok\.com|bbcgoodfood\.com|allrecipes\.com|pinterest\.com/i.test(clip);
            if (isRecipeUrl) {
              url = clip.trim();
            }
          }
        } catch {
          // Clipboard access denied
        }
      }

      if (!url) {
        setState("no_url");
        return;
      }

      if (!base) {
        setState("error");
        setError("API not configured. Set platemateApiUrl in app config.");
        return;
      }

      setState("importing");

      try {
        const res = await fetch(`${base}/api/recipe-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          recipe?: { title?: string };
          message?: string;
        };

        if (!data.ok || !data.recipe) {
          setState("error");
          setError(data.message ?? "Could not extract a recipe from this link.");
          return;
        }

        setTitle(data.recipe.title ?? "Imported recipe");
        setState("success");

        // Clear clipboard so we don't re-import next time
        await Clipboard.setStringAsync("");
      } catch {
        setState("error");
        setError("Network error. Check your connection.");
      }
    })();
  }, [params.url, base]);

  return (
    <View style={styles.container}>
      {state === "checking" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Neon.purple} />
          <Text style={styles.heading}>Checking for recipe...</Text>
        </View>
      )}

      {state === "importing" && (
        <View style={styles.center}>
          <View style={styles.brandCircle}>
            <Text style={styles.brandLetter}>P</Text>
          </View>
          <ActivityIndicator size="large" color={Neon.purple} style={{ marginTop: Spacing.xl }} />
          <Text style={styles.heading}>Importing recipe...</Text>
          <Text style={styles.subtext}>Extracting ingredients and instructions</Text>
        </View>
      )}

      {state === "success" && (
        <View style={styles.center}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.subtext}>Recipe imported successfully</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace("/(tabs)/library")}
          >
            <Text style={styles.primaryBtnText}>View in Library</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.secondaryBtnText}>Back to Discover</Text>
          </Pressable>
        </View>
      )}

      {state === "error" && (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.heading}>Import failed</Text>
          <Text style={styles.subtext}>{error}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      )}

      {state === "no_url" && (
        <View style={styles.center}>
          <View style={styles.brandCircle}>
            <Text style={styles.brandLetter}>P</Text>
          </View>
          <Text style={styles.heading}>No recipe link found</Text>
          <Text style={styles.subtext}>
            Share a recipe from Instagram or TikTok using the share button, then open Platemate.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.primaryBtnText}>Go to Discover</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xxl,
  },
  center: { alignItems: "center", gap: Spacing.md },
  brandCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Neon.purple,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  brandLetter: { color: "#fff", fontSize: 28, fontWeight: "800" },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
  },
  subtext: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  successIcon: {
    fontSize: 48,
    color: Neon.green,
    fontWeight: "700",
  },
  errorIcon: {
    fontSize: 48,
    color: Neon.red,
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: Neon.purple,
    borderRadius: Radius.md,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: "#94a3b8", fontWeight: "500", fontSize: 14 },
});
