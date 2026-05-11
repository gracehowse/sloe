import { Tabs, Redirect, useRouter, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sun, BookOpen, CalendarDays, CircleUser } from 'lucide-react-native';

import { HapticTab } from '@/components/haptic-tab';
import { SupprTabBar } from '@/components/tabs/SupprTabBar';
import { Accent } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/lib/supabase';

/**
 * Phase 2 / B1.1 — tab structure collapses 6 → 4 (2026-04-27 strategic
 * direction, D-2026-04-27-02). The four primary tabs are:
 *
 *   Today / Recipes / Plan / You
 *
 * Mapping vs the previous 6-tab structure (Today / Discover / Library /
 * Plan / Progress / More):
 *
 *  - Today  → unchanged (`/(tabs)/index`).
 *  - Recipes → groups Library (default sub-tab) + Discover. Tab bar
 *    routes the user to `/(tabs)/library`; the Library and Discover
 *    screens render `<RecipesSubTabHeader>` at the top so users can
 *    flip between them without leaving the Recipes group. Tab-bar
 *    highlight is custom-computed so that being on `/discover` still
 *    highlights the "Recipes" entry.
 *  - Plan → unchanged route; planner now hosts the shopping list as a
 *    sub-tab via `<PlanSubTabHeader>` (the existing Plan/Shop toggle on
 *    web's mobile-web layout was the precedent).
 *  - You → groups Progress (default sub-tab) + Settings + More. Same
 *    sub-tab pattern as Recipes (custom highlight + sub-tab header).
 *
 * `discover`, `progress`, `more`, `settings`, `search`, `barcode`, and
 * `notifications` remain as routable screens but are removed from the
 * tab bar (`href: null`). All existing deep-links (e.g. `/library?from=
 * onboarding`, `useSafeBack("/(tabs)/discover")`, `router.push("/(tabs)
 * /more")` from the household card) continue to resolve.
 *
 * Documentation: `docs/journeys/tab-collapse-2026-04-27.md`.
 */
export default function TabLayout() {
  const { session, loading } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    const PROFILE_ONBOARDING_TIMEOUT_MS = 8000;
    const profileOnboardingQuery = supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', session.user.id)
      .maybeSingle();

    (async () => {
      // Flip `onboardingChecked` after any outcome: success, throw, OR
      // hung network. `try/finally` alone does NOT run `finally` until the
      // awaited promise settles — a PostgREST/client hang would leave the
      // user on the tab spinner forever (`session && !onboardingChecked`).
      // Race against a timeout so the gate always opens; on timeout we keep
      // the default `onboardingCompleted === true` (same as the catch path).
      try {
        const timedOut = Symbol('profile_onboarding_timeout');
        const result = await Promise.race([
          profileOnboardingQuery,
          new Promise<typeof timedOut>((resolve) => {
            setTimeout(() => resolve(timedOut), PROFILE_ONBOARDING_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        if (result === timedOut) return;
        const { data } = result;
        setOnboardingCompleted(data?.onboarding_completed === true);
      } catch {
        // Silent — `onboardingCompleted` stays at its default true.
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  if (loading || (session && !onboardingChecked)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={Accent.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      // 2026-04-30 (customer-lens): centered raised Log button replaces
      // the side `<LogFab>`. The custom `<SupprTabBar>` renders the
      // four primary tabs PLUS a 5th visual element (raised Plus
      // button) between Recipes and Plan. The button is UI-only — no
      // 5th screen route — so the 4-tab IA from D-2026-04-27-02
      // stays intact. Tapping it routes to `/(tabs)?openLog=1` and
      // Today consumes the param to open the canonical `<LogSheet>`.
      tabBar={(props) => <SupprTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Accent.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        // The custom tab bar reads its own height/padding from
        // `useSafeAreaInsets`, but we keep these here as defensive
        // defaults in case any nested screen re-instantiates the
        // stock bar.
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/* Today — unchanged.
          tabBarTestID stable selector for Maestro / e2e (iOS 26 dropped
          the ", tab" VoiceOver suffix that flows used to match against). */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <Sun size={22} color={color} strokeWidth={2.25} />,
          tabBarButtonTestID: 'tab-today',
        }}
      />
      {/* Recipes — primary tab points at Library (the default sub-tab).
          When the user is on /discover, the Recipes entry stays
          highlighted because of the custom listener below; pressing
          the Recipes tab from /discover is a no-op (the sub-tab pill
          inside the screen owns sibling navigation). */}
      <Tabs.Screen
        name="library"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color }) => <BookOpen size={22} color={color} strokeWidth={2} />,
          tabBarAccessibilityLabel: 'Recipes',
          tabBarButtonTestID: 'tab-recipes',
        }}
        listeners={{
          tabPress: (e) => {
            // Tapping the Recipes tab while already on /discover should
            // route to /library (the default sub-tab) so the user
            // returns to a known anchor, not stay on /discover.
            if (pathname.startsWith('/discover')) {
              e.preventDefault();
              router.replace('/(tabs)/library' as never);
            }
          },
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} strokeWidth={2} />,
          tabBarButtonTestID: 'tab-plan',
        }}
      />
      {/* You — primary tab points at Progress (the default sub-tab).
          When on /settings or /more, the You entry stays highlighted. */}
      <Tabs.Screen
        name="progress"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <CircleUser size={22} color={color} strokeWidth={2} />,
          tabBarAccessibilityLabel: 'You',
          tabBarButtonTestID: 'tab-you',
        }}
        listeners={{
          tabPress: (e) => {
            // Pressing You while on /settings or /more returns to /progress.
            if (pathname.startsWith('/settings') || pathname.startsWith('/more')) {
              e.preventDefault();
              router.replace('/(tabs)/progress' as never);
            }
          },
        }}
      />
      {/* Hidden routes — accessible via deep links and sub-tab pills,
          but not surfaced in the tab bar. */}
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="barcode" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      {/* V1 (2026-05-11 visual sweep): /recipes redirects to /library
          so external links matching the tab label resolve correctly. */}
      <Tabs.Screen name="recipes" options={{ href: null }} />
    </Tabs>
  );
}
