import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AccessibilityInfo, AppState, LogBox, Platform, Text, View } from 'react-native';

// 2026-05-04 audit (#3 in `docs/audits/2026-05-04-full-sweep-audit.md`):
// `TypeError: Network request failed` from the bundled whatwg-fetch polyfill
// surfaces as a red LogBox pill in dev whenever a Supabase / Expo / push-token
// fetch transiently fails. The handled fallbacks (offline cache, tolerable
// tz-sync skip, push-token retry) all warn-and-continue. Suppress the noisy
// dev pill so screenshot captures during sim NAT wedge / cold-boot don't
// leak handled-error chrome onto otherwise-clean screens. Production builds
// disable LogBox entirely so this is dev-only.
//
// 2026-05-14: added PostHog flush-error patterns. The SDK queues events,
// retries on its own (fetchRetryCount/fetchRetryDelay), and shouts via
// console.error after a single failed flush — which RN escalates to a
// redbox. Surfaces every time we trip the iOS-18 sim HTTP/3 wedge
// (`feedback_sim_supabase_unreachable.md`) or background mid-flush.
// Not actionable in dev; SDK handles the retry. Production still
// reports via Sentry through `initErrorTracking()` if a flush truly
// gives up.
//
// 2026-05-15: `LogBox.ignoreLogs` alone doesn't suppress PostHog flush
// errors — the SDK throws `PostHogFetchNetworkError` through an async
// generator (`posthog-core-stateless.js`) and the rejection escapes
// LogBox's `console.error` filter on at least some paths. Adding a
// console.error monkey-patch that runs BEFORE LogBox so the message
// never reaches the redbox renderer. SDK still queues + retries
// internally; we just stop yelling about it in dev. Production keeps
// reporting via Sentry through `initErrorTracking()`.
if (__DEV__) {
  // Shared filter list — see `apps/mobile/lib/devSilencedErrors.ts` for
  // the per-pattern context. We require() at module top so the patches
  // below pick it up even if the file is later edited to add patterns.

  const { matchesSilencedDevError, DEV_SILENCED_ERROR_PATTERNS } = require("@/lib/devSilencedErrors");
  // Patch console.error — direct SDK error path.
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (args.length > 0 && matchesSilencedDevError(args[0])) return;
    originalConsoleError.apply(console, args);
  };
  // Patch console.warn — RN's promise rejection tracker uses warn on
  // some versions; SDK also sometimes downgrades to warn.
  const originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args.length > 0 && matchesSilencedDevError(args[0])) return;
    originalConsoleWarn.apply(console, args);
  };
  // 2026-05-15: Hermes/JSC routes unhandled promise rejections through
  // a separate channel (HermesInternal.enablePromiseRejectionTracker or
  // the legacy `promise/lib/rejection-tracking` from React Native's
  // Promise polyfill). The tracker calls console.warn after a short
  // delay, but it ALSO logs through ExceptionsManager which renders
  // the redbox directly. Wrap ExceptionsManager.reportException to
  // silence dev-only errors before they hit the bridge.
  try {
    const ExceptionsManager = require("react-native/Libraries/Core/ExceptionsManager");
    if (ExceptionsManager && typeof ExceptionsManager.handleException === "function") {
      const originalHandle = ExceptionsManager.handleException.bind(ExceptionsManager);
      ExceptionsManager.handleException = (e: unknown, isFatal: boolean) => {
        if (e && typeof e === "object" && "message" in e && matchesSilencedDevError(e)) {
          return;
        }
        return originalHandle(e, isFatal);
      };
    }
  } catch {
    // ExceptionsManager API has shifted between RN versions; if the
    // wrap fails, the console.error/warn patches still cover the
    // common paths.
  }
  // Spread the shared list directly so LogBox sees the same regexes
  // as the console/ExceptionsManager patches above. Single source of
  // truth keeps the three sinks in sync.
  LogBox.ignoreLogs([...DEV_SILENCED_ERROR_PATTERNS]);
}
import { useShareIntent } from 'expo-share-intent';
import { useCallback, useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/auth';
import { AnalyticsProvider } from '@/context/AnalyticsProvider';
import { ThemeProvider as SupprThemeProvider, useTheme } from '@/context/theme';
import { DrOutageBanner } from '@/components/ops/DrOutageBanner';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { consumeNewSocialRecipeUrlFromClipboard } from '@/lib/clipboardShareForward';
import { initErrorTracking } from '@/lib/errorTracking';
import { hasSupabaseConfig } from '@/lib/supabase';
import { RootErrorBoundary } from '@/components/ui/RootErrorBoundary';
import { FontGate } from '@/components/FontGate';
import { configurePurchases } from '@/lib/purchases';
import { configureNotificationPresentation } from '@/lib/pushNotificationsSetup';
import { safeGetClipboardString } from '@/lib/safeClipboard';
import { extractUrlFromShareText } from '@/lib/resolveImportUrl';
import { decideDeepLinkAction } from '@/lib/deepLinkRouting';
import { parseSiriDeepLink } from '@/lib/siriDeepLinks';
import { setPendingSiriAction } from '@/lib/siriPending';
import { track } from '@/lib/analytics';
import { AnalyticsEvents } from '@suppr/shared/analytics/events';
import {
  cancelWeeklyRecapPush,
  handleWeeklyRecapNotificationResponse,
} from '@/lib/weeklyRecapPush';
import {
  markWhatsNewSeen,
  resolveCurrentBuildNumber,
  shouldAutoShowWhatsNew,
} from '@/lib/whatsNew';
import * as Sentry from '@sentry/react-native';

// NOTE: the wizard's auto-generated `Sentry.init({...})` was deliberately
// removed here. `initErrorTracking()` below (`@/lib/errorTracking`) handles
// init with our consent-gated `redactPII` `beforeSend` — the wizard's init
// has `sendDefaultPii: true` and no redactor, which would silently regress
// the 2026-05-14 privacy posture. The `Sentry.wrap(RootLayout)` export
// below is kept; it wires native crash handling + navigation tracing into
// the Expo Router tree.
initErrorTracking();
configurePurchases();
configureNotificationPresentation();

// Sloe Phase 0 (2026-06-03) — keep the native splash up until the Newsreader +
// Inter fonts have loaded so the first paint never flashes the System font /
// faux-glyphs before the serif/sans swap in. `RootLayoutInner` hides the splash
// once `useFonts` resolves (success OR error — a font load failure must not
// strand the user on the splash; the System fallback in `Fonts`/`Type` covers
// it). Safe to call at module scope; the hide is best-effort.
void SplashScreen.preventAutoHideAsync().catch(() => {});

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
      // Decision logic extracted to `lib/deepLinkRouting` for unit-testing.
      // 2026-04-29 audit fix: previously this handler called
      // `router.replace("/")` for any `suppr://` URL without a
      // recipe URL embedded — silently redirecting navigation
      // deeplinks like `suppr:///settings`, `suppr:///more`, etc.
      // back to Today. The pure decision function now returns
      // "ignore" for those, letting Expo Router handle them.
      const action = decideDeepLinkAction(href);
      if (action.kind === "forward-to-import") {
        router.replace({ pathname: "/import-shared", params: { url: action.url } });
      } else if (action.kind === "navigate") {
        router.replace(
          action.params
            ? ({
                pathname: action.pathname,
                params: action.params,
              } as Parameters<typeof router.replace>[0])
            : (action.pathname as Parameters<typeof router.replace>[0]),
        );
      }
      // "ignore" / "siri" → no-op (Siri owned by HandleSiriDeepLinks).
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
    /**
     * IG/TT/YouTube share-sheet caption forwarding (2026-04-30):
     * iOS's share sheet supplies BOTH a webUrl and the caption text when the
     * source app provides them. We forward the caption text alongside the
     * URL so the caption-text recipe importer (gated by IG_TT_IMPORT_ENABLED
     * server-side) can extract a recipe without Suppr ever fetching the
     * post body. Decision doc:
     * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`.
     *
     * Caption text is only meaningful when it differs from the URL itself
     * — many sharer apps duplicate the URL into the text field. Strip
     * url-only `text` to avoid showing a useless preview.
     */
    const params: Record<string, string> = { url: u };
    const captionCandidate = text.trim();
    if (captionCandidate && captionCandidate !== u && captionCandidate !== webUrl.trim()) {
      params.captionText = captionCandidate;
    }
    router.replace({ pathname: "/import-shared", params });
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
  "plan-import",
  "cookbook-import",
  "cook",
  "recipe/verify",
  "shopping",
  "profile",
  "paywall",
  "onboarding",
  "notifications-prompt",
  // Custom in-screen headers (avoid double back + native title clash)
  "progress-metric",
  "health-sync",
  "fasting",
  "nutrition-sources",
  "create-recipe",
  // Wizard route. Renders its own top bar + step counter — the auto
  // stack header would duplicate the back affordance and clash with
  // the in-screen "Step N of 5" announcement (a11y).
  "recipe/create",
  "recipe/[id]",
  // P1-27 (TestFlight `AHitOL0RmJmQqYwdVzqw-2c`, 2026-04-22):
  // household-settings has its own in-page back chevron + title.
  // Without an entry here the auto-titled "Household Settings" nav
  // bar rendered on top, leaving the user with two stacked back
  // affordances 80pt apart.
  "household-settings",
  // 2026-04-26 polish (round 2): Targets has its own in-screen
  // top bar with `< Back` chevron + "Targets" title + "Edit" pill.
  // Without this entry the auto-stack header rendered another
  // "Targets" title above it — exactly the duplicate-back-affordance
  // issue household-settings already documents.
  "targets",
  // Same shape: Burn Detail had an auto-stack "Burn Detail" header
  // AND an in-card "Activity Bonus" sub-header with another back
  // chevron — duplicate back affordances.
  "burn-detail",
  // DRIFT-04 fix (2026-05-22): Macro Detail rendered the auto-stack
  // "Macro Detail" header AND an in-screen "Protein / Today" header
  // with its own back chevron + value pill. Two back chevrons, two
  // titles. The in-screen header is the canonical one (matches
  // burn-detail's pattern).
  "macro-detail",
  // ENG-825 (2026-05-31 design-direction macro/meal lane): Meal
  // Nutrition now renders its own `PushScreenHeader` for BOTH the
  // single-meal and slot-aggregate modes (it previously drove the
  // native stack header via `navigation.setOptions` in single-meal
  // mode only). Suppress the auto-stack header so the two don't double
  // up — same fix shape as macro-detail / burn-detail above.
  "meal-nutrition",
  // headers census 2026-06-10: whats-new + weekly-recap moved off the native
  // stack header (centred system-font / bespoke serif `headerTitleStyle` — the
  // two extra stack-header systems the census flagged as DRIFT) onto the
  // canonical PushScreenHeader (left chevron + Type.navTitle). Suppress the
  // native header so the in-screen one doesn't double up.
  "whats-new",
  "weekly-recap",
]);

