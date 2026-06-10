/**
 * Mobile household-settings page — 2026-04-20 Claude Design prototype
 * port (mirror of `src/app/components/HouseholdSettingsPage.tsx`).
 *
 * Registered as a top-level Stack screen (expo-router auto-discovery)
 * so it renders full-screen over the bottom-tab bar. Reached from:
 *   - `HouseholdBar` "Manage" link (Plan + Progress).
 *   - "More → Household" row (Profile / More tab).
 *
 * Server-persisted state today is a single `households.share_lunch`
 * boolean; the 7×4 sharing grid is persisted locally via
 * `sharingGridStorage.ts` keyed by household id. `share_lunch` is
 * derived on save so the legal-gated server filter (F-16) stays in
 * lockstep with the grid. The AsyncStorage adapter lives at the
 * bottom of this file — it's the only mobile-specific piece; every
 * helper / preset / grid operation is shared with web.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Cookie,
  Moon,
  Plus,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import {
  getMyHousehold,
  setHouseholdMemberShareTargets,
  setHouseholdShareLunch,
  setMemberSharePreset,
  type HouseholdData,
} from "@suppr/shared/household/householdClient";
import HouseholdInviteSheet from "@/components/household/HouseholdInviteSheet";
import {
  SHARE_TARGETS_TOGGLE_HELPER,
  SHARE_TARGETS_TOGGLE_LABEL,
} from "@suppr/shared/household/scopeCopy";
import {
  HOUSEHOLD_DAY_IDS,
  HOUSEHOLD_SLOT_IDS,
  HOUSEHOLD_SHARING_PRESETS,
  buildGridForPreset,
  cellMembers,
  cycleCell,
  deriveShareLunch,
  emptyGrid,
  fromSchemaSharePreset,
  presetFromShareLunch,
  sharedCellCount,
  toSchemaSharePreset,
  toggleCellMember,
  type HouseholdDayId,
  type HouseholdSharingState,
  type HouseholdSlotId,
} from "@suppr/shared/household/sharingGrid";
import {
  readSharingState,
  writeSharingState,
  type SharingStorageAdapter,
} from "@suppr/shared/household/sharingGridStorage";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "@suppr/shared/household/memberAccents";

/** Sage secondary colour — spec §4 / design-system §2.3 eyebrow colour.
 *  Not in Colors.light (that slot is warm-grey textSecondary #6A6072).
 *  The canonical sage for eyebrows is the --secondary role: #7C8466. */
const SAGE_SECONDARY = "#7C8466";

/** Sheet top radius — design-system §10.3 specifies radius-xl(20pt) for
 *  sheets. theme.ts Radius.xl=12 (card radius), so the sheet value is kept
 *  explicit here until a Radius.sheet(20) token is added (deferred: see
 *  ENG-998 to reconcile the sheet-radius token). */
const SHEET_RADIUS = 20;

const DAY_LABELS: Record<HouseholdDayId, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const SLOT_META: Record<
  HouseholdSlotId,
  { full: string; icon: LucideIcon }
> = {
  // P0-4 (2026-05-01) — lucide swap. Mapping:
  //   cafe-outline       → Coffee
  //   restaurant-outline → UtensilsCrossed
  //   moon-outline       → Moon
  //   nutrition-outline  → Cookie
  // Ionicons are gone from this file — every glyph now matches the
  // rest of the mobile surface (lucide-react-native).
  breakfast: { full: "Breakfast", icon: Coffee },
  lunch: { full: "Lunch", icon: UtensilsCrossed },
  dinner: { full: "Dinner", icon: Moon },
  snack: { full: "Snack", icon: Cookie },
};

