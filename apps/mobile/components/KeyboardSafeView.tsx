/**
 * KeyboardSafeView — shared keyboard-handling wrapper for mobile screens
 * with text inputs (TestFlight build 9 feedback, 2026-04-19).
 *
 * Why this exists
 * ---------------
 * In-session tester report against TestFlight build 9: on the login
 * screen, tapping the email / password field brings up the iOS keyboard,
 * and the keyboard then covers the "Sign In" button — the user has to
 * dismiss the keyboard manually before the CTA is tappable. Tester also
 * noted "this appears elsewhere on the app too" (systemic — multiple
 * screens use raw `View` layouts with no keyboard handling).
 *
 * The cause is a well-known React Native pattern: screens with text
 * inputs need three things wired up together to avoid this symptom,
 * and doing it inline per-screen guarantees drift.
 *   1. `KeyboardAvoidingView` with the right `behavior` per platform so
 *      the whole layout lifts when the keyboard opens.
 *   2. `keyboardShouldPersistTaps="handled"` on the inner `ScrollView`
 *      so the first tap on a submit button doesn't get consumed by the
 *      "dismiss keyboard" gesture.
 *   3. A background `Pressable` that calls `Keyboard.dismiss()` when the
 *      user taps outside an input, so they can deliberately collapse the
 *      keyboard.
 *
 * This component bundles all three into one narrow primitive so every
 * critical-path screen renders the same behaviour and we don't leave
 * two patterns in the codebase.
 *
 * Parity
 * ------
 * Web has native browser keyboard behaviour — the software keyboard
 * never covers in-page controls and the browser auto-scrolls focused
 * inputs into view. No web counterpart is needed. Noted in
 * `docs/testflight-feedback/resolved.md` so a future reader doesn't
 * chase phantom web parity.
 *
 * Usage
 * -----
 *   // Full-screen form with default scroll + tap-to-dismiss
 *   <KeyboardSafeView>
 *     …inputs and CTA…
 *   </KeyboardSafeView>
 *
 *   // Screen that owns its own ScrollView — disable the inner one
 *   <KeyboardSafeView scroll={false}>
 *     <ScrollView keyboardShouldPersistTaps="handled">…</ScrollView>
 *   </KeyboardSafeView>
 *
 *   // Inside a modal whose backdrop already handles dismiss
 *   <KeyboardSafeView scroll={false} dismissOnBackgroundTap={false}>
 *     <SheetContent />
 *   </KeyboardSafeView>
 */
import type { ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Platform,
  type KeyboardAvoidingViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type KeyboardSafeViewProps = {
  children: ReactNode;
  /**
   * Wrap children in an internal `ScrollView` with
   * `keyboardShouldPersistTaps="handled"` and
   * `automaticallyAdjustKeyboardInsets` on iOS. Default: true.
   *
   * Set to `false` on screens that own their own ScrollView (so we
   * don't nest two scrolls), or inside sheets where the sheet handles
   * its own internal scrolling.
   */
  scroll?: boolean;
  /**
   * When true, wrap children in a `Pressable` that calls
   * `Keyboard.dismiss()` on press and is hidden from screen readers
   * (`accessible={false}`). Default: true.
   *
   * Set to `false` inside modals whose backdrop Pressable already
   * handles dismiss — nesting the two causes tap conflicts.
   */
  dismissOnBackgroundTap?: boolean;
  /**
   * Vertical offset for the `KeyboardAvoidingView`. Default 0.
   * Tune for screens with a nav header (usually the header height).
   */
  keyboardVerticalOffset?: number;
  /**
   * Optional behavior override. Default is `"padding"` on iOS and
   * `"height"` on Android — the combination that matches the standard
   * RN docs recommendation for full-screen forms.
   */
  behavior?: KeyboardAvoidingViewProps["behavior"];
  /** Style applied to the outer `KeyboardAvoidingView`. */
  style?: StyleProp<ViewStyle>;
  /**
   * Content container style applied to the inner `ScrollView` when
   * `scroll` is true. We always pass `flexGrow: 1` so short content
   * still fills the viewport; anything passed in here is merged on top.
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Forwarded to the outer `KeyboardAvoidingView` for test hooks. */
  testID?: string;
};

export default function KeyboardSafeView({
  children,
  scroll = true,
  dismissOnBackgroundTap = true,
  keyboardVerticalOffset = 0,
  behavior,
  style,
  contentContainerStyle,
  testID,
}: KeyboardSafeViewProps) {
  const resolvedBehavior: KeyboardAvoidingViewProps["behavior"] =
    behavior ?? (Platform.OS === "ios" ? "padding" : "height");

  // Build the innermost content: the user's children, optionally wrapped
  // in a Pressable that dismisses the keyboard on tap. The Pressable is
  // `accessible={false}` so VoiceOver / TalkBack doesn't announce it —
  // it's a gesture hit-area, not a control.
  const dismissible = dismissOnBackgroundTap ? (
    <Pressable
      onPress={() => Keyboard.dismiss()}
      accessible={false}
      // Avoid swallowing the "pressed" visual on real controls inside —
      // Pressable's default hitSlop + hover states can leak through.
      style={{ flex: 1 }}
    >
      {children}
    </Pressable>
  ) : (
    children
  );

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
      // iOS 14+ / RN 0.73+ — lets iOS automatically adjust insets when
      // the keyboard opens. Harmless no-op on older platforms.
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      showsVerticalScrollIndicator={false}
    >
      {dismissible}
    </ScrollView>
  ) : (
    dismissible
  );

  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior={resolvedBehavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[{ flex: 1 }, style]}
    >
      {body}
    </KeyboardAvoidingView>
  );
}
