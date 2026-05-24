import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Elevation, Radius, Type } from "@/constants/theme";

interface DiscoverHeroCardProps {
  recipe: {
    title: string;
    imageUrl: string | null | undefined;
    cuisine?: string | null;
    kcalPerPortion: number;
    proteinG: number;
  };
  onPress: () => void;
}

/**
 * Full-width editorial hero card — large image with gradient scrim and
 * confident typography overlay. Inspired by Mela's recipe presentation.
 * Designed as a "scroll stopper" at the top of the Discover feed.
 */
export function DiscoverHeroCard({ recipe, onPress }: DiscoverHeroCardProps) {
  const trimmed = (recipe.imageUrl ?? "").trim();
  const hasImage = trimmed.length > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        Elevation.card,
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      {hasImage ? (
        <Image
          source={{ uri: trimmed }}
          style={styles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      {/* Gradient scrim — layered views simulating a bottom gradient */}
      <View style={styles.scrimContainer} pointerEvents="none">
        <View style={styles.scrimTop} />
        <View style={styles.scrimMiddle} />
        <View style={styles.scrimBottom} />
      </View>

      {/* Text overlay */}
      <View style={styles.textOverlay}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.title}
        </Text>

        <View style={styles.metaRow}>
          {recipe.cuisine ? (
            <View style={styles.cuisinePill}>
              <Text style={styles.cuisineText}>{recipe.cuisine}</Text>
            </View>
          ) : null}
          <Text style={styles.macroText}>
            {Math.round(recipe.kcalPerPortion)} kcal · {Math.round(recipe.proteinG)}g protein
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: "hidden",
    height: 280,
    backgroundColor: "#1c1916",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    backgroundColor: "#2a2520",
  },
  scrimContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  scrimTop: {
    flex: 1,
  },
  scrimMiddle: {
    height: 60,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  scrimBottom: {
    height: 80,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  textOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    ...Type.serifDisplay,
    color: "#ffffff",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cuisinePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  cuisineText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: Type.caption.fontWeight,
    color: "#ffffff",
  },
  macroText: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: Type.caption.fontWeight,
    color: "rgba(255,255,255,0.8)",
  },
});
