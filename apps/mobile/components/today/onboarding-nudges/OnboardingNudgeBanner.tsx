import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BookOpen, Heart, Link2 } from "lucide-react-native";

import { FontWeight, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { requestHealthPermissions } from "@/lib/healthSync";
import {
  markNotificationsPromptDismissed,
  registerExpoPushTokenForUser,
} from "@/lib/expoPushToken";
import { supabase } from "@/lib/supabase";

import { useNextNudge } from "./useNextNudge";
import type { NudgeEligibilityState, OnboardingNudgeId } from "./types";

/**
 * Post-launch onboarding nudge banner — Today tab, just below the
 * calorie ring.
 *
 * Three nudges, one at a time, in priority order: permissions → import
 * → recipes (`./nudges.ts`). Each banner gets a 7- or 14-day cooldown
 * on "Maybe later"; the permissions nudge additionally drops from the
 * queue permanently once the user has answered the OS prompt — the
 * system answer is authoritative and re-asking via this banner would
 * be noise.
 *
 * The hook (`useNextNudge`) owns hydration + dismissal persistence;
 * this component owns presentation + the per-id primary action wiring.
 *
 * Platform: iOS-only by design. Apple Health is iOS-native, and the
 * decision to defer these three nudges to a Today queue (rather than
 * keep them in the linear onboarding) is documented in
 * `docs/decisions/2026-04-30-onboarding-shrink-15-to-12.md`. Web has
 * no equivalent surface — see `./types.ts` for the rationale.
 */

/**
 * Run the primary action for the given nudge. Reuses the same OS-
 * permission paths as `apps/mobile/components/onboarding/steps/permissions.tsx`
 * so granting Health / Notifications goes through the real iOS sheets,
 * not a local flag.
 *
 * The catalogue's `removeOnAction: true` flag (set on `permissions`)
 * is what permanently removes that banner once the user has answered
 * the OS prompt — see `./nudges.ts` and the `markDismissed` writer in
 * `./useNextNudge.ts`. The action handler does not write the removal
 * flag itself.
 */
async function runPrimaryAction(
  id: OnboardingNudgeId,
  ctx: {
    userId: string | null;
    routerPush: (href: string) => void;
  },
): Promise<void> {
  switch (id) {
    case "permissions": {
      // Mirror the onboarding step's two-stage prompt: HealthKit first
      // (iOS only — Health is iOS-native; Android has nothing to grant
      // even though we ship iOS-only today), then Notifications. The
      // user's answer to either is recorded by the OS; the catalogue's
      // `removeOnAction: true` rule drops this banner from the queue
      // afterwards regardless of grant/deny — re-asking via this surface
      // would talk past the answer.
      try {
        if (Platform.OS === "ios") {
          await requestHealthPermissions();
        }
      } catch (err) {
        console.warn("[onboarding-nudges] requestHealthPermissions threw", err);
      }
      try {
        const Notifications = await import("expo-notifications");
        const existing = await Notifications.getPermissionsAsync();
        const next =
          existing.status === "granted"
            ? existing
            : await Notifications.requestPermissionsAsync();
        if (next.status === "granted") {
          await registerExpoPushTokenForUser(ctx.userId);
        }
        await markNotificationsPromptDismissed();
      } catch (err) {
        console.warn("[onboarding-nudges] notifications request threw", err);
      }
      return;
    }
    case "import": {
      ctx.routerPush("/import-shared");
      return;
    }
    case "recipes": {
      ctx.routerPush("/(tabs)/library");
      return;
    }
  }
}

const NUDGE_ICON: Record<
  OnboardingNudgeId,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  permissions: Heart,
  import: Link2,
  recipes: BookOpen,
};

const NUDGE_ACCESSIBILITY_LABEL: Record<OnboardingNudgeId, string> = {
  permissions: "Connect Apple Health and notifications",
  import: "Try importing a recipe",
  recipes: "Browse recipes to seed your library",
};

export type OnboardingNudgeBannerProps = {
  /**
   * Number of meals logged today. The host (Today screen) also gates
   * the entire mount on `mealsToday.length >= 1`; this is passed in for
   * predicate completeness.
   */
  mealsTodayCount: number;
  /**
   * Total recipes in the user's saved library. Drives the import +
   * recipes nudge eligibility.
   */
  libraryCount: number;
};

/**
 * Wave-2 (2026-04-30 audit-vs-competitors): each nudge now carries a
 * runtime eligibility predicate (`./types.ts → NudgeEligibilityState`).
 * The banner resolves the parts of state that don't already live on the
 * Today screen (lifetime meal count + OS notifications status) here, so
 * the host doesn't have to know about HK / notifications plumbing.
 */
