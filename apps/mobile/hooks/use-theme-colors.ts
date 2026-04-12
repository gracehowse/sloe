import { useTheme } from "@/context/theme";
import { Colors } from "@/constants/theme";

export type ThemeColors = typeof Colors.dark;

export function useThemeColors(): ThemeColors {
  const { colors } = useTheme();
  return colors;
}