/** Readable titles (route `name` from Expo Router file path). */
const STACK_TITLES: Record<string, string> = {
  "health-sync": "Apple Health",
  fasting: "Fasting",
  "meal-nutrition": "Nutrition",
  "progress-metric": "This week",
  "recipe/[id]": "Recipe",
  "create-recipe": "New recipe",
  "recipe/create": "New recipe",
  "nutrition-sources": "Nutrition sources",
  "whats-new": "What's new",
  // 2026-04-30 — destination for the StreakPip tap. The header back
  // chevron lands on Today (the only place the pip is rendered).
  "weekly-recap": "Weekly recap",
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

  // Misconfigured dev builds use `createClient("", "")` — every fetch
  // fails with RN's generic "Network request failed" and the UI can
  // look like a blank grey screen with only a dev toast. Surface the
  // real problem up front (same signal as `app/login.tsx`).
  if (!hasSupabaseConfig()) {
    const palette = resolved === 'dark' ? Colors.dark : Colors.light;
    const bg = palette.background;
    const fg = palette.text;
    const sub = palette.textSecondary;
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>Supabase is not configured</Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: sub }}>
            This build is missing `supabaseUrl` and `supabaseAnonKey` under `expo.extra` (see `app.json` or your local `app.config`). Rebuild the dev client after fixing env.
          </Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  // ENG-1247 — react-navigation's raw DefaultTheme.colors.background is #F2F2F2
  // (light grey); it paints the navigator SCENE, which showed through behind the
  // transparent floating tab bar as a grey "block" under the pill (Grace flagged
  // it repeatedly). Override the scene background to the app's own page colour so
  // the floating pill sits on the real page, not a grey slab.
  const navTheme =
    resolved === 'dark'
      ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: Colors.dark.background } }
      : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: Colors.light.background } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <DrOutageBanner />
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
        <Stack.Screen name="progress-metric" />
        <Stack.Screen name="meal-nutrition" />
        <Stack.Screen name="import-shared" options={{ headerShown: false }} />
        <Stack.Screen name="plan-import" options={{ headerShown: false }} />
        <Stack.Screen name="cookbook-import" options={{ headerShown: false }} />
        <Stack.Screen name="cook" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/verify" options={{ headerShown: false }} />
        {/* 2026-05-12 (premium-bar audit #18): redirect screen for
            historical `/onboarding-v2` URLs. Suppress header + skip
            animation so the redirect doesn't flash a blank Stack
            screen before resolving to `/onboarding`. */}
        <Stack.Screen
          name="onboarding-v2"
          options={{ headerShown: false, animation: "none" }}
        />
        {/* 2026-04-30 — StreakPip destination. iOS-only mobile feature;
            web pip stays display-only (no /weekly-recap route on web).
            headers census 2026-06-10: native header suppressed (in
            STACK_HEADER_HIDDEN) — the screen now renders its own
            PushScreenHeader, matching every other push screen. */}
        <Stack.Screen
          name="weekly-recap"
          options={{ headerShown: false }}
        />
        </Stack>
        <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayout() {
  return (
    <RootErrorBoundary>
      <AuthProvider>
        <AnalyticsProvider>
          <FontGate>
            <SupprThemeProvider>
              <RootLayoutInner />
            </SupprThemeProvider>
          </FontGate>
        </AnalyticsProvider>
      </AuthProvider>
    </RootErrorBoundary>
  );
}

// Sentry.wrap loads native frame-tracking hooks that SIGSEGV in dev when the
// JS thread stalls (see DiagnosticReports/Suppr-2026-06-11-*.ips). Production
// keeps the wrap; dev runs without it — initErrorTracking already gates capture.
export default __DEV__ ? RootLayout : Sentry.wrap(RootLayout);
