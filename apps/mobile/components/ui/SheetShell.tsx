import * as React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Radius, SheetGrabber, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";

/**
 * SheetShell — one bottom-sheet chassis (ENG-1662).
 *
 * Census had 3 top radii, 3 scrim recipes, 3 grabber builds — this owner
 * centralises:
 *   - `SHEET_RADIUS` (24) top corners
 *   - `MODAL_OVERLAY_SCRIM` backdrop
 *   - one 36×4 grabber (`SheetGrabber`)
 *
 * Content-only children; the host owns title/actions. Web mirror:
 * `src/app/components/ui/sheet-shell.tsx` (Radix bottom sheet wrapper).
 */
export interface SheetShellProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
  animationType?: "none" | "slide" | "fade";
  /** Extra padding below children (safe-area inset is always applied). */
  contentStyle?: StyleProp<ViewStyle>;
  /** When false, tapping the scrim does not dismiss. Default true. */
  dismissOnScrimPress?: boolean;
}

export function SheetGrabberBar({ testID = "sheet-grabber" }: { testID?: string }) {
  const colors = useThemeColors();
  return (
    <View
      testID={testID}
      style={[
        styles.grabber,
        {
          width: SheetGrabber.width,
          height: SheetGrabber.height,
          backgroundColor: colors.border,
        },
      ]}
    />
  );
}

export function SheetShell({
  visible,
  onClose,
  children,
  testID,
  animationType = "slide",
  contentStyle,
  dismissOnScrimPress = true,
}: SheetShellProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.scrim}
        onPress={dismissOnScrimPress ? onClose : undefined}
        accessibilityLabel="Close sheet"
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          testID={testID}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + Spacing.lg,
            },
            contentStyle,
          ]}
        >
          <SheetGrabberBar />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: MODAL_OVERLAY_SCRIM,
  },
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  grabber: {
    alignSelf: "center",
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
});

export default SheetShell;
