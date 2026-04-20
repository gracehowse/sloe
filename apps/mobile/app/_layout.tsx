import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { configureNotificationPresentation } from '@/lib/pushNotificationsSetup';
import { safeGetClipboardString } from '@/lib/safeClipboard';
import { extractUrlFromShareText, urlFromDeepLink } from '@/lib/resolveImportUrl';
import { parseSiriDeepLink } from '@/lib/siriDeepLinks';
import { setPendingSiriAction } from '@/lib/siriPending';
import { track } from '@/lib/analytics';
import { AnalyticsEvents } from '../../../src/lib/analytics/events';
import {
  cancelWeeklyRecapPush,
  handleWeeklyRecapNotificationResponse,
} from '@/lib/weeklyRecapPush';
import {
  markWhatsNewSeen,
  resolveCurrentBuildNumber,
  shouldAutoShowWhatsNew,
} from '@/lib/whatsNew';

initErrorTracking();
configurePurchases();
configureNotificationPresentation();

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
      // Batch 5.12 — Siri / Shortcuts-app deep links are handled by
      // HandleSiriDeepLinks. Skip here so we don't race-navigate.
      if (parseSiriDeepLink(t) != null) return;
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
 * Batch 5.12 — Siri / Shortcuts-app deep links.
 *
 * Parses `suppr://log/water?ml=…`, `suppr://fast/start?hours=…`, and
 * `suppr://today/remaining`. For actions that mutate state (water, fast),
 * the action is queued via `setPendingSiriAction` and the user is routed
 * to Today — the Today tab flushes the queue on mount/focus. This keeps
 * the layout provider-free (no tight coupling to the Today hook).
 *
 * An accessibility announcement surfaces the action immediately so
 * VoiceOver users hear confirmation even before Today renders.
 */
function HandleSiriDeepLinks() {
  const router = useRouter();

  const handle = useCallback(
    async (href: string | null | undefined) => {
      if (!href) return false;
      const action = parseSiriDeepLink(href);
      if (!action) return false;

      track(AnalyticsEvents.siri_action_invoked, { kind: action.kind });

      switch (action.kind) {
        case "log_water": {
          await setPendingSiriAction(action);
          AccessibilityInfo.announceForAccessibility(`Logged ${action.ml} millilitres of water`);
          router.replace("/");
          return true;
        }
        case "start_fast": {
          await setPendingSiriAction(action);
          AccessibilityInfo.announceForAccessibility(`Starting a ${action.hours} hour fast`);
          router.replace("/");
          return true;
        }
        case "today_remaining": {
          AccessibilityInfo.announceForAccessibility("Opening today's remaining macros");
          router.replace("/");
          return true;
        }
      }
      return false;
    },
    [router],
  );

  useEffect(() => {
    // Cold-start deep link.
    void Linking.getInitialURL().then((h) => {
      void handle(h);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      void handle(url);
    });
    return () => sub.remove();
  }, [handle]);

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

/**
 * Sunday push rewrite — T5 (2026-04-19). Notification-tap listener
 * for the weekly-recap push.
 *
 * Why a top-level component:
 *   `Notifications.addNotificationResponseReceivedListener` survives
 *   the OS resuming the app from a notification tap (even from a cold
 *   start once `expo-router` mounts the root). Registering it here in
 *   the layout means we never miss a tap because Progress wasn't the
 *   first screen.
 *
 *   The branching logic is in the pure helper
 *   `handleWeeklyRecapNotificationResponse` (apps/mobile/lib/weeklyRecapPush.ts)
 *   so it can be unit-tested without mocking the entire native API.
 *   This component just wires the helper to the listener and emits
 *   the analytics event when the handler says to.
 *
 * Cleanup: the subscription returned by `addNotificationResponseReceivedListener`
 * has a `.remove()` method we call on unmount. In practice the
 * component lives for the entire app session, but the cleanup keeps
 * Strict Mode / hot-reload tidy.
 */
function HandleWeeklyRecapPushOpen() {
  useEffect(() => {
    // Mobile-local weekly-recap scheduling was killed 2026-04-20
    // (docs/decisions/2026-04-20-weekly-recap-mobile-local-killed.md).
    // Pre-kill installs may still have a `weekly-recap-v1` entry in
    // the OS notification queue; evict it once on boot so stale
    // generic-body pushes don't keep firing weekly. Idempotent + safe
    // to run every launch — the native call no-ops when the
    // identifier isn't scheduled.
    void cancelWeeklyRecapPush();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const decision = handleWeeklyRecapNotificationResponse(response);
      if (!decision.shouldTrack) return;
      track(AnalyticsEvents.weekly_recap_push_opened, { weekKey: decision.weekKey });
    });
    return () => sub.remove();
  }, []);

  return null;
}

