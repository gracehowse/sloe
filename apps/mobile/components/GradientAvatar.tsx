import * as React from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Accent } from "@/constants/theme";

/**
 * GradientAvatar — brand-gradient circular avatar used on the More tab.
 *
 * Matches the prototype's `linear-gradient(135deg, #4c6ce0, #e04888)`
 * (prototype `screens-mobile.jsx:740`). Per `docs/ux/brand-guidelines.md`
 * and `.claude/agents/design-system-enforcer.md`, the brand gradient is
 * explicitly sanctioned for the avatar chip — distinct from core product
 * UI which stays on flat colour.
 *
 * Web parity: `src/app/components/Profile.tsx` `avatarGradient`. Both
 * the 40×40 top-right button (line :523 context) and the 52×52 profile
 * card avatar (:557-562) use this component to guarantee one paint path.
 *
 * Implementation note: we don't depend on `expo-linear-gradient` — the
 * project already ships `react-native-svg`, which welcome.tsx uses for
 * the same reason. A 135deg gradient maps to x1=0,y1=0 → x2=1,y2=1 on a
 * square viewport.
 */
export function GradientAvatar({
  size,
  initial,
  fontSize,
  borderColor,
  gradientIdSuffix,
}: {
  size: number;
  initial: string;
  fontSize: number;
  borderColor?: string;
  gradientIdSuffix: string;
}) {
  const gradientId = `suppr-avatar-grad-${gradientIdSuffix}`;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: borderColor ? 1 : 0,
        borderColor,
      }}
      accessible={false}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={Accent.primary} />
            <Stop offset="100%" stopColor={Accent.magenta} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${gradientId})`} />
      </Svg>
      <Text style={{ fontSize, fontWeight: "700", color: "#fff" }}>
        {initial}
      </Text>
    </View>
  );
}
