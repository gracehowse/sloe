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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  getMyHousehold,
  setHouseholdMemberShareTargets,
  setHouseholdShareLunch,
  type HouseholdData,
} from "../../../src/lib/household/householdClient";
import {
  SHARE_TARGETS_TOGGLE_HELPER,
  SHARE_TARGETS_TOGGLE_LABEL,
} from "../../../src/lib/household/scopeCopy";
import {
  HOUSEHOLD_DAY_IDS,
  HOUSEHOLD_SLOT_IDS,
  HOUSEHOLD_SHARING_PRESETS,
  buildGridForPreset,
  cellMembers,
  cycleCell,
  deriveShareLunch,
  emptyGrid,
  presetFromShareLunch,
  sharedCellCount,
  toggleCellMember,
  type HouseholdDayId,
  type HouseholdSharingState,
  type HouseholdSlotId,
} from "../../../src/lib/household/sharingGrid";
import {
  readSharingState,
  writeSharingState,
  type SharingStorageAdapter,
} from "../../../src/lib/household/sharingGridStorage";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "../../../src/lib/household/memberAccents";

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
  { full: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  breakfast: { full: "Breakfast", icon: "cafe-outline" },
  lunch: { full: "Lunch", icon: "restaurant-outline" },
  dinner: { full: "Dinner", icon: "moon-outline" },
  snack: { full: "Snack", icon: "nutrition-outline" },
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
  const userId = session?.user?.id ?? null;

  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
                const preset = presetFromShareLunch(Boolean(result.household?.shareLunch));
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
    if (!data?.household?.id) return;
    setSaving(true);
    setError(null);
    try {
      await writeSharingState(asyncStorageAdapter, data.household.id, sharing);
      const nextShareLunch = deriveShareLunch(sharing.grid);
      if (Boolean(data.household.shareLunch) !== nextShareLunch && data.household.isOwner) {
        const { error: updErr } = await setHouseholdShareLunch(
          supabase as any,
          data.household.id,
          nextShareLunch,
        );
        if (updErr) {
          Alert.alert("Couldn't save on server", "Lunch sharing could not be updated.");
        }
      }
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 1800);
    } catch (e) {
      setError((e as Error).message || "Couldn't save household settings.");
    } finally {
      setSaving(false);
    }
  }, [data, sharing]);

  if (!userId) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 20, backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          Sign in to manage your household.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 20, backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading household…</Text>
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          paddingHorizontal: 20,
        }}
      >
        {/* Header with back chevron */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.2 }}>
            Household
          </Text>
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: Radius.md,
              borderColor: Accent.destructive + "55",
              borderWidth: 1,
              backgroundColor: Accent.destructive + "14",
            }}
          >
            <Text style={{ fontSize: 12, color: Accent.destructive }}>{error}</Text>
          </View>
        ) : null}

        {!household ? (
          <View
            style={{
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: colors.card,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 6 }}>
              No household yet
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 10 }}>
              Create or join a household from the Plan tab. Sharing settings show up here once
              you&apos;re part of one.
            </Text>
            <Pressable onPress={() => router.replace("/(tabs)/planner" as any)}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Accent.primary }}>Open Plan</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Members */}
            <View style={{ marginBottom: 18 }} testID="household-settings-members">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.4,
                    color: colors.textTertiary,
                    textTransform: "uppercase",
                  }}
                >
                  Members
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add household member"
                  testID="household-settings-add"
                  onPress={() => router.push("/(tabs)/planner" as any)}
                  hitSlop={6}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Ionicons name="add" size={14} color={Accent.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: Accent.primary }}>Add</Text>
                </Pressable>
              </View>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.card,
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
                  return (
                    <View
                      key={m.userId}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: colors.cardBorder,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: color,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }} numberOfLines={1}>
                          {m.displayName}
                          {isSelf ? " (you)" : ""}
                          <Text style={{ fontWeight: "400", fontSize: 11, color: colors.textTertiary }}>
                            {" · "}
                            {m.role}
                          </Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                          {macroCopy}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Privacy — per-member share_targets opt-in (H4, 2026-04-21) */}
            <View style={{ marginBottom: 18 }} testID="household-settings-privacy">
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1.4,
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Privacy
              </Text>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.card,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
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

            {/* Presets */}
            <View style={{ marginBottom: 14 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1.4,
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Which meals are shared?
              </Text>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.card,
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
                        gap: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: colors.cardBorder,
                        backgroundColor: active ? Accent.primary + "10" : "transparent",
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: active ? Accent.primary : colors.cardBorder,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {active ? (
                          <View
                            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Accent.primary }}
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

            {/* Grid */}
            <View style={{ marginBottom: 14 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.4,
                    color: colors.textTertiary,
                    textTransform: "uppercase",
                  }}
                >
                  Weekly plan
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }} testID="household-grid-summary">
                  {sharedCount} of {totalCells} shared
                </Text>
              </View>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.card,
                  padding: 14,
                }}
              >
                {/* Column headers */}
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
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
                  <View key={s} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                    <View style={{ width: 28, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={SLOT_META[s].icon} size={14} color={colors.textSecondary} />
                    </View>
                    {HOUSEHOLD_DAY_IDS.map((d) => {
                      const mem = cellMembers(sharing.grid, d, s);
                      const count = mem.length;
                      const all = members.length;
                      const isAll = count === all && all > 0;
                      const isSome = count > 1 && count < all;
                      const bg = isAll
                        ? Accent.primary + "33"
                        : isSome
                          ? Accent.primary + "1a"
                          : colors.inputBg;
                      const fg = isAll || isSome ? Accent.primary : colors.textTertiary;
                      const border = isAll || isSome ? Accent.primary + "4d" : "transparent";
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
                            height: 34,
                            borderRadius: 8,
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
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 12, lineHeight: 15 }}>
                  Tap a cell to toggle between solo and everyone. Long-press to pick specific members.
                </Text>
              </View>

              {/* Legend */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {members.map((m, idx) => (
                  <View
                    key={m.userId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingVertical: 4,
                      paddingLeft: 4,
                      paddingRight: 10,
                      borderRadius: 999,
                      backgroundColor: colors.inputBg,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
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
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 14,
            paddingTop: 10,
            backgroundColor: colors.background + "ee",
          }}
        >
          <Pressable
            onPress={() => void onSave()}
            disabled={saving || !household.isOwner}
            testID="household-settings-save"
            accessibilityRole="button"
            accessibilityLabel="Save household settings"
            style={{
              paddingVertical: 14,
              borderRadius: Radius.lg,
              backgroundColor: Accent.primary,
              alignItems: "center",
              opacity: saving || !household.isOwner ? 0.5 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
              {saving ? "Saving…" : savedToast ? "Saved" : "Save changes"}
            </Text>
          </Pressable>
          {!household.isOwner ? (
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 6, textAlign: "center" }}>
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
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
              Who&apos;s eating?
            </Text>
            {editingMeta ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 16 }}>
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
                        gap: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 4,
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
                          borderColor: on ? Accent.primary : colors.cardBorder,
                          backgroundColor: on ? Accent.primary : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {on ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                })
              : null}
            <Pressable
              onPress={() => setEditingCell(null)}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: Radius.md,
                backgroundColor: colors.inputBg,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
