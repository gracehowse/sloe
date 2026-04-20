import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent } from "@/constants/theme";
import { OptionCard } from "@/components/OptionCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboardingV2 } from "../context";
import { MobileStepBody, MobileStepHeader } from "../scaffold";

const DIETS: { id: string; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "anything", title: "Anything goes", icon: "restaurant-outline" },
  { id: "vegetarian", title: "Vegetarian", icon: "leaf-outline" },
  { id: "vegan", title: "Vegan", icon: "nutrition-outline" },
  { id: "pescatarian", title: "Pescatarian", icon: "fish-outline" },
  { id: "keto", title: "Keto / low-carb", icon: "flame-outline" },
  { id: "mediterranean", title: "Mediterranean", icon: "sunny-outline" },
];

const ALLERGIES = ["Gluten", "Dairy", "Eggs", "Nuts", "Shellfish", "Soy"];

export function MobileDietStep() {
  const { state, set } = useOnboardingV2();
  const colors = useThemeColors();
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
        overline="Step 10 of 12"
        title="Any dietary preferences?"
        subtitle="We'll filter recipes and macro suggestions. Optional — skip if none apply."
      />

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}
      >
        {DIETS.map((d) => {
          const selected = state.diet.includes(d.id);
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
                  <Ionicons
                    name={d.icon}
                    size={17}
                    color={selected ? Accent.primaryLight : colors.icon}
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
          marginBottom: 10,
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
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: on ? Accent.primary + "26" : colors.card,
                borderWidth: 1,
                borderColor: on ? Accent.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: on ? Accent.primaryLight : colors.text,
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
