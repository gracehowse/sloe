import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { sha256 } from "js-sha256";

import { useAuth } from "@/context/auth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { useAuthCallbackError } from "@/lib/useAuthCallbackError";
import { useEmailEntrySignUpDefault } from "@/lib/hasSignedInBefore";
import { getSupprWebBase } from "@/lib/supprWeb";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import KeyboardSafeView from "@/components/KeyboardSafeView";
import { SloeHeaderWordmark } from "@/components/SloeHeaderWordmark";
import { makeLoginStyles } from "@/components/login/loginStyles";
import {
  LoginAppleSecondaryButton,
  LoginBackRow,
  LoginChooserActions,
  LoginCloseButton,
  LoginHintLink,
  LoginSubmitButton,
  LoginTermsCheckbox,
} from "@/components/login/LoginScreenPressables";

// ENG-1474 — deep link GoTrue redirects PKCE email links to; `app/auth-callback.tsx`
// exchanges the `?code=`. Must match `additional_redirect_urls` in supabase/config.toml.
const AUTH_CALLBACK_DEEP_LINK = "suppr://auth-callback";

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
  const router = useRouter();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const emailEntrySignUp = useEmailEntrySignUpDefault();
  const emailParam = useLocalSearchParams<{ email?: string | string[] }>().email;
  const openEmail = (Array.isArray(emailParam) ? emailParam[0] : emailParam) === "1";
  const [view, setView] = useState<"chooser" | "email">(openEmail ? "email" : "chooser");
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  useAuthCallbackError(setMessage);

  const styles = useMemo(() => makeLoginStyles(colors), [colors]);

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
          options: { emailRedirectTo: AUTH_CALLBACK_DEEP_LINK },
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

  async function onSendPasswordReset() {
    if (!email.trim()) { setMessage("Enter your email first, then tap Forgot password."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${AUTH_CALLBACK_DEEP_LINK}?next=${encodeURIComponent("/reset-password")}`,
    });
    setBusy(false);
    if (error) { setMessage(formatAuthError(error)); return; }
    setMessage("Password reset email sent. Check your inbox.");
  }

  async function onSendMagicLink() {
    if (!email.trim()) { setMessage("Enter your email to receive a magic link."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: AUTH_CALLBACK_DEEP_LINK },
    });
    setBusy(false);
    if (error) { setMessage(formatAuthError(error)); return; }
    setMessage("Magic link sent! Check your email inbox.");
  }

  const appleVisible = Platform.OS === "ios" && appleAuthAvailable;

  const termsFinePrint = (
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
  );

  const termsCheckboxCopy = (
    <>
      I agree to the{" "}
      <Text style={styles.termsLink} onPress={() => void Linking.openURL(legalUrl("/terms"))}>
        Terms of Service
      </Text>
      {" "}and{" "}
      <Text style={styles.termsLink} onPress={() => void Linking.openURL(legalUrl("/privacy"))}>
        Privacy Policy
      </Text>
      .
    </>
  );

  return (
    <KeyboardSafeView
      style={{ paddingTop: insets.top, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      {router.canGoBack() ? (
        <LoginCloseButton onPress={() => router.back()} styles={styles} />
      ) : null}

      <View style={styles.centerBody}>
        {view === "chooser" ? (
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

            <LoginChooserActions
              appleVisible={appleVisible}
              busy={busy}
              onAppleSignIn={() => void onAppleSignIn()}
              onContinueEmail={() => {
                setIsSignUp(emailEntrySignUp);
                setView("email");
                setMessage(null);
              }}
              styles={styles}
              termsFinePrint={termsFinePrint}
            />
          </>
        ) : (
          <>
            <LoginBackRow
              onPress={() => {
                setView("chooser");
                setIsSignUp(false);
                setMessage(null);
              }}
              styles={styles}
            />

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

              {isSignUp ? (
                <LoginTermsCheckbox
                  acceptedTerms={acceptedTerms}
                  onToggle={() => setAcceptedTerms((v) => !v)}
                  styles={styles}
                  termsCopy={termsCheckboxCopy}
                />
              ) : null}

              <LoginSubmitButton
                busy={busy}
                isSignUp={isSignUp}
                acceptedTerms={acceptedTerms}
                onPress={() => void onSubmit()}
                styles={styles}
              />

              {message ? <Text style={styles.errorText}>{message}</Text> : null}

              <LoginHintLink
                onPress={() => {
                  setIsSignUp((v) => !v);
                  setMessage(null);
                }}
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
              </LoginHintLink>

              {!isSignUp ? (
                <LoginHintLink onPress={() => void onSendPasswordReset()} textStyle={[styles.hint, { marginTop: 0 }]}>
                  Forgot password?
                </LoginHintLink>
              ) : null}

              {!isSignUp ? (
                <LoginHintLink
                  onPress={() => void onSendMagicLink()}
                  textStyle={[styles.hint, { color: colors.text, fontWeight: "600" }]}
                >
                  Sign in with magic link
                </LoginHintLink>
              ) : null}

              {appleVisible ? (
                <LoginAppleSecondaryButton
                  busy={busy}
                  isSignUp={isSignUp}
                  acceptedTerms={acceptedTerms}
                  onPress={() => void onAppleSignIn()}
                  styles={styles}
                />
              ) : null}
            </View>
          </>
        )}
      </View>
    </KeyboardSafeView>
  );
}
