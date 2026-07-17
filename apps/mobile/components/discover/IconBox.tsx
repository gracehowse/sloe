import { View } from "react-native";
import type { ReactNode } from "react";
import { Accent } from "@/constants/theme";

/** ENG-1521 — the box tint is the icon hue's FAMILY `*Soft` token (sanctioned
 *  Soft step), replacing the old ad-hoc `color + "18"` alpha-concat. Keyed by
 *  the base Accent hue so every existing `color=` call site resolves without
 *  an API change; unknown hues fall back to `primarySoft` (the Discover
 *  cluster only passes Accent family hues). */
const SOFT_BY_HUE: Record<string, string> = {
  [Accent.primary]: Accent.primarySoft,
  [Accent.success]: Accent.successSoft,
  [Accent.warning]: Accent.warningSoft,
  [Accent.destructive]: Accent.destructiveSoft,
  [Accent.info]: Accent.infoSoft,
};

/** Rounded tinted icon box (Discover cluster + import cards) — prototype helper. */
export function IconBox({ color, size = 28, children }: { color: string; size?: number; children: ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SOFT_BY_HUE[color] ?? Accent.primarySoft, alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

export default IconBox;
