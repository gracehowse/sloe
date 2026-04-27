import { Tabs, Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Flame, Compass, BookOpen, CalendarDays, TrendingUp, CircleUser } from 'lucide-react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Accent } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  const { session, loading } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setOnboardingCompleted(data?.onboarding_completed === true);
      setOnboardingChecked(true);
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
      screenOptions={{
        tabBarActiveTintColor: Accent.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/*
        2026-04-26: Library promoted to a primary tab. Tester feedback:
        "the library (ie recipes the user has saved themselves) are
        harder to access than the main discovery dashboard which is
        random recipes. your own library should be prominent." Order:
        Today → Discover → Library → Plan → Progress → More.

        2026-04-26 (round 3) — tester asked if 6 tabs is too many.
        Evaluated and kept at 6. Each tab earns its slot:
          - Today: critical daily habit, multi-time-per-day usage.
          - Discover: recipe-browse (new content discovery).
          - Library: user's own collection (recipe-organise).
          - Plan: weekly meal-plan orchestrator.
          - Progress: weight trends, journey, body fat, maintenance —
            none of these surface anywhere else.
          - More: settings + account + everything else.

        Considered demoting Progress into More to land at 5 tabs but
        rejected: weight + body composition + adaptive maintenance are
        meaningful destinations that deserve top-level access. MFP,
        Lose It, Yazio all run 5-6 tabs. Tab labels are tight at 9pt
        but readable; bottom-bar height + insets handle smaller phones.
      */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <Flame size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Compass size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <BookOpen size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <CircleUser size={22} color={color} strokeWidth={2} />,
        }}
      />
      {/* Hidden tabs — accessed via navigation, not tab bar */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="barcode" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
