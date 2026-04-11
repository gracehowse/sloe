/**
 * Import Shared Recipe Screen
 *
 * Opened when the iOS Share Extension sends a URL via platemate://import-shared.
 * Reads the shared URL/caption/image from App Group UserDefaults (via native module)
 * and calls the recipe import API.
 *
 * For now on web/dev: reads from URL params as fallback.
 */

import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type ImportState = "loading" | "success" | "error";

export default function ImportSharedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const [state, setState] = useState<ImportState>("loading");
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sharedUrl = params.url ?? null;

    if (!sharedUrl) {
      // On iOS, the Share Extension saves the URL to App Group UserDefaults.
      // A native module bridge would read it here. For now, show an error
      // if no URL is provided via deep link params.
      setState("error");
      setError("No recipe URL received. Try sharing again from Instagram or TikTok.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/recipe-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sharedUrl }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          recipe?: { title?: string; ingredients?: string[]; instructions?: string[] };
          message?: string;
          source?: string;
        };

        if (!data.ok || !data.recipe) {
          setState("error");
          setError(data.message ?? "Could not extract a recipe from this link.");
          return;
        }

        setTitle(data.recipe.title ?? "Imported recipe");
        setState("success");

        // Navigate to the import review screen after a brief moment
        setTimeout(() => {
          router.replace({
            pathname: "/(tabs)/search",
            params: { imported: "true", title: data.recipe?.title ?? "" },
          });
        }, 2000);
      } catch (err) {
        setState("error");
        setError("Network error. Check your connection and try again.");
      }
    })();
  }, [params.url]);

  return (
    <View style={styles.container}>
      {state === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.heading}>Importing recipe...</Text>
          <Text style={styles.subtext}>Extracting ingredients and instructions</Text>
        </View>
      )}

      {state === "success" && (
        <View style={styles.center}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.subtext}>Recipe imported successfully</Text>
        </View>
      )}

      {state === "error" && (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.heading}>Import failed</Text>
          <Text style={styles.subtext}>{error}</Text>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  center: {
    alignItems: "center",
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  subtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
  },
  checkmark: {
    fontSize: 48,
    color: "#10b981",
    fontWeight: "700",
  },
  errorIcon: {
    fontSize: 48,
    color: "#ef4444",
    fontWeight: "700",
  },
  button: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#7c3aed",
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