/** AsyncStorage adapter — conforms to the shared SharingStorageAdapter. */
const asyncStorageAdapter: SharingStorageAdapter = {
  getItem: async (k) => {
    try {
      return await AsyncStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: async (k, v) => {
    try {
      await AsyncStorage.setItem(k, v);
    } catch {
      // best-effort
    }
  },
  removeItem: async (k) => {
    try {
      await AsyncStorage.removeItem(k);
    } catch {
      // best-effort
    }
  },
};

export default function HouseholdSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the loading spinner,
  // Open-Plan/Invite links, add-member affordance, active selection radios +
  // dots, member-scope chips, and the primary CTAs/toggles. Destructive actions
  // (leave/remove) keep `Accent.destructive`.
  const accent = useAccent();
  // One-card-treatment soft elevation (docs/decisions/2026-06-09-one-card-treatment-
  // soft-elevation.md): the Members / Sharing presets / Privacy / Legend cards all
  // sit directly on the page ground, so they take the SOFT lift, routed through the
  // elevation system (was a hand-rolled `Elevation.cardSoft` on the wrapper + an
  // always-on hairline — the light double-edge is gone; light → shadow only, dark →
  // tonal lift + hairline). The tinted solo-empty invite wash keeps its own chrome.
  const cardElevation = useCardElevation({ variant: "soft" });
  const userId = session?.user?.id ?? null;

  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`, 2026-05-06): the
  // "+ Add" button used to deflect to the Plan tab. Now it opens the
  // invite sheet (email send + sent-invites list + code fallback).
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [sharing, setSharing] = useState<HouseholdSharingState>({
    preset: "dinners",
    grid: emptyGrid(),
  });
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [shareTargetsSaving, setShareTargetsSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<
    | { day: HouseholdDayId; slot: HouseholdSlotId }
    | null
  >(null);
  // Long-press detection — RN has no native onContextMenu so we open
  // the member picker via a timer when the user holds a cell.
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data: result, error: loadErr } = await getMyHousehold(supabase as any, userId);
        if (cancelled) return;
        if (loadErr) {
          setError(loadErr);
        } else if (result) {
          setData(result);
          const hid = result.household?.id;
          if (hid) {
            const memberIds = result.members.map((m) => m.userId);
            const stored = await readSharingState(asyncStorageAdapter, hid);
            if (!cancelled) {
              if (stored) {
                setSharing(stored);
              } else {
                // Netflix-model v1 (2026-05-01) — hydrate from the
                // caller's own `share_preset`, falling back to the
                // legacy `share_lunch` boolean for accounts that
                // haven't saved a preset yet.
                const meRow = result.members.find((m) => m.userId === userId);
                const schemaPreset = meRow?.sharePreset;
                const preset = schemaPreset
                  ? fromSchemaSharePreset(schemaPreset)
                  : presetFromShareLunch(Boolean(result.household?.shareLunch));
                setSharing({ preset, grid: buildGridForPreset(preset, memberIds) });
              }
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Couldn't load household.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);
  const me = useMemo(
    () => members.find((m) => m.userId === userId) ?? null,
    [members, userId],
  );
  const myShareTargets = Boolean(me?.shareTargets);

  const onToggleShareTargets = useCallback(
    async (next: boolean) => {
      if (!userId || shareTargetsSaving) return;
      setShareTargetsSaving(true);
      // Optimistic local flip so the switch feels instant; revert on
      // failure. The shared client writes through RLS (policy
      // "Members can update own share_targets" — scoped to user_id =
      // auth.uid()), so a tampered request against another user's row
      // silently matches zero rows and surfaces update_failed.
      const previous = data;
      setData((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.userId === userId
                  ? {
                      ...m,
                      shareTargets: next,
                      // When opting out we can't reconstruct remaining
                      // from state alone — a reload after save will
                      // paint the self row correctly; keep remaining
                      // in place for the caller's own row which is
                      // always revealed to themselves.
                    }
                  : m,
              ),
            }
          : prev,
      );
      try {
        const { error: updErr } = await setHouseholdMemberShareTargets(
          supabase as any,
          userId,
          next,
        );
        if (updErr) {
          setData(previous);
          Alert.alert(
            "Couldn't update",
            "Target sharing could not be saved. Please try again.",
          );
        }
      } catch (e) {
        setData(previous);
        Alert.alert("Couldn't update", (e as Error).message || "Please try again.");
      } finally {
        setShareTargetsSaving(false);
      }
    },
    [userId, data, shareTargetsSaving],
  );

  const setPreset = useCallback(
    (p: (typeof HOUSEHOLD_SHARING_PRESETS)[number]["id"]) => {
      if (p === "custom") {
        setSharing((s) => ({ ...s, preset: "custom" }));
        return;
      }
      setSharing({ preset: p, grid: buildGridForPreset(p, memberIds) });
    },
    [memberIds],
  );

  const onCycle = useCallback(
    (day: HouseholdDayId, slot: HouseholdSlotId) => {
      setSharing((s) => ({
        preset: "custom",
        grid: cycleCell(s.grid, day, slot, memberIds),
      }));
    },
    [memberIds],
  );

  const onToggleMember = useCallback(
    (day: HouseholdDayId, slot: HouseholdSlotId, memberId: string) => {
      setSharing((s) => ({
        preset: "custom",
        grid: toggleCellMember(s.grid, day, slot, memberId),
      }));
    },
    [],
  );

  const onSave = useCallback(async () => {
    if (!data?.household?.id || !userId) return;
    setSaving(true);
    setError(null);
    try {
      await writeSharingState(asyncStorageAdapter, data.household.id, sharing);
      // Netflix-model v1 (2026-05-01) — per-member preset write.
      // Supersedes the owner-level `share_lunch` boolean as the
      // meal-label filter; kept in step for legacy readers.
      const schemaPreset = toSchemaSharePreset(sharing.preset);
      const { error: presetErr } = await setMemberSharePreset(
        supabase as any,
        userId,
        schemaPreset,
      );
      if (presetErr) {
        Alert.alert("Couldn't save on server", "Your sharing preference could not be updated.");
      }
      const nextShareLunch = deriveShareLunch(sharing.grid);
      if (Boolean(data.household.shareLunch) !== nextShareLunch && data.household.isOwner) {
        await setHouseholdShareLunch(
          supabase as any,
          data.household.id,
          nextShareLunch,
        );
      }
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 1800);
    } catch (e) {
      setError((e as Error).message || "Couldn't save household settings.");
    } finally {
      setSaving(false);
    }
  }, [data, sharing, userId]);

  if (!userId) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: Spacing.lg, backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          Sign in to manage your household.
        </Text>
      </View>
    );
  }

  if (loading) {
    // Audit 2026-05-04 #17: previous loading state was a single line of
    // grey text top-left with no spinner, no back chevron, no tab bar —
    // looked like a hung route with no escape. Now: centred indicator
    // and a back affordance so the user can always retreat.
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: Spacing.dense,
            paddingBottom: Spacing.sm,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={26} color={colors.text} strokeWidth={1.75} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.dense }}>
          <ActivityIndicator size="large" color={accent.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading household…</Text>
        </View>
      </View>
    );
  }

  const household = data?.household ?? null;
  const totalCells = HOUSEHOLD_DAY_IDS.length * HOUSEHOLD_SLOT_IDS.length;
  const sharedCount = sharedCellCount(sharing.grid);
  const editingMeta = editingCell
    ? {
        day: editingCell.day,
        slot: editingCell.slot,
        slotFull: SLOT_META[editingCell.slot].full,
        dayLabel: DAY_LABELS[editingCell.day],
      }
    : null;

  return (
    <View testID="screen-household-settings" style={{ flex: 1, backgroundColor: colors.background }}>
      {/* F-63d (2026-04-22): hide the auto-generated router header
          so the in-content "Household" header isn't duplicated by an
          "Household Settings" nav bar above it. Tester AHitOL0R
          flagged the spacing as "a little off — move up"; the root
          cause was two stacked titles eating ~80pt of vertical space
          before any content rendered. */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: Spacing.lg,
        }}
      >
        {/* Header with back chevron */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={22} color={colors.text} strokeWidth={1.75} />
          </Pressable>
          <Text style={{ fontFamily: FontFamily.serifSemibold, fontSize: 28, fontWeight: "600", color: colors.text, letterSpacing: -0.3, lineHeight: 32 }}>
            Household
          </Text>
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            style={{
              marginBottom: Spacing.md,
              padding: Spacing.md,
              borderRadius: Radius.md,
              borderColor: Accent.destructive + "55",
              borderWidth: 1,
              backgroundColor: Accent.destructive + "14",
            }}
          >
            <Text style={{ fontSize: 12, color: Accent.destructiveSolid }}>{error}</Text>
          </View>
        ) : null}

        {!household ? (
          <View
            style={[
              cardElevation.shadowStyle ?? {},
              {
                borderRadius: Radius.lg,
                borderWidth: cardElevation.useBorder ? 1 : 0,
                borderColor: colors.cardBorder,
                backgroundColor: cardElevation.liftBg ?? colors.card,
                padding: Spacing.md,
              },
            ]}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: Spacing.sm - 2 }}>
              No household yet
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: Spacing.sm + 2 }}>
              Create or join a household from the Plan tab. Sharing settings show up here once
              you&apos;re part of one.
            </Text>
            <Pressable onPress={() => router.replace("/(tabs)/planner" as any)}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: accent.primarySolid }}>Open Plan</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Premium-bar audit Group J line 443 — solo-household empty
                state. When the user is the only member, the rest of
                the screen (sharing presets + 7×4 grid + legend) is
                technically functional but meaningless: there's no one
                to share with. Surface a prominent, friendly invite
                card at the top so the next action is obvious. Below
                it the existing sections still render so the user can
                preview what they'll get once a second member joins. */}
            {members.length <= 1 ? (
              // Outer wrapper carries the soft lift via the elevation system; inner
              // View clips border+overflow. RN overflow:hidden clips iOS shadows so
              // they must live on separate Views. The tinted lilac invite wash keeps
              // its own accent bg + border (a deliberate accent, not neutral chrome).
              <View
                testID="household-settings-solo-empty"
                style={[
                  cardElevation.shadowStyle ?? {},
                  {
                    borderRadius: Radius.lg,
                    marginBottom: Spacing.md,
                  },
                ]}
              >
                <View
                  style={{
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: accent.primary + "33",
                    backgroundColor: accent.primary + "0d",
                    padding: Spacing.md,
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: Radius.full,
                      backgroundColor: accent.primary + "1f",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: Spacing.sm,
                    }}
                  >
                    <Plus size={22} color={accent.primary} strokeWidth={2.25} />
                  </View>
                  {/* §10.7 empty-state: headline in Newsreader italic (editorial register) */}
                  <Text
                    style={{
                      fontFamily: FontFamily.serifItalic,
                      fontSize: 16,
                      color: colors.text,
                      marginBottom: Spacing.xs,
                      textAlign: "center",
                    }}
                  >
                    Household is solo
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 17,
                      marginBottom: Spacing.md,
                      paddingHorizontal: Spacing.sm,
                    }}
                  >
                    Invite a partner, flatmate, or family member to share
                    meal plans and shopping lists.
                  </Text>
                  {/* Invite — secondary action → off-white fill (Sloe
                      treatment #3, 2026-06-08). Invite is a secondary action
                      (not the conversion CTA), so it reads as an off-white
                      slab with an aubergine glyph + ink label rather than a
                      filled accent button. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Invite a household member"
                    testID="household-settings-solo-invite"
                    onPress={() => setInviteSheetOpen(true)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.sm,
                      paddingHorizontal: Spacing.lg,
                      paddingVertical: Spacing.sm + 2,
                      borderRadius: Radius.md,
                      backgroundColor: colors.card,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Plus size={16} color={accent.primarySolid} strokeWidth={2.25} />
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                      Invite
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Members */}
            <View style={{ marginBottom: Spacing.md }} testID="household-settings-members">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: Spacing.sm,
                }}
              >
                {/* Eyebrow: Type.label token (sage #7C8466, letterSpacing 0.88, uppercase) */}
                <Text style={[Type.label, { color: SAGE_SECONDARY }]}>
                  Members
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Invite a household member"
                  testID="household-settings-add"
                  onPress={() => setInviteSheetOpen(true)}
                  hitSlop={Spacing.sm}
                  style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}
                >
                  <Plus size={14} color={accent.primarySolid} strokeWidth={2} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: accent.primarySolid }}>Invite</Text>
                </Pressable>
              </View>
              {/* Outer wrapper carries the soft lift (elevation system); inner clips border+overflow */}
              <View style={[cardElevation.shadowStyle ?? {}, { borderRadius: Radius.lg }]}>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: cardElevation.useBorder ? 1 : 0,
                  borderColor: colors.cardBorder,
                  backgroundColor: cardElevation.liftBg ?? colors.card,
                  overflow: "hidden",
                }}
              >
                {members.map((m, idx) => {
                  const color = householdMemberAccent(idx);
                  const initials = householdMemberInitials(m.displayName);
                  const isSelf = m.userId === userId;
                  const isLast = idx === members.length - 1;
                  const macroCopy = isSelf && m.targets
                    ? `${m.targets.calories} kcal · ${m.targets.protein}g protein`
                    : m.role === "owner"
                      ? "Owner"
                      : "Member";
                  // 2026-05-02 chevron-fix: own row routes to /targets so
                  // the chevron is no longer dead on tap (user feedback,
                  // claude/household-section-streak-sidebar-bundle). For
                  // other members the row is non-interactive — no
                  // chevron, no Pressable — until a read-only member
                  // detail surface ships. Removing the affordance
                  // matches the lack of destination so we don't lie
                  // about tappability.
                  const rowProps = {
                    style: {
                      flexDirection: "row" as const,
                      alignItems: "center" as const,
                      gap: Spacing.sm,
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.md,
                      minHeight: 44,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.cardBorder,
                    },
                  };
                  const inner = (
                    <>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: Radius.full,
                          backgroundColor: color,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, flexWrap: "wrap" }}>
                          {/* §3.12 identity row: display name in Newsreader serif (Type.headline) */}
                          <Text style={[Type.headline, { color: colors.text }]} numberOfLines={1}>
                            {m.displayName}
                          </Text>
                          {/* §3.12 "You" pill on the self row — dignified identity signal */}
                          {isSelf ? (
                            <View
                              style={{
                                paddingHorizontal: Spacing.sm,
                                paddingVertical: 2,
                                borderRadius: Radius.full,
                                backgroundColor: accent.primarySoft,
                              }}
                            >
                              <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 10, color: accent.primarySolid }}>
                                You
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontWeight: "400", fontSize: 11, color: colors.textTertiary }}>
                              · {m.role}
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                          {macroCopy}
                        </Text>
                      </View>
                      {isSelf ? (
                        <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
                      ) : null}
                    </>
                  );
                  if (isSelf) {
                    return (
                      <Pressable
                        key={m.userId}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit your targets — ${m.displayName}`}
                        testID={`household-settings-member-row-${m.userId}`}
                        onPress={() => router.push("/targets" as any)}
                        {...rowProps}
                      >
                        {inner}
                      </Pressable>
                    );
                  }
                  return (
                    <View
                      key={m.userId}
                      testID={`household-settings-member-row-${m.userId}`}
                      {...rowProps}
                    >
                      {inner}
                    </View>
                  );
                })}
              </View>
              </View>
            </View>

            {/* Privacy — per-member share_targets opt-in (H4, 2026-04-21) */}
            <View style={{ marginBottom: Spacing.md }} testID="household-settings-privacy">
              {/* Eyebrow: Type.label token (sage secondary) */}
              <Text style={[Type.label, { color: SAGE_SECONDARY, marginBottom: Spacing.sm }]}>
                Privacy
              </Text>
              {/* Outer wrapper carries the soft lift (elevation system); inner clips border */}
              <View style={[cardElevation.shadowStyle ?? {}, { borderRadius: Radius.lg }]}>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: cardElevation.useBorder ? 1 : 0,
                  borderColor: colors.cardBorder,
                  backgroundColor: cardElevation.liftBg ?? colors.card,
                  padding: Spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
                    {SHARE_TARGETS_TOGGLE_LABEL}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      marginTop: 4,
                      lineHeight: 15,
                    }}
                  >
                    {SHARE_TARGETS_TOGGLE_HELPER}
                  </Text>
                </View>
                <Switch
                  value={myShareTargets}
                  onValueChange={(v) => void onToggleShareTargets(v)}
                  disabled={shareTargetsSaving || !me}
                  accessibilityLabel={SHARE_TARGETS_TOGGLE_LABEL}
                  testID="household-settings-share-targets"
                />
              </View>
              </View>
            </View>

            {/* Presets */}
            <View style={{ marginBottom: Spacing.md }}>
              {/* Eyebrow: Type.label token (sage secondary) */}
              <Text style={[Type.label, { color: SAGE_SECONDARY, marginBottom: Spacing.sm }]}>
                Which meals are shared?
              </Text>
              {/* Outer wrapper carries the soft lift (elevation system); inner clips border+overflow */}
              <View style={[cardElevation.shadowStyle ?? {}, { borderRadius: Radius.lg }]}>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: cardElevation.useBorder ? 1 : 0,
                  borderColor: colors.cardBorder,
                  backgroundColor: cardElevation.liftBg ?? colors.card,
                  overflow: "hidden",
                }}
              >
                {HOUSEHOLD_SHARING_PRESETS.map((p, i) => {
                  const active = sharing.preset === p.id;
                  const isLast = i === HOUSEHOLD_SHARING_PRESETS.length - 1;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPreset(p.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      testID={`household-preset-${p.id}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.sm,
                        paddingHorizontal: Spacing.md,
                        paddingVertical: Spacing.md,
                        minHeight: 44,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: colors.cardBorder,
                        backgroundColor: active ? accent.primary + "10" : "transparent",
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: active ? accent.primary : colors.cardBorder,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {active ? (
                          <View
                            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent.primary }}
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{p.label}</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                          {p.sub}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              </View>
            </View>

            {/* Grid */}
            <View style={{ marginBottom: Spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: Spacing.sm,
                }}
              >
                {/* Eyebrow: Type.label token (sage secondary) */}
                <Text style={[Type.label, { color: SAGE_SECONDARY }]}>
                  Weekly plan
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }} testID="household-grid-summary">
                  {sharedCount} of {totalCells} shared
                </Text>
              </View>
              {/* Outer wrapper carries the soft lift (elevation system); inner clips border */}
              <View style={[cardElevation.shadowStyle ?? {}, { borderRadius: Radius.lg }]}>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: cardElevation.useBorder ? 1 : 0,
                  borderColor: colors.cardBorder,
                  backgroundColor: cardElevation.liftBg ?? colors.card,
                  padding: Spacing.md,
                }}
              >
                {/* Column headers */}
                <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                  <View style={{ width: 28 }} />
                  {HOUSEHOLD_DAY_IDS.map((d) => (
                    <View key={d} style={{ flex: 1, alignItems: "center" }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "600",
                          letterSpacing: 0.5,
                          color: colors.textTertiary,
                          textTransform: "uppercase",
                        }}
                      >
                        {DAY_LABELS[d]}
                      </Text>
                    </View>
                  ))}
                </View>
                {HOUSEHOLD_SLOT_IDS.map((s) => (
                  <View key={s} style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                    <View style={{ width: 28, alignItems: "center", justifyContent: "center" }}>
                      {(() => {
                        const Icon = SLOT_META[s].icon;
                        return (
                          <Icon
                            size={14}
                            color={colors.textSecondary}
                            strokeWidth={1.75}
                          />
                        );
                      })()}
                    </View>
                    {HOUSEHOLD_DAY_IDS.map((d) => {
                      const mem = cellMembers(sharing.grid, d, s);
                      const count = mem.length;
                      const all = members.length;
                      const isAll = count === all && all > 0;
                      const isSome = count > 1 && count < all;
                      const bg = isAll
                        ? accent.primary + "33"
                        : isSome
                          ? accent.primary + "1a"
                          : colors.inputBg;
                      const fg = isAll || isSome ? accent.primary : colors.textTertiary;
                      const border = isAll || isSome ? accent.primary + "4d" : "transparent";
                      return (
                        <Pressable
                          key={`${d}-${s}`}
                          testID={`household-grid-cell-${d}-${s}`}
                          onPressIn={() => {
                            didLongPressRef.current = false;
                            if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                            pressTimerRef.current = setTimeout(() => {
                              didLongPressRef.current = true;
                              setEditingCell({ day: d, slot: s });
                            }, 400);
                          }}
                          onPressOut={() => {
                            if (pressTimerRef.current) {
                              clearTimeout(pressTimerRef.current);
                              pressTimerRef.current = null;
                            }
                          }}
                          onPress={() => {
                            if (didLongPressRef.current) {
                              didLongPressRef.current = false;
                              return;
                            }
                            onCycle(d, s);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${SLOT_META[s].full} ${DAY_LABELS[d]} — ${
                            count === 0 ? "solo" : isAll ? "everyone" : `${count} people`
                          }`}
                          style={{
                            flex: 1,
                            height: 44,
                            borderRadius: Radius.lg,
                            backgroundColor: bg,
                            borderWidth: 1,
                            borderColor: border,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: fg,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {count === 0 ? "·" : isAll ? "All" : String(count)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: Spacing.sm, lineHeight: 15 }}>
                  Tap a cell to toggle between solo and everyone. Long-press to pick specific members.
                </Text>
              </View>
              </View>

              {/* Legend */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm }}>
                {members.map((m, idx) => (
                  <View
                    key={m.userId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.sm,
                      paddingVertical: Spacing.xs,
                      paddingLeft: Spacing.xs,
                      paddingRight: Spacing.sm + 2,
                      borderRadius: Radius.full,
                      backgroundColor: colors.inputBg,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: Radius.full,
                        backgroundColor: householdMemberAccent(idx),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
                        {householdMemberInitials(m.displayName)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textSecondary }}>
                      {householdMemberFirstName(m.displayName)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Save — sticky footer */}
      {household ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.md,
            paddingTop: Spacing.sm,
            backgroundColor: colors.background + "ee",
          }}
        >
          {/* Save changes — aubergine OUTLINE (Sloe treatment #1,
              2026-06-08). The everyday primary CTA is an accent line on a
              white backing (the sticky footer behind it is translucent, so
              the button fills white to stay crisp), 1.5px border +
              `accent.primarySolid` label. */}
          <Pressable
            onPress={() => void onSave()}
            disabled={saving || !household.isOwner}
            testID="household-settings-save"
            accessibilityRole="button"
            accessibilityLabel="Save household settings"
            style={{
              paddingVertical: Spacing.md,
              borderRadius: Radius.lg,
              backgroundColor: colors.card,
              borderWidth: 1.5,
              borderColor: accent.primarySolid,
              alignItems: "center",
              opacity: saving || !household.isOwner ? 0.5 : 1,
            }}
          >
            <Text style={{ color: accent.primarySolid, fontSize: 14, fontWeight: "700" }}>
              {/* DC12 (2026-05-14, premium-bar audit) — specific
                  confirmation. The button is "Save changes" so the
                  affirmed state should mirror that, not the generic
                  "Saved". */}
              {saving ? "Saving…" : savedToast ? "Household saved" : "Save changes"}
            </Text>
          </Pressable>
          {!household.isOwner ? (
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.sm, textAlign: "center" }}>
              Only the household owner can change sharing.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Member picker modal */}
      <Modal
        visible={editingMeta != null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingCell(null)}
      >
        <Pressable
          onPress={() => setEditingCell(null)}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              paddingHorizontal: Spacing.lg,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder, alignSelf: "center", marginBottom: Spacing.md }} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: Spacing.xs }}>
              Who&apos;s eating?
            </Text>
            {editingMeta ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: Spacing.md }}>
                {editingMeta.slotFull} · {editingMeta.dayLabel}
              </Text>
            ) : null}
            {editingCell
              ? members.map((m, idx) => {
                  const on = cellMembers(sharing.grid, editingCell.day, editingCell.slot).includes(
                    m.userId,
                  );
                  const color = householdMemberAccent(idx);
                  return (
                    <Pressable
                      key={m.userId}
                      onPress={() => onToggleMember(editingCell.day, editingCell.slot, m.userId)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.sm,
                        paddingVertical: Spacing.sm,
                        paddingHorizontal: Spacing.xs,
                        minHeight: 44,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.cardBorder,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: color,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>
                          {householdMemberInitials(m.displayName)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
                          {m.displayName}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                          {m.role === "owner" ? "Owner" : "Member"}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          borderWidth: 2,
                          borderColor: on ? accent.primary : colors.cardBorder,
                          backgroundColor: on ? accent.primary : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {on ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                      </View>
                    </Pressable>
                  );
                })
              : null}
            <Pressable
              onPress={() => setEditingCell(null)}
              style={{
                marginTop: Spacing.md,
                paddingVertical: Spacing.sm,
                minHeight: 44,
                borderRadius: Radius.md,
                backgroundColor: colors.inputBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* F-111 invite sheet — opens from the Members section "+ Invite"
          button. Sends email-targeted invites via the
          household_invite_send RPC; falls back to the 6-char code. */}
      {data?.household && (
        <HouseholdInviteSheet
          visible={inviteSheetOpen}
          householdId={data.household.id}
          inviteCode={data.household.invite_code}
          onClose={() => setInviteSheetOpen(false)}
        />
      )}
    </View>
  );
}
