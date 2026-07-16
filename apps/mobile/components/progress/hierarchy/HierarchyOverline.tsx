import { Text, type StyleProp, type TextStyle } from "react-native";

import { Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";

/**
 * ENG-1525 — the Progress hierarchy's section overline.
 *
 * Mobile equivalent of the web screen-chrome overline primitive (the
 * `tracking-[0.1em]` grammar pinned by `sectionHeaderRhythm.test.ts`): on
 * mobile that grammar is the `Type.label` eyebrow token (sans-bold 11,
 * +0.08em tracking, uppercase) in `accent.primarySolid`, exactly how every
 * existing Progress card renders its header ("headers census 2026-06-10").
 * Centralised so the five hierarchy sections can't drift apart — same
 * element, same treatment.
 */
export function HierarchyOverline({
  children,
  testID,
  style,
}: {
  children: React.ReactNode;
  testID?: string;
  style?: StyleProp<TextStyle>;
}) {
  const accent = useAccent();
  return (
    <Text
      testID={testID}
      style={[{ ...Type.label, marginBottom: Spacing.sm, color: accent.primarySolid }, style]}
    >
      {children}
    </Text>
  );
}

export default HierarchyOverline;
