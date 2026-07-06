import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, Type } from '@/constants/theme';

/**
 * Full-screen fallback rendered by the root layout when the build has
 * no Supabase config (`hasSupabaseConfig()` false) — without it every
 * fetch fails with RN's generic "Network request failed" and the app
 * looks like a blank grey screen.
 *
 * ENG-1456: the vendor-naming diagnostic (which config keys are
 * missing, where) is dev-only — a production user who somehow hits
 * this gets user-language copy, not our stack. Extracted from
 * `app/_layout.tsx` (screen-budget ratchet).
 */
export function SupabaseNotConfiguredScreen({ resolved }: { resolved: 'light' | 'dark' }) {
  const palette = resolved === 'dark' ? Colors.dark : Colors.light;
  const title = __DEV__ ? 'Supabase is not configured' : 'Something went wrong';
  const body = __DEV__
    ? 'This build is missing `supabaseUrl` and `supabaseAnonKey` under `expo.extra` (see `app.json` or your local `app.config`). Rebuild the dev client after fixing env.'
    : 'Sloe couldn’t start properly. Reinstall or try again later.';
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center', gap: Spacing.dense }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{title}</Text>
        <Text style={{ ...Type.bodyLarge, lineHeight: 22, color: palette.textSecondary }}>
          {body}
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}
