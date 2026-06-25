import { View } from "react-native";
import type { ReactNode } from "react";

/** Rounded tinted icon box (Discover cluster + import cards) — prototype helper. */
export function IconBox({ color, size = 28, children }: { color: string; size?: number; children: ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + "18", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

export default IconBox;