export function OnboardingNudgeBanner({
  mealsTodayCount,
  libraryCount,
}: OnboardingNudgeBannerProps) {
  const { session } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the nudge card tint,
  // icon, and primary CTA. Read before the early return so the hook is stable.
  const accent = useAccent();
  const userId = session?.user?.id ?? null;
  const [busy, setBusy] = React.useState(false);

  // Resolve the eligibility-only state: lifetime meal count (Supabase)
  // + notifications permission status (OS). Both default to "unknown"
  // until resolved so a nudge that depends on them stays hidden until
  // we have an authoritative answer — never flash a stale prompt.
  const [lifetimeMealCount, setLifetimeMealCount] = React.useState<number | null>(null);
  const [notificationsPermissionStatus, setNotificationsPermissionStatus] = React.useState<
    "granted" | "denied" | "undetermined" | null
  >(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!userId) {
      // No session → nothing to gate against. Treat as zero so the
      // permissions nudge stays hidden (its eligibility requires >= 3).
      setLifetimeMealCount(0);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const { count, error } = await supabase
          .from("nutrition_entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        if (cancelled) return;
        if (error) {
          // On error, leave count unknown — the permissions nudge
          // predicate treats `null` as not-yet-eligible, which is the
          // safer floor.
          console.warn("[onboarding-nudges] failed to load lifetime meal count", error);
          setLifetimeMealCount(null);
          return;
        }
        setLifetimeMealCount(typeof count === "number" ? count : 0);
      } catch (err) {
        if (cancelled) return;
        console.warn("[onboarding-nudges] lifetime meal count threw", err);
        setLifetimeMealCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        const result = await Notifications.getPermissionsAsync();
        if (cancelled) return;
        const status = result.status;
        if (status === "granted" || status === "denied" || status === "undetermined") {
          setNotificationsPermissionStatus(status);
        } else {
          // Unknown OS status — treat as undetermined so the nudge can
          // still ask. Underlying request handler is idempotent.
          setNotificationsPermissionStatus("undetermined");
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[onboarding-nudges] getPermissionsAsync threw", err);
        // Leave null — predicate treats null as not-yet-eligible.
        setNotificationsPermissionStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const eligibilityState: NudgeEligibilityState = React.useMemo(
    () => ({
      mealsTodayCount,
      libraryCount,
      lifetimeMealCount,
      notificationsPermissionStatus,
    }),
    [mealsTodayCount, libraryCount, lifetimeMealCount, notificationsPermissionStatus],
  );

  const { nudge, markDismissed } = useNextNudge(eligibilityState);

  const onPrimary = React.useCallback(async () => {
    if (!nudge || busy) return;
    setBusy(true);
    try {
      await runPrimaryAction(nudge.id, {
        userId,
        // expo-router's `push` accepts a string `Href`. We accept any
        // path the catalogue wires through `runPrimaryAction` so the
        // action handler stays string-typed — adding a typed-route layer
        // would force every nudge to import `Href` for one route.
        routerPush: (href) => router.push(href as never),
      });
      // Record dismissal so the cooldown gate kicks in. For nudges with
      // `removeOnAction: true` (currently `permissions`) the hook also
      // writes the permanent-removal flag, so the banner never reappears
      // even after the cooldown elapses — see `./useNextNudge.ts`.
      await markDismissed(nudge.id, "primary");
    } finally {
      setBusy(false);
    }
  }, [nudge, busy, userId, router, markDismissed]);

  const onLater = React.useCallback(async () => {
    if (!nudge || busy) return;
    setBusy(true);
    try {
      await markDismissed(nudge.id, "later");
    } finally {
      setBusy(false);
    }
  }, [nudge, busy, markDismissed]);

  if (!nudge) return null;

  const Icon = NUDGE_ICON[nudge.id];

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={NUDGE_ACCESSIBILITY_LABEL[nudge.id]}
      style={{
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.md,
        backgroundColor: accent.primary + "0A",
        borderWidth: 1,
        borderColor: accent.primary + "30",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Spacing.sm,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: Radius.sm,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent.primary + "1A",
          }}
        >
          <Icon size={16} color={accent.primary} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              // Spec: 15pt bold — between Type.body (14/500) and
              // Type.headline (17/700). Banner sits below the calorie
              // ring and competes with macro-tile labels; 15pt reads as
              // a card heading without rivalling the ring number.
              // eslint-disable-next-line no-restricted-syntax
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: colors.text,
              letterSpacing: -0.2,
            }}
          >
            {nudge.title}
          </Text>
          <Text
            style={{
              // Spec: 13pt secondary — pairs with the 15pt title above
              // for the small-card cadence. Type.body (14) reads too
              // assertive at this density.
              // eslint-disable-next-line no-restricted-syntax
              fontSize: 13,
              color: colors.textSecondary,
              // 2px nudges body up tight to the title — Spacing.xs (4)
              // is too loose for this stacked-card cadence.
              // eslint-disable-next-line no-restricted-syntax
              marginTop: 2,
              lineHeight: 18,
            }}
          >
            {nudge.body}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: Spacing.sm,
          marginTop: Spacing.md,
          alignItems: "center",
        }}
      >
        {/* Sloe treatment system (2026-06-08): primary inline CTA →
            aubergine outline (transparent fill + 1.5px primarySolid border
            + primarySolid label), not a filled slab. The "Later" sibling
            below stays a tertiary text dismiss. */}
        <Pressable
          onPress={() => void onPrimary()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${nudge.primaryLabel} — ${nudge.title}`}
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => ({
            paddingHorizontal: Spacing.lg,
            height: 36,
            // ENG-1064 (TF57 F-167): was `Radius.sm + 2` (6) — off-scale
            // arithmetic. Snap to the canonical Today outline-CTA radius
            // `Radius.sm` (4) so this matches the empty-state / eat-again
            // outline buttons.
            borderRadius: Radius.sm,
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: accent.primarySolid,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.6 : pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: accent.primarySolid,
              // eslint-disable-next-line no-restricted-syntax
              fontSize: 13,
              fontWeight: FontWeight.bold,
            }}
          >
            {nudge.primaryLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void onLater()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Maybe later — ${nudge.title}`}
          accessibilityState={{ disabled: busy }}
          hitSlop={8}
          style={({ pressed }) => ({
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.xs,
            opacity: busy ? 0.6 : pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              // eslint-disable-next-line no-restricted-syntax
              fontSize: 13,
              fontWeight: FontWeight.semibold,
              color: colors.textSecondary,
            }}
          >
            Maybe later
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default OnboardingNudgeBanner;
