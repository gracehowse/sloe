import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth";

type TodayRouteParams = {
  date?: string;
  _t?: string;
  editMealId?: string;
  openLog?: string;
  /** Activation hook (audit 2026-04-30): set by `notifications-prompt`
   *  + onboarding completion → triggers first-run polish (push
   *  explainer, ring celebration). */
  firstRun?: string;
  /** Onboarding completion routes through here so Today can show
   *  post-onboarding nudges. Older code path. */
  onboarding_complete?: string;
};

export type TodayCompositionRoot = {
  router: ReturnType<typeof useRouter>;
  params: TodayRouteParams;
  insets: ReturnType<typeof useSafeAreaInsets>;
  session: ReturnType<typeof useAuth>["session"];
  userId: string | undefined;
};

export function useToday(): TodayCompositionRoot {
  const router = useRouter();
  const params = useLocalSearchParams<TodayRouteParams>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  return {
    router,
    params,
    insets,
    session,
    userId: session?.user.id,
  };
}
