import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { useCallback, useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/auth';
import { AnalyticsProvider } from '@/context/AnalyticsProvider';
import { ThemeProvider as SupprThemeProvider, useTheme } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { consumeNewSocialRecipeUrlFromClipboard, isSocialShareRecipeUrl } from '@/lib/clipboardShareForward';
import { initErrorTracking } from '@/lib/errorTracking';
import { configurePurchases } from '@/lib/purchases';
import { safeGetClipboardString } from '@/lib/safeClipboard';
import { extractUrlFromShareText, urlFromDeepLink } from '@/lib/resolveImportUrl';

initErrorTracking();
configurePurchases();

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Android "Open with" / share targets often deliver an https:// Instagram (etc.) URL as the
 * launch URL. Expo Router would otherwise open the home tab and never pass the link to import.
 */
function ForwardSocialSharesToImport() {
  const router = useRouter();

  const forward = useCallback(
    (href: string) => {
      const t = href.trim();
      if (/^suppr:/i.test(t)) {
        const u = urlFromDeepLink(t);
        if (u) {
          router.replace({ pathname: "/import-shared", params: { url: u } });
        } else {
          // Share-intent deep link (suppr://…) —
          // redirect home so expo-router doesn't show "Unmatched Route".
          // ForwardShareIntentToImport will pick up the data and navigate.
          router.replace("/");
        }
        return;
      }
      if (!/^https?:\/\//i.test(t)) return;
      const u = extractUrlFromShareText(t);
      if (!u || !isSocialShareRecipeUrl(u)) return;
      router.replace({ pathname: "/import-shared", params: { url: u } });
    },
    [router],
  );

  useEffect(() => {
    void Linking.getInitialURL().then((h) => {
      if (h) forward(h);
    });
    const sub = Linking.addEventListener("url", ({ url }) => forward(url));
    return () => sub.remove();
  }, [forward]);

  return null;
}

/**
 * Instagram / TikTok share sheet → Suppr (needs native share intent + dev build; not Expo Go).
 * Resolves URL from shared text or webUrl and opens Import.
 */
function ForwardShareIntentToImport() {
  const router = useRouter();
  const isExpoGo = Constants.appOwnership === "expo";
  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    disabled: isExpoGo,
    scheme: (Constants.expoConfig?.scheme as string | undefined) ?? "suppr",
    resetOnBackground: false,
  });

  const webUrl = shareIntent?.webUrl ?? "";
  const text = shareIntent?.text ?? "";

  useEffect(() => {
    if (!isReady || !hasShareIntent || isExpoGo) return;
    const raw = (webUrl || text).trim();
    if (!raw) return;
    let u = extractUrlFromShareText(raw);
    if (!u && /^https?:\/\//i.test(raw)) {
      u = raw.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),.;]+$/, "") ?? null;
    }
    if (!u || !/^https?:\/\//i.test(u)) {
      resetShareIntent(true);
      return;
    }
    router.replace({ pathname: "/import-shared", params: { url: u } });
    resetShareIntent(true);
  }, [hasShareIntent, isExpoGo, isReady, resetShareIntent, router, text, webUrl]);

  return null;
}

/**
 * Share → "Open in Suppr" often returns to Discover with only the system pasteboard updated.
 * import-shared never mounts, so we watch for resume + read clipboard here.
 */
function ResumeClipboardToImport() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const appRef = useRef(AppState.currentState);

  useEffect(() => {
    const run = async () => {
      if (pathnameRef.current?.includes("import-shared")) return;
      const delayMs = Platform.OS === "ios" ? 1100 : 500;
      await new Promise((r) => setTimeout(r, delayMs));
      const text = await safeGetClipboardString();
      if (!text) return;
      const url = consumeNewSocialRecipeUrlFromClipboard(text);
      if (!url) return;
      router.replace({ pathname: "/import-shared", params: { url } });
    };

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appRef.current;
      appRef.current = next;
      if (next !== "active" || prev === "active") return;
      void run();
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

function RootLayoutInner() {
  const { resolved } = useTheme();

  return (
    <ThemeProvider value={resolved === 'dark' ? DarkTheme : DefaultTheme}>
      <ForwardSocialSharesToImport />
      <ForwardShareIntentToImport />
      <ResumeClipboardToImport />
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe', headerBackTitle: 'Back' }} />
        <Stack.Screen name="shopping" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="progress" options={{ title: "Progress", headerBackTitle: "Back" }} />
        <Stack.Screen name="import-shared" options={{ headerShown: false }} />
        <Stack.Screen name="cook" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/verify" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AnalyticsProvider>
        <SupprThemeProvider>
          <RootLayoutInner />
        </SupprThemeProvider>
      </AnalyticsProvider>
    </AuthProvider>
  );
}
