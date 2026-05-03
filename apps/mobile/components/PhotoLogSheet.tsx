/**
 * PhotoLogSheet — mobile AI photo logging sheet.
 *
 * Re-architected 2026-05-01 (`docs/decisions/2026-05-01-photo-log-rangefirst.md`)
 * + free-taster 2026-05-02 (`docs/decisions/2026-05-02-photo-log-free-taster.md`).
 *
 * Renders a ChatGPT-grade itemized breakdown of a meal photo: items
 * grouped by macro role ("Bread + dips", "Protein + fats", "Extras"),
 * per-item kcal RANGES (~120-150 kcal — honest about vision uncertainty),
 * an optional add-on chip strip ("Add Glass of red wine: +120-150 kcal"),
 * and a plate total range. Replaces the previous single-number-per-item
 * UI which forced the user to live with a (lossy) point estimate.
 *
 * Free taster (2026-05-02):
 *  - Non-Pro users (Free + Base) get FREE_PHOTO_LOG_WEEKLY_LIMIT (=5)
 *    free photo logs per rolling 7-day window before the AI paywall.
 *  - The sheet ALWAYS opens for any tier — the gate is the SECOND
 *    photo after exhaustion (server returns 403 upgrade_required),
 *    not the FIRST.
 *  - When `userTier !== "pro"`, a thin "X free logs remaining this
 *    week" line renders under the caption (optimistic until the first
 *    server response, then authoritative `freeQuotaRemaining`).
 *  - On 403 from the server, the sheet calls `onUpgradeRequired` so
 *    the host can dismiss the sheet and open the AiPaywallSheet.
 *
 * Mirrors `src/app/components/suppr/photo-log-dialog.tsx` exactly:
 *  1. Camera / library picker via expo-image-picker.
 *  2. Preview the selected image.
 *  3. "Analyse" POSTs multipart form-data to `/api/nutrition/photo-log`.
 *  4. Items render grouped by category, with kcal ranges + Remove button per item.
 *  5. Tapping an addon chip moves it into the items list and updates the plate total.
 *  6. "Save to today" projects each ranged item to the existing
 *     `AiLoggedItem` shape via `rangedItemToLogged` and calls onCommit.
 *
 * The web/mobile divergence is intentionally minimal: identical
 * response shape, identical grouping, identical en-dash range format.
 * Only styling differs (sonner toast on web; AsyncStorage +
 * ToastAndroid + Alert.alert on mobile).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  ToastAndroid,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera, Images, Plus, X } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing } from "@/constants/theme";
import {
  averageConfidence,
  type AiLoggedItem,
} from "../../../src/lib/nutrition/aiLogging";
import {
  formatRange,
  formatRangeKcal,
  groupItemsByCategory,
  rangedItemToLogged,
  sumRanges,
  type PhotoLogAddon,
  type PhotoLogItemRanged,
} from "../../../src/lib/nutrition/photoLogRanges";
import { persistPhotoCorrections } from "../../../src/lib/nutrition/photoCorrectionPersist";
import { FREE_PHOTO_LOG_WEEKLY_LIMIT } from "../../../src/lib/nutrition/photoLogQuota";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";

/** AsyncStorage key for the one-time "we'll remember this for next
 *  time" tooltip on the first persisted photo-log correction. The
 *  flag is per-device, not per-user, because the tooltip is teaching
 *  the model — once any signed-in user on the device has seen it,
 *  we don't repeat. */
export const PHOTO_CORRECTION_TOOLTIP_KEY = "suppr.photo-correction-tooltip-shown.v1";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  inputBg: string;
  border: string;
};

type PickedAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  activeSlot: string;
  accessToken?: string | null;
  apiBase: string;
  onCommit: (items: AiLoggedItem[]) => void;
  colors: Theme;
  /**
   * 2026-05-02 — free-taster gating. Non-Pro users see "X free logs
   * remaining this week" under the caption; on a 403 from the server
   * the sheet calls `onUpgradeRequired` so the host can route to the
   * AiPaywallSheet. Defaults to "pro" so existing call sites that
   * don't pass it (web mirror, tests) preserve old behaviour.
   */
  userTier?: "free" | "base" | "pro";
  /**
   * Called when the server returns 403 upgrade_required (free-quota
   * exhausted on the current request). Host dismisses this sheet and
   * opens the AiPaywallSheet with `feature: "photo_log"`.
   */
  onUpgradeRequired?: () => void;
};

type Stage = "pick" | "analysing" | "review" | "error";