/**
 * F-0 "What's new" auto-surface (2026-04-19). On the first launch
 * after a TestFlight build-number bump, push `/whats-new` once and
 * persist the build via `markWhatsNewSeen` so it doesn't re-appear.
 *
 * Fail-safe: a failed AsyncStorage read or a missing build number
 * simply no-ops — `shouldAutoShowWhatsNew` returns `false` and we
 * never block launch. The ref guard prevents the effect firing
 * twice in Strict Mode / hot-reload.
 */
function AutoSurfaceWhatsNew() {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const currentBuild = resolveCurrentBuildNumber(Constants.expoConfig);
    if (currentBuild == null) return;

    void (async () => {
      const should = await shouldAutoShowWhatsNew(currentBuild);
      if (!should) return;
      // Mark as seen BEFORE navigation so a second provider mount
      // can't race in and re-push. Storage write errors are swallowed
      // inside the helper.
      await markWhatsNewSeen(currentBuild);
      router.push('/whats-new' as any);
    })();
  }, [router]);

  return null;
}

/** Full-screen flows — no stack chrome (custom in-screen headers / modals). */
const STACK_HEADER_HIDDEN = new Set([
  "(tabs)",
  "login",
  "import-shared",
  "cook",
  "recipe/verify",
  "shopping",
  "profile",
  "paywall",
  "onboarding",
  "notifications-prompt",
  // Custom in-screen headers (avoid double back + native title clash)
  "weight-tracker",
  "progress-metric",
  "health-sync",
  "fasting",
  "nutrition-sources",
  "create-recipe",
  "recipe/[id]",
]);

/** Readable titles (route `name` from Expo Router file path). */
const STACK_TITLES: Record<string, string> = {
  "health-sync": "Apple Health",
  fasting: "Fasting",
  "meal-nutrition": "Nutrition",
  "progress-metric": "This week",
  "weight-tracker": "Weight & trends",
  "recipe/[id]": "Recipe",
  "create-recipe": "New recipe",
  "nutrition-sources": "Nutrition sources",
  "whats-new": "What's new",
  "+not-found": "Not found",
};

function stackTitleForRoute(routeName: string): string {
  if (STACK_TITLES[routeName]) return STACK_TITLES[routeName];
  const segment = routeName.replace(/^\(+|\)+$/g, "").split("/").pop() ?? routeName;
  return segment
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function RootLayoutInner() {
  const { resolved } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={resolved === 'dark' ? DarkTheme : DefaultTheme}>
        <HandleSiriDeepLinks />
        <HandleWeeklyRecapPushOpen />
        <ForwardSocialSharesToImport />
        <ForwardShareIntentToImport />
        <ResumeClipboardToImport />
        <AutoSurfaceWhatsNew />
        <Stack
        screenOptions={({ route }) => ({
          headerShown: !STACK_HEADER_HIDDEN.has(route.name),
          // Avoid "< (tabs)" / long parent labels on iOS back button
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "Back",
          title: stackTitleForRoute(route.name),
        })}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="shopping" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="weight-tracker" />
        <Stack.Screen name="progress-metric" />
        <Stack.Screen name="meal-nutrition" />
        <Stack.Screen name="import-shared" options={{ headerShown: false }} />
        <Stack.Screen name="cook" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/verify" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
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
