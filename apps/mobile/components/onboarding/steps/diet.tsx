import * as React from "react";
import { withAlpha, Radius, Spacing } from "@/constants/theme";
import { Pressable, Text, View } from "react-native";
import {
  Cookie,
  Fish,
  Flame,
  Flower2,
  Gem,
  Leaf,
  type LucideIcon,
  Moon,
  Star,
  Sun,
  UtensilsCrossed,
} from "lucide-react-native";
import { OptionCard } from "@/components/OptionCard";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

const DIETS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: "anything", title: "Anything goes", icon: UtensilsCrossed },
  { id: "vegetarian", title: "Vegetarian", icon: Leaf },
  { id: "vegan", title: "Vegan", icon: Cookie },
  { id: "pescatarian", title: "Pescatarian", icon: Fish },
  { id: "keto", title: "Keto / low-carb", icon: Flame },
  { id: "mediterranean", title: "Mediterranean", icon: Sun },
  { id: "halal", title: "Halal", icon: Moon },
  { id: "kosher", title: "Kosher", icon: Star },
  { id: "jain", title: "Jain", icon: Gem },
  { id: "hindu-veg", title: "Hindu vegetarian", icon: Flower2 },
];

// T12 (2026-04-24) — 14 EU FIC / UK FSA regulated allergens. Mirrors
// the web onboarding diet step (parity required). Source of truth:
// src/constants/regulatedAllergens.ts.
const ALLERGIES = [
  "Peanuts",
  "Tree nuts",
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Soy",
  "Wheat",
  "Sesame",
  "Mustard",
  "Celery",
  "Sulfites",
  "Lupin",
  "Gluten",
];

export function MobileDietStep() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();
  // Secondary accent (Frost flag → damson, else clay) for the selected diet
  // icon tints and the selected allergy chips. The diet cards' chrome flips via
  // `OptionCard`'s own `useAccent`; the "Allergies" overline keeps `textTertiary`.
  const accent = useAccent();
  const toggleAllergy = (a: string) =>
    set((prev) => ({
      allergies: prev.allergies.includes(a)
        ? prev.allergies.filter((x) => x !== a)
        : [...prev.allergies, a],
    }));
  const toggleDiet = (id: string) => {
    if (id === "anything") {
      set((prev) => ({
        diet: prev.diet.includes("anything") ? [] : ["anything"],
      }));
      return;
    }
    set((prev) => {
      const cleared = prev.diet.filter((x) => x !== "anything");
      return {
        diet: cleared.includes(id)
          ? cleared.filter((x) => x !== id)
          : [...cleared, id],
      };
    });
  };

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Any dietary preferences?"
        subtitle="We'll filter recipes and macro suggestions. Optional — skip if none apply."
      />

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}
      >
        {DIETS.map((d) => {
          const selected = state.diet.includes(d.id);
          const Icon = d.icon;
          return (
            <View
              key={d.id}
              style={{ width: "48%", maxWidth: "48%" }}
            >
              <OptionCard
                compact
                selected={selected}
                onPress={() => toggleDiet(d.id)}
                icon={
                  <Icon
                    size={17}
                    color={selected ? accent.primaryLight : colors.icon}
                  />
                }
                title={d.title}
                trailing={null}
              />
            </View>
          );
        })}
      </View>

      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 1,
          color: colors.textTertiary,
          marginBottom: Spacing.sm,
        }}
      >
        Allergies
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ALLERGIES.map((a) => {
          const on = state.allergies.includes(a);
          return (
            <Pressable
              key={a}
              onPress={() => toggleAllergy(a)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => ({
                paddingHorizontal: Spacing.dense,
                paddingVertical: 8,
                borderRadius: Radius.full,
                backgroundColor: on ? withAlpha(accent.primary, 0x26) : colors.card,
                borderWidth: 1,
                borderColor: on ? accent.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: on ? accent.primaryLight : colors.text,
                }}
              >
                {a}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </MobileStepBody>
  );
}
