import { useLayoutEffect, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

type RecipeRow = {
  title: string;
  description: string | null;
  servings: number | null;
  meal_type: string | null;
  image_url: string | null;
  published: boolean | null;
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const recipeId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeRow | null>(null);

  useEffect(() => {
    if (!recipeId) {
      setError("Missing recipe.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from("recipes")
        .select("title, description, servings, meal_type, image_url, published")
        .eq("id", recipeId)
        .maybeSingle();
      if (cancelled) return;
      if (qErr || !data) {
        setError("Couldn’t load this recipe.");
        setRecipe(null);
      } else {
        setRecipe(data as RecipeRow);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  useLayoutEffect(() => {
    const t = recipe?.title?.trim();
    if (t) navigation.setOptions({ title: t });
  }, [recipe?.title, navigation]);

  return (
    <ThemedView style={styles.screen}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        ) : error || !recipe ? (
          <View style={styles.centered}>
            <ThemedText style={styles.err}>{error ?? "Recipe not found."}</ThemedText>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ThemedText type="defaultSemiBold">Go back</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {recipe.image_url ? (
              <Image source={{ uri: recipe.image_url }} style={styles.hero} resizeMode="cover" />
            ) : null}
            <ThemedText type="title" style={styles.title}>
              {recipe.title}
            </ThemedText>
            {recipe.meal_type ? (
              <ThemedText style={styles.meta}>{recipe.meal_type}</ThemedText>
            ) : null}
            {recipe.servings != null ? (
              <ThemedText style={styles.meta}>Serves {recipe.servings}</ThemedText>
            ) : null}
            {recipe.description ? <ThemedText style={styles.body}>{recipe.description}</ThemedText> : null}
            {!recipe.published ? (
              <ThemedText style={styles.note}>This recipe isn’t public anymore.</ThemedText>
            ) : null}
          </ScrollView>
        )}
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  scroll: { paddingBottom: 32 },
  hero: { width: "100%", height: 200, backgroundColor: "#e2e8f0" },
  title: { marginTop: 16, paddingHorizontal: 16 },
  meta: { opacity: 0.75, marginTop: 4, paddingHorizontal: 16 },
  body: { marginTop: 12, paddingHorizontal: 16, lineHeight: 22 },
  note: { marginTop: 16, paddingHorizontal: 16, opacity: 0.8, fontStyle: "italic" },
  err: { color: "#b91c1c", textAlign: "center" },
  backBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1" },
});
