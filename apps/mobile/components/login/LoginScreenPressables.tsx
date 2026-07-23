/**
 * Login screen pressable chrome (ENG-1565).
 * Extracted from `app/login.tsx` for PressableScale migration + screen budget.
 *
 * ENG-924: chooser is Apple + email only — no Google provider/button here.
 */
import React from "react";
import { Text, View, type StyleProp, type TextStyle } from "react-native";
// ENG-120: lucide has no brand glyph — Ionicons retained for logo-* only
import { Ionicons } from "@expo/vector-icons";
import { Check, ChevronLeft, Mail, X as CloseIcon } from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { makeLoginStyles } from "@/components/login/loginStyles";

type LoginStyles = ReturnType<typeof makeLoginStyles>;

export function LoginCloseButton({
  onPress,
  styles,
}: {
  onPress: () => void;
  styles: LoginStyles;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.closeRow}>
      <PressableScale
        haptic="selection"
        testID="login-close"
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.closeBtn}
        onPress={onPress}
      >
        <CloseIcon size={26} color={colors.textTertiary} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}

export function LoginChooserActions({
  appleVisible,
  busy,
  onAppleSignIn,
  onContinueEmail,
  styles,
  termsFinePrint,
}: {
  appleVisible: boolean;
  busy: boolean;
  onAppleSignIn: () => void;
  onContinueEmail: () => void;
  styles: LoginStyles;
  termsFinePrint: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.chooser}>
      {appleVisible ? (
        <PressableScale
          haptic="confirm"
          testID="login-apple"
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          style={[styles.appleBtn, busy && styles.btnDisabled]}
          onPress={onAppleSignIn}
          disabled={busy}
        >
          <Ionicons name="logo-apple" size={20} color={Accent.primaryForeground} />
          <Text style={styles.appleBtnText}>Continue with Apple</Text>
        </PressableScale>
      ) : null}

      <PressableScale
        haptic="confirm"
        testID="login-continue-email"
        accessibilityRole="button"
        accessibilityLabel="Continue with email"
        style={styles.emailBtn}
        onPress={onContinueEmail}
      >
        <Mail size={20} color={colors.navPrimary} strokeWidth={2} />
        <Text style={styles.emailBtnText}>Continue with email</Text>
      </PressableScale>

      {termsFinePrint}
    </View>
  );
}

export function LoginBackRow({
  onPress,
  styles,
}: {
  onPress: () => void;
  styles: LoginStyles;
}) {
  const colors = useThemeColors();
  return (
    <PressableScale
      haptic="selection"
      testID="login-back"
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={styles.backRow}
      onPress={onPress}
    >
      <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
      <Text style={styles.backText}>Back</Text>
    </PressableScale>
  );
}

export function LoginTermsCheckbox({
  acceptedTerms,
  onToggle,
  styles,
  termsCopy,
}: {
  acceptedTerms: boolean;
  onToggle: () => void;
  styles: LoginStyles;
  termsCopy: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <PressableScale
      haptic="selection"
      onPress={onToggle}
      style={styles.termsRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: acceptedTerms }}
      accessibilityLabel="Agree to Terms of Service and Privacy Policy"
    >
      <View style={[styles.termsCheckbox, acceptedTerms && styles.termsCheckboxChecked]}>
        {acceptedTerms ? (
          <Check size={12} color={colors.primaryForeground} strokeWidth={3} />
        ) : null}
      </View>
      <Text style={styles.termsText}>{termsCopy}</Text>
    </PressableScale>
  );
}

export function LoginSubmitButton({
  busy,
  isSignUp,
  acceptedTerms,
  onPress,
  styles,
}: {
  busy: boolean;
  isSignUp: boolean;
  acceptedTerms: boolean;
  onPress: () => void;
  styles: LoginStyles;
}) {
  const disabled = busy || (isSignUp && !acceptedTerms);
  return (
    <PressableScale
      haptic="confirm"
      testID="login-submit"
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.btnText}>
        {busy
          ? isSignUp
            ? "Creating account..."
            : "Signing in..."
          : isSignUp
            ? "Create Account"
            : "Sign In"}
      </Text>
    </PressableScale>
  );
}

export function LoginHintLink({
  onPress,
  children,
  textStyle,
}: {
  onPress: () => void;
  children: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <PressableScale haptic="selection" onPress={onPress}>
      <Text style={textStyle}>{children}</Text>
    </PressableScale>
  );
}

export function LoginAppleSecondaryButton({
  busy,
  isSignUp,
  acceptedTerms,
  onPress,
  styles,
}: {
  busy: boolean;
  isSignUp: boolean;
  acceptedTerms: boolean;
  onPress: () => void;
  styles: LoginStyles;
}) {
  const disabled = busy || (isSignUp && !acceptedTerms);
  return (
    <>
      <View style={{ height: Spacing.sm }} />
      <PressableScale
        haptic="confirm"
        style={[styles.appleBtn, disabled && styles.btnDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        <Ionicons name="logo-apple" size={20} color={Accent.primaryForeground} />
        <Text style={styles.appleBtnText}>Continue with Apple</Text>
      </PressableScale>
    </>
  );
}
