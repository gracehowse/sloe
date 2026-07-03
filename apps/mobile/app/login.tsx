import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { sha256 } from "js-sha256";
// ENG-120: lucide has no brand glyph — Ionicons retained for logo-* only
import { Ionicons } from "@expo/vector-icons";
import { Check, ChevronLeft, Mail, X as CloseIcon } from "lucide-react-native";

import { useAuth } from "@/context/auth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { getSupprWebBase } from "@/lib/supprWeb";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import KeyboardSafeView from "@/components/KeyboardSafeView";
import { SloeHeaderWordmark } from "@/components/SloeHeaderWordmark";

/** Resolve a legal-link URL from the configured web base (same source as
 *  Settings' `openLegalPath`), falling back to the secured Sloe domain so
 *  the terms fine-print never renders a stale Suppr URL. */
function legalUrl(path: "/terms" | "/privacy"): string {
  const base = getSupprWebBase();
  return `${base || "https://getsloe.com"}${path}`;
}

function createAppleRawNonce(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Maps Supabase / fetch failures to a short user-facing string. */
function formatAuthError(err: unknown): string {
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "Something went wrong. Please try again.";
  const lower = msg.toLowerCase();
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("internet") ||
    lower.includes("failed to load") ||
    lower.includes("host lookup") ||
    lower.includes("connection")
  ) {
    return "Can't reach Sloe's servers. Try Wi‑Fi or cellular, turn off VPN or iCloud Private Relay, or confirm the backend isn't paused.";
  }
  return msg;
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  // Sloe auth chooser (Figma `296:2`, 2026-06-08): the screen opens on a
  // calm chooser (wordmark, positioning headline, Apple + email buttons,
  // terms fine-print). The email/password form is PROGRESSIVELY DISCLOSED —
  // `view` toggles chooser ↔ email locally (no new route, no auth change;
  // auth stop-zone respected). Every handler + testID below is unchanged.
  const [view, setView] = useState<"chooser" | "email">("chooser");
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  // Positive assent to Terms + Privacy required at account creation
  // (browsewrap is unenforceable — Nguyen v. Barnes & Noble). Defaults
  // to unchecked; never pre-check.
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  // Sloe DS reskin (Figma chooser `296:2` / continue-with-email `296:33`,
  // 2026-06-08): white/cream ground, plum Newsreader serif wordmark +
  // positioning headline, full-pill ink Apple + outline email buttons,
  // terms fine-print, 24px input radii. Presentation only — the auth flow,
  // handlers, and testIDs are untouched.
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.xxl,
    },
    closeRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingTop: Spacing.sm,
    },
    closeBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    centerBody: {
      flex: 1,
      justifyContent: "center",
    },
    brandSection: {
      alignItems: "center",
    },
    // Plum Newsreader serif positioning headline — mirrors the `296:2`
    // chooser H1 (`navPrimary` is theme-aware: light #3B2A4D / dark #815E91).
    headline: {
      fontFamily: FontFamily.serifMedium,
      fontSize: 30,
      fontWeight: "500",
      letterSpacing: -0.3,
      lineHeight: 36,
      color: colors.navPrimary,
      textAlign: "center",
      marginTop: Spacing.xl,
    },
    headlineItalic: {
      fontFamily: FontFamily.serifItalic,
      fontStyle: "italic",
    },
    // Plum Newsreader serif heading for the email step (Welcome back /
    // Create your account).
    title: {
      fontFamily: FontFamily.serifSemibold,
      fontSize: 28,
      fontWeight: "500",
      letterSpacing: -0.4,
      lineHeight: 34,
      color: colors.navPrimary,
      textAlign: "center",
      marginTop: Spacing.md,
    },
    tagline: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: Spacing.md,
      textAlign: "center",
      lineHeight: 20,
    },
    chooser: { marginTop: Spacing.xxxl },
    form: { gap: Spacing.md, marginTop: Spacing.xl },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.text,
      fontSize: 16,
    },
    // Primary CTA — clay pill (Sloe three-role colour law: clay is the
    // one commit action per screen).
    btn: {
      backgroundColor: colors.tint,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      alignItems: "center",
      marginTop: Spacing.sm,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 17 },
    errorText: { color: Accent.destructive, fontSize: 13, textAlign: "center" },
    hint: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: Spacing.sm,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      alignSelf: "flex-start",
      marginBottom: Spacing.md,
    },
    backText: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },
    // Continue with Apple — full-pill ink button (`296:2` chooser).
    appleBtn: {
      backgroundColor: colors.text,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    appleBtnText: { color: Accent.primaryForeground, fontWeight: "700", fontSize: 17 },
    // Continue with email — outline pill (`296:2` chooser).
    emailBtn: {
      backgroundColor: colors.background,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    emailBtnText: { color: colors.navPrimary, fontWeight: "700", fontSize: 17 },
    termsFinePrint: {
      ...Type.captionSmall,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: Spacing.xl,
      lineHeight: 17,
    },
    termsFinePrintLink: { textDecorationLine: "underline" },
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    termsCheckbox: {
      width: 18,
      height: 18,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    termsCheckboxChecked: {
      backgroundColor: colors.tint,
      borderColor: colors.tint,
    },
    termsText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    termsLink: { color: colors.text, textDecorationLine: "underline", fontWeight: "600" },
  }), [colors]);

  if (!hasSupabaseConfig()) {
    return (
      <View style={[styles.container, styles.centerBody, { paddingTop: insets.top }]}>
        <View style={styles.brandSection}>
          <SloeHeaderWordmark fontSize={40} />
        </View>
        <Text style={styles.errorText}>
          {"Sign-in isn't configured for this build. Use the web app or contact support."}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBody, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // Signed-in users skip this screen immediately. Onboarding is gated in
  // `(tabs)/_layout.tsx` — no intermediate launch screen here.
  if (session?.user?.id) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSubmit() {
    setMessage(null);
    const resolvedEmail = email.trim();
    const resolvedPassword = password;
    if (!resolvedEmail || !resolvedPassword) {
      setMessage("Enter your email and password.");
      return;
    }
    if (isSignUp && !acceptedTerms) {
      setMessage("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: resolvedEmail,
          password: resolvedPassword,
        });
        if (error) {
          setMessage(formatAuthError(error));
        } else {
          try { track(AnalyticsEvents.user_signed_up, { method: "email", platform: "mobile" }); } catch { /* ignore */ }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password: resolvedPassword,
        });
        if (error) {
          if (error.message.includes("Invalid login")) {
            setMessage("No account found. Tap 'Create account' below to sign up.");
          } else {
            setMessage(formatAuthError(error));
          }
        } else {
          try { track(AnalyticsEvents.user_signed_in, { method: "email", platform: "mobile" }); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setMessage(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAppleSignIn() {
    setMessage(null);
    if (isSignUp && !acceptedTerms) {
      setMessage("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    try {
      // Apple expects SHA256(rawNonce) on the request; Supabase verifies the ID token using rawNonce.
      const rawNonce = createAppleRawNonce();
      const hashedNonce = sha256(rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setMessage("Apple Sign-In failed — no identity token received.");
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) {
        setMessage(formatAuthError(error));
      } else {
        // Login screen Apple button is always sign-in (returning users);
        // new-user Apple sign-up goes through the onboarding signup step.
        try { track(AnalyticsEvents.user_signed_in, { method: "apple", platform: "mobile" }); } catch { /* ignore */ }
      }
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "ERR_REQUEST_CANCELED") return;
      setMessage(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  const appleVisible = Platform.OS === "ios" && appleAuthAvailable;

  return (
    <KeyboardSafeView
      contentContainerStyle={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Close X — top-right (frame 296:2). Dismisses to the public web
          landing (the app has no pre-auth route to return to). */}
      <View style={styles.closeRow}>
        <Pressable
          testID="login-close"
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeBtn}
          onPress={() => void Linking.openURL(getSupprWebBase() || "https://getsloe.com")}
        >
          <CloseIcon size={26} color={colors.textTertiary} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.centerBody}>
        {view === "chooser" ? (
          /* ── Chooser (default) ──────────────────────────────────────
             Wordmark, two-line positioning headline (italic "Still"), sync
             subtitle, then Apple (ink fill) + email (outline). Google is
             OMITTED per ENG-924 (Apple + email only). "Continue with email"
             reveals the form below via progressive disclosure. */
          <>
            <View style={styles.brandSection}>
              <SloeHeaderWordmark fontSize={36} />
              <Text style={styles.headline}>
                Cook what you love.{"\n"}
                <Text style={styles.headlineItalic}>Still</Text> reach your goals.
              </Text>
              <Text style={styles.tagline}>
                Create an account or log in — your recipes and plan sync everywhere.
              </Text>
            </View>

            <View style={styles.chooser}>
              {/* Apple Sign-In — hidden when capability not provisioned (e.g.
                  Personal Team dev build); the email path still works. */}
              {appleVisible && (
                <Pressable
                  testID="login-apple"
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Apple"
                  style={[styles.appleBtn, busy && styles.btnDisabled]}
                  onPress={() => void onAppleSignIn()}
                  disabled={busy}
                >
                  <Ionicons name="logo-apple" size={20} color={Accent.primaryForeground} />
                  <Text style={styles.appleBtnText}>Continue with Apple</Text>
                </Pressable>
              )}

              <Pressable
                testID="login-continue-email"
                accessibilityRole="button"
                accessibilityLabel="Continue with email"
                style={styles.emailBtn}
                onPress={() => { setView("email"); setMessage(null); }}
              >
                <Mail size={20} color={colors.navPrimary} strokeWidth={2} />
                <Text style={styles.emailBtnText}>Continue with email</Text>
              </Pressable>

              {/* Terms / Privacy fine print (frame 296:2). */}
              <Text style={styles.termsFinePrint}>
                By continuing you agree to our{" "}
                <Text style={styles.termsFinePrintLink} onPress={() => void Linking.openURL(legalUrl("/terms"))}>
                  Terms
                </Text>
                {" "}and{" "}
                <Text style={styles.termsFinePrintLink} onPress={() => void Linking.openURL(legalUrl("/privacy"))}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </>
        ) : (
          /* ── Email form (progressive disclosure) ────────────────────
             The full email/password surface, unchanged in behaviour. A
             back affordance returns to the chooser. */
          <>
            <Pressable
              testID="login-back"
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backRow}
              onPress={() => { setView("chooser"); setMessage(null); }}
            >
              <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <View style={styles.brandSection}>
              <Text style={styles.title}>{isSignUp ? "Create your account" : "Welcome back"}</Text>
              <Text style={styles.tagline}>
                {isSignUp ? "Cook what you love. Still reach your goals." : "Sign in to continue."}
              </Text>
            </View>

            <View style={styles.form}>
              <TextInput
                ref={emailRef}
                testID="login-email"
                accessibilityLabel="Email input"
                autoFocus
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="none"
                autoComplete="off"
                returnKeyType="next"
                placeholder="Email"
                placeholderTextColor={colors.tabIconDefault}
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => passwordRef.current?.focus()}
                style={styles.input}
              />
              <TextInput
                ref={passwordRef}
                testID="login-password"
                accessibilityLabel="Password input"
                textContentType="none"
                autoComplete="off"
                returnKeyType="go"
                placeholder="Password"
                placeholderTextColor={colors.tabIconDefault}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => void onSubmit()}
                secureTextEntry
                style={styles.input}
              />

              {isSignUp && (
                <Pressable
                  onPress={() => setAcceptedTerms((v) => !v)}
                  style={styles.termsRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  accessibilityLabel="Agree to Terms of Service and Privacy Policy"
                >
                  <View style={[styles.termsCheckbox, acceptedTerms && styles.termsCheckboxChecked]}>
                    {acceptedTerms ? <Check size={12} color={colors.primaryForeground} strokeWidth={3} /> : null}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the{" "}
                    <Text style={styles.termsLink} onPress={() => void Linking.openURL(legalUrl("/terms"))}>
                      Terms of Service
                    </Text>
                    {" "}and{" "}
                    <Text style={styles.termsLink} onPress={() => void Linking.openURL(legalUrl("/privacy"))}>
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </Pressable>
              )}

              <Pressable
                testID="login-submit"
                style={[styles.btn, (busy || (isSignUp && !acceptedTerms)) && styles.btnDisabled]}
                onPress={() => void onSubmit()}
                disabled={busy || (isSignUp && !acceptedTerms)}
              >
                <Text style={styles.btnText}>{busy ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}</Text>
              </Pressable>

              {message ? <Text style={styles.errorText}>{message}</Text> : null}

              <Pressable onPress={() => { setIsSignUp((v) => !v); setMessage(null); }}>
                <Text style={styles.hint}>
                  {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
                </Text>
              </Pressable>

              {!isSignUp && (
                <Pressable onPress={async () => {
                  if (!email.trim()) { setMessage("Enter your email first, then tap Forgot password."); return; }
                  setBusy(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
                  setBusy(false);
                  if (error) { setMessage(formatAuthError(error)); return; }
                  setMessage("Password reset email sent. Check your inbox.");
                }}>
                  <Text style={[styles.hint, { marginTop: 0 }]}>Forgot password?</Text>
                </Pressable>
              )}

              {!isSignUp && (
                <Pressable onPress={async () => {
                  if (!email.trim()) { setMessage("Enter your email to receive a magic link."); return; }
                  setBusy(true);
                  const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
                  setBusy(false);
                  if (error) { setMessage(formatAuthError(error)); return; }
                  setMessage("Magic link sent! Check your email inbox.");
                }}>
                  <Text style={[styles.hint, { color: colors.text, fontWeight: "600" }]}>Sign in with magic link</Text>
                </Pressable>
              )}

              {/* Apple option also reachable from the email step (returning
                  users who tapped email out of habit) — hidden when the
                  capability isn't provisioned. */}
              {appleVisible && (
                <>
                  <View style={{ height: Spacing.sm }} />
                  <Pressable
                    style={[styles.appleBtn, (busy || (isSignUp && !acceptedTerms)) && styles.btnDisabled]}
                    onPress={() => void onAppleSignIn()}
                    disabled={busy || (isSignUp && !acceptedTerms)}
                  >
                    <Ionicons name="logo-apple" size={20} color={Accent.primaryForeground} />
                    <Text style={styles.appleBtnText}>Continue with Apple</Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </View>
    </KeyboardSafeView>
  );
}