export default function PhotoLogSheet({
  visible,
  onClose,
  activeSlot,
  accessToken,
  apiBase,
  onCommit,
  colors,
  userTier = "pro",
  onUpgradeRequired,
}: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [asset, setAsset] = useState<PickedAsset | null>(null);
  const [items, setItems] = useState<PhotoLogItemRanged[]>([]);
  const [addons, setAddons] = useState<PhotoLogAddon[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /**
   * 2026-05-02 — authoritative free-taster quota signal returned by
   * the server. `null` = no successful response yet; we render the
   * optimistic FREE_PHOTO_LOG_WEEKLY_LIMIT until the first 200 lands,
   * then this takes over. Pro users never see the line at all (the
   * `isFreeTier` guard short-circuits below).
   */
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const isFreeTier = userTier !== "pro";
  /** Snapshot of the AI's items in `AiLoggedItem` form so the photo-
   *  corrections-persist helper can diff user edits at commit time
   *  (the helper expects that shape). Stored as a ref because we
   *  never re-render off it. Mirror of web dialog. */
  const originalItemsRef = useRef<AiLoggedItem[]>([]);

  useEffect(() => {
    if (visible) {
      setStage("pick");
      setAsset(null);
      setItems([]);
      setAddons([]);
      setNotes(null);
      setErrorMsg(null);
      // Reset the quota signal on each fresh open. The first analyse
      // call populates it from the server response.
      setQuotaRemaining(null);
      originalItemsRef.current = [];
      track(AnalyticsEvents.ai_photo_log_started);
    }
  }, [visible]);

  const pickFromCamera = useCallback(async () => {
    setErrorMsg(null);
    try {
      const ImagePicker = require("expo-image-picker");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Camera access is required for photo logging.");
        setStage("error");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const a = result.assets[0];
      setAsset({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
    } catch {
      setErrorMsg("Camera unavailable — use a development build with expo-image-picker.");
      setStage("error");
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    setErrorMsg(null);
    try {
      const ImagePicker = require("expo-image-picker");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Photo library permission is required.");
        setStage("error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const a = result.assets[0];
      setAsset({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName });
    } catch {
      setErrorMsg("Library picker unavailable.");
      setStage("error");
    }
  }, []);

  const submitPhoto = useCallback(async () => {
    if (!asset) return;
    setStage("analysing");
    setErrorMsg(null);
    try {
      const form = new FormData();
      form.append("image", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: asset.fileName ?? "meal.jpg",
      } as any);
      const resp = await fetch(`${apiBase}/api/nutrition/photo-log`, {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: form,
      });
      const data = await resp.json();
      if (resp.status === 403 && data?.error === "upgrade_required") {
        // 2026-05-02 — free-taster quota exhausted. Hand off to the
        // host so it can close this sheet and open the AiPaywallSheet
        // (the paywall is the SECOND-photo experience, not in-sheet
        // upgrade copy). Fire the funnel event so dashboards keep
        // reporting.
        if (onUpgradeRequired) {
          track(AnalyticsEvents.ai_photo_log_paywalled);
          onUpgradeRequired();
          return;
        }
        // Back-compat: if the host didn't wire the upgrade callback
        // (older callers), fall through to the in-sheet error so the
        // gate is never silently swallowed.
        setErrorMsg(
          typeof data.message === "string"
            ? data.message
            : "You've used your free photo logs for this week. Upgrade to Pro for unlimited.",
        );
        setStage("error");
        return;
      }
      if (!data?.ok || !Array.isArray(data.items) || data.items.length === 0) {
        setErrorMsg(
          typeof data?.message === "string"
            ? data.message
            : "Couldn't read the photo. Try a clearer angle or better light.",
        );
        setStage("error");
        return;
      }
      // Authoritative remaining-quota signal from the server (only
      // meaningful for non-Pro). `null` for Pro.
      if (typeof data.freeQuotaRemaining === "number") {
        setQuotaRemaining(data.freeQuotaRemaining);
      }
      // Snapshot the AI's items in `AiLoggedItem` form so the photo-
      // corrections-persist helper can diff user edits at commit time
      // (the helper expects that shape). Mirror of web dialog.
      const ranged = data.items as PhotoLogItemRanged[];
      originalItemsRef.current = ranged.map((it) => rangedItemToLogged(it));
      setItems(ranged);
      setAddons(Array.isArray(data.addons) ? data.addons : []);
      setNotes(typeof data.notes === "string" ? data.notes : null);
      setStage("review");
    } catch {
      setErrorMsg("Photo logging failed. Check your connection and try again.");
      setStage("error");
    }
  }, [accessToken, apiBase, asset, onUpgradeRequired]);

  const groups = useMemo(() => groupItemsByCategory(items), [items]);
  const totalKcal = useMemo(
    () => sumRanges(items.map((i) => i.calories)),
    [items],
  );

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addAddon = (addon: PhotoLogAddon) => {
    // Move the addon into the items list as a Drinks-category item (the
    // most common addon is wine; user can edit category later). Mirror
    // of web dialog.
    setItems((prev) => [
      ...prev,
      {
        id: addon.id,
        name: addon.name,
        category: "Drinks",
        calories: addon.calories,
        protein: null,
        carbs: null,
        fat: null,
        confidence: "medium" as const,
        source: "ai" as const,
        ...(addon.hint ? { quantityHint: addon.hint } : {}),
      },
    ]);
    setAddons((prev) => prev.filter((a) => a.id !== addon.id));
    track(AnalyticsEvents.ai_photo_log_addon_added, {
      name: addon.name,
      kcalLow: addon.calories.low,
      kcalHigh: addon.calories.high,
    });
  };

  const handleSaveToday = useCallback(() => {
    if (items.length === 0) return;
    const projected = items.map((it) => rangedItemToLogged(it));
    onCommit(projected as AiLoggedItem[]);
    track(AnalyticsEvents.ai_photo_log_committed, {
      itemCount: projected.length,
      avgConfidence: averageConfidence(projected as AiLoggedItem[]),
    });

    // Fire-and-forget: persist corrected items to the user's personal
    // food bank so the next photo log of the same item uses these
    // macros. Errors are swallowed inside `persistPhotoCorrections`
    // (per-outcome) so the meal still commits even if the bank write
    // fails. Surface a one-time native toast/alert on the FIRST
    // persisted correction per device so the user knows the system
    // is learning ("Got it — we'll remember this for next time.").
    void (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        if (!userId) return;
        const result = await persistPhotoCorrections({
          supabase: supabase as Parameters<typeof persistPhotoCorrections>[0]["supabase"],
          userId,
          originals: originalItemsRef.current,
          corrected: projected as AiLoggedItem[],
          track: (event, payload) => {
            track(event as never, payload as never);
          },
        });
        if (!result.anyPersisted) return;
        const flag = await AsyncStorage.getItem(PHOTO_CORRECTION_TOOLTIP_KEY);
        if (flag === "1") return;
        await AsyncStorage.setItem(PHOTO_CORRECTION_TOOLTIP_KEY, "1");
        const message = "Got it — we'll remember this for next time.";
        if (Platform.OS === "android") {
          ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
          Alert.alert(message);
        }
      } catch {
        /* fail closed — the meal already committed */
      }
    })();

    onClose();
  }, [items, onCommit, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              padding: Spacing.lg,
              paddingBottom: Spacing.xxl,
              maxHeight: "90%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder }} />
            </View>
            {/* Header row: title + X close */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Camera size={IconSize.xl} color={Accent.primary} strokeWidth={2.25} />
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Photo log</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
              >
                <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
              {stage === "review"
                ? `${items.length} item${items.length === 1 ? "" : "s"} on the plate. Tap any to verify or remove.`
                : "Snap a photo. We'll itemize it with kcal ranges grouped by macro role."}
            </Text>
            {/*
             * 2026-05-02 — free-taster quota line. Renders for
             * non-Pro tiers only. Optimistic FREE_PHOTO_LOG_WEEKLY_LIMIT
             * before the first server response; authoritative
             * `quotaRemaining` after. `accessibilityLabel` pins the
             * count without being brittle to whitespace / interpunct.
             */}
            {isFreeTier &&
              (() => {
                const shown = quotaRemaining ?? FREE_PHOTO_LOG_WEEKLY_LIMIT;
                const noun = shown === 1 ? "log" : "logs";
                return (
                  <Text
                    accessibilityLabel={`${shown} free photo ${noun} remaining this week`}
                    style={{
                      fontSize: 11,
                      color: colors.textTertiary,
                      marginBottom: Spacing.md,
                    }}
                  >
                    {shown} free {noun} remaining this week
                  </Text>
                );
              })()}
            {!isFreeTier && <View style={{ marginBottom: Spacing.sm }} />}

            {stage === "pick" && (
              <View>
                {asset ? (
                  <Image
                    source={{ uri: asset.uri }}
                    style={{
                      width: "100%",
                      aspectRatio: 16 / 9,
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.inputBg,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 16 / 9,
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.inputBg,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Camera size={28} color={colors.textTertiary} strokeWidth={1.75} />
                    <Text style={{ fontSize: 13, color: colors.textTertiary }}>Pick a photo to analyse</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo"
                    onPress={pickFromCamera}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderRadius: Radius.md,
                      backgroundColor: Accent.primary + "22",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Camera size={IconSize.base} color={Accent.primary} strokeWidth={2.25} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>Camera</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pick from photo library"
                    onPress={pickFromLibrary}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderRadius: Radius.md,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Images size={IconSize.base} color={colors.text} strokeWidth={2.25} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Library</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.md }}>
                  AI estimates with ranges. Tap any item after to verify against our food database.
                  Low-confidence items are flagged.
                </Text>
              </View>
            )}

            {stage === "analysing" && (
              <View style={{ alignItems: "center", paddingVertical: Spacing.xl, gap: 10 }}>
                <ActivityIndicator size="small" color={Accent.primary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Analysing your photo…</Text>
              </View>
            )}

            {stage === "error" && (
              <View
                accessibilityRole="alert"
                style={{
                  borderWidth: 1,
                  borderColor: "#EF444466",
                  backgroundColor: "#EF444410",
                  borderRadius: Radius.md,
                  padding: Spacing.md,
                }}
              >
                <Text style={{ fontSize: 13, color: "#B91C1C" }}>{errorMsg ?? "Something went wrong."}</Text>
              </View>
            )}

            {stage === "review" && (
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {asset && (
                  <Image
                    source={{ uri: asset.uri }}
                    style={{
                      width: "100%",
                      aspectRatio: 16 / 9,
                      borderRadius: Radius.md,
                      marginBottom: Spacing.sm,
                    }}
                    resizeMode="cover"
                  />
                )}
                {/* Items grouped by macro role */}
                {groups.map((group) => (
                  <View
                    key={group.category}
                    style={{ marginBottom: Spacing.md }}
                    accessibilityLabel={`Group ${group.category}`}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: colors.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      {group.category}
                    </Text>
                    {group.items.map((item) => {
                      const low = item.confidence === "low";
                      return (
                        <View
                          key={item.id}
                          accessibilityLabel={`Item ${item.name} ${formatRangeKcal(item.calories)}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderWidth: 1,
                            borderColor: low ? "#F59E0B55" : colors.cardBorder,
                            backgroundColor: low ? "#F59E0B0F" : colors.background,
                            borderRadius: Radius.sm,
                            marginBottom: 4,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Text
                                style={{ fontSize: 14, fontWeight: "600", color: colors.text }}
                                numberOfLines={1}
                              >
                                {item.name}
                              </Text>
                              {item.quantityHint && (
                                <Text style={{ fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>
                                  ({item.quantityHint})
                                </Text>
                              )}
                            </View>
                            {low && (
                              <Text
                                accessibilityRole="alert"
                                style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}
                              >
                                Low confidence — verify before logging.
                              </Text>
                            )}
                          </View>
                          <Text
                            style={{
                              fontSize: 13,
                              color: colors.text,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {formatRangeKcal(item.calories)}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${item.name}`}
                            onPress={() => removeItem(item.id)}
                            hitSlop={8}
                          >
                            <X size={16} color={colors.textTertiary} strokeWidth={2} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}

                {/* Plate total banner */}
                <View
                  accessibilityLabel={`Plate total ${formatRangeKcal(totalKcal)}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: Accent.primary + "1A",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: Radius.md,
                    marginBottom: Spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: 16, marginRight: 6 }}>👉</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.text }}>
                    Plate total
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: colors.text,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatRangeKcal(totalKcal)}
                  </Text>
                </View>

                {/* Add-on chips */}
                {addons.length > 0 && (
                  <View style={{ marginBottom: Spacing.sm }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: colors.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Add-ons
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {addons.map((addon) => (
                        <Pressable
                          key={addon.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${addon.name} ${formatRange(addon.calories)} kcal`}
                          onPress={() => addAddon(addon)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            backgroundColor: colors.background,
                          }}
                        >
                          <Plus size={12} color={colors.text} strokeWidth={2.25} />
                          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>
                            Add {addon.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                            +{formatRange(addon.calories)} kcal
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* Caveats */}
                {notes && (
                  <Text
                    accessibilityLabel={`Notes: ${notes}`}
                    style={{
                      fontSize: 11,
                      color: colors.textTertiary,
                      fontStyle: "italic",
                      marginBottom: Spacing.sm,
                    }}
                  >
                    {notes}
                  </Text>
                )}

                <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                  Logging to <Text style={{ fontWeight: "700", color: colors.text }}>{activeSlot}</Text>.
                  Calories saved use the midpoint of each range.
                </Text>
              </ScrollView>
            )}

            {/* Action row */}
            <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={stage === "review" ? "Back" : "Cancel"}
                onPress={stage === "review" ? () => setStage("pick") : onClose}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                  {stage === "review" ? "Back" : "Cancel"}
                </Text>
              </Pressable>
              {stage === "pick" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Analyse photo"
                  onPress={submitPhoto}
                  disabled={!asset}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor: asset ? Accent.primary : colors.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Analyse</Text>
                </Pressable>
              )}
              {stage === "error" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  onPress={() => setStage("pick")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Try again</Text>
                </Pressable>
              )}
              {stage === "review" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save to today"
                  onPress={handleSaveToday}
                  disabled={items.length === 0}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: Radius.md,
                    backgroundColor: items.length === 0 ? colors.cardBorder : Accent.primary,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                    Save to today
                  </Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
