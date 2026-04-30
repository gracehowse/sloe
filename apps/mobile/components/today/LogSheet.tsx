import * as React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  ChevronRight,
  Clock,
  History,
  Lock,
  Mic,
  PencilLine,
  ScanBarcode,
  Search,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { SourceDot, type SourceDotSource } from "@/components/ui/SourceDot";
import { FatSecretBadge } from "@/components/ui/FatSecretBadge";
import { TrustChip } from "@/components/ui/TrustChip";

/**
 * Mobile `<LogSheet>` — canonical log-entry sheet, search-first.
 *
 * Production design spec — 2026-04-27 Surface B (post-2026-04-28
 * search-first refactor — see `docs/ux/teardown-2026-04-28-daily-loop.md`
 * Next-10 #12).
 *
 * Pre-refactor structure: a 6-pill horizontal tab strip (Search / Scan /
 * Recent / Saved / Voice / Photo) where each tab rendered a different
 * content area. The tab strip read as a "power-user feature menu":
 * first-time users had to read six labels and choose one before
 * logging anything, and Voice + Photo (the Pro features) were
 * frequently clipped off-screen on narrow viewports.
 *
 * Post-refactor: search is the canonical primary input. The other
 * three input modes (scan, voice, photo) ride along as small right-
 * edge icons inside the search row. Recent + Saved render inline as
 * the default browse content via a 2-pill toggle below the search
 * row. The 6-tab strip is gone. The user opens the sheet and
 * IMMEDIATELY sees the input they want plus their recent meals — no
 * navigation cost.
 *
 * Why callbacks not flows: the existing search / barcode / voice /
 * photo pipelines live in dedicated components (FoodSearchModal,
 * BarcodeScannerModal, VoiceLogSheet, PhotoLogSheet). The LogSheet's
 * job is consolidation of access, not rebuilding nutrition logic.
 * Tapping the search input → host closes LogSheet and opens
 * FoodSearchModal. Tapping a right-edge icon → host opens the
 * dedicated modal. Recent / Saved row pick → host logs the meal
 * directly into the current slot.
 *
 * Pro gating: voice + photo are Pro-only on free + base tiers. The
 * host passes `locked: true` to surface a small lock badge on those
 * icons; the icon's `onTap` is still called so the host can route
 * to the AI paywall sheet instead of the real flow. The LogSheet
 * itself does not know about user tier.
 *
 * Spec deviation: spec calls for `@gorhom/bottom-sheet` with snap
 * points 50%/92%. That dependency is not yet in the project; rather
 * than introduce it for one component, we use the RN `Modal` pattern
 * that all other Suppr sheets use. Snap behaviour is approximated
 * via a height-controlled inner content. Documented at
 * `docs/journeys/log-sheet-2026-04-27.md`.
 *
 * Web mirror: `src/app/components/suppr/log-sheet.tsx`.
 */

/**
 * Legacy tab-id type retained for backwards compat with deep test
 * references (`logSheetPhase3.test.tsx`). Post-2026-04-28 the
 * LogSheet does not render a tab strip; the only "tabs" are the
 * Recent / Saved pill toggle below the search row. The type union
 * stays so any host or test still passing `initialTab` compiles
 * cleanly — the prop is ignored.
 */
export type LogSheetTab =
  | "search"
  | "barcode"
  | "recent"
  | "saved"
  | "voice"
  | "photo";

export interface LogSheetSearchResult {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  thumbnail?: string;
}

export interface LogSheetRecentEntry {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  bucket: "today" | "week";
}

export interface LogSheetSavedMeal {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
}

export interface LogSheetBarcodeManualEntry {
  productName: string;
  brand?: string;
  source?: SourceDotSource;
}

export interface LogSheetTabState {
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
  permissionDenied?: boolean;
  showFirstRunTip?: boolean;
}

export interface LogSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Ignored post-2026-04-28 — kept for backwards compat only. */
  initialTab?: LogSheetTab;
  /** Search foods. Tap the search row → host closes LogSheet and
   *  opens FoodSearchModal. Other fields (`query`, `results`, etc.)
   *  are tolerated for backwards compat but not rendered — the
   *  LogSheet is no longer an inline-search surface. When `onOpen`
   *  is undefined the search row renders but is non-interactive
   *  (the host has opted out of search). */
  search?: {
    onOpen?: () => void;
    /** @deprecated */ query?: string;
    /** @deprecated */ onQueryChange?: (q: string) => void;
    /** @deprecated */ results?: LogSheetSearchResult[];
    /** @deprecated */ onAdd?: (result: LogSheetSearchResult) => void;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /** Scan barcode. Tap the scan icon → host opens
   *  BarcodeScannerModal. When host injects `manualEntry` (after a
   *  scan resolves to a 0-kcal product), the LogSheet replaces its
   *  default content with the manual-entry recovery form. */
  barcode?: {
    onOpen?: () => void;
    locked?: boolean;
    manualEntry?: LogSheetBarcodeManualEntry | null;
    onConfirmManual?: (
      payload: LogSheetBarcodeManualEntry & {
        portionGrams: number;
        kcal: number;
        protein: number;
        carbs: number;
        fat: number;
      },
    ) => void;
    /** @deprecated */ cameraSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  recent?: {
    entries: LogSheetRecentEntry[];
    onPick: (entry: LogSheetRecentEntry) => void;
    state?: LogSheetTabState;
  };
  saved?: {
    meals: LogSheetSavedMeal[];
    onPick: (meal: LogSheetSavedMeal) => void;
    state?: LogSheetTabState;
  };
  /** Voice log. Tap the mic icon → host closes LogSheet and opens
   *  VoiceLogSheet (or the AI paywall sheet for free/base tiers). */
  voice?: {
    onStart?: () => void;
    locked?: boolean;
    /** @deprecated */ micSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /** Photo log. Tap the camera icon → host closes LogSheet and
   *  opens PhotoLogSheet (or the AI paywall for free/base). */
  photo?: {
    onCapture?: () => void;
    locked?: boolean;
    /** @deprecated */ shutterSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /** "Or add manually →" footer link. Host typically wires this to
   *  open the manual quick-add form. When undefined the footer is
   *  hidden. */
  onAddManually?: () => void;
}

type BrowseTab = "recent" | "saved";

export function LogSheet({
  visible,
  onClose,
  search,
  barcode,
  recent,
  saved,
  voice,
  photo,
  onAddManually,
}: LogSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  // Pill toggle defaults to Recent. Resets on every fresh open so a
  // returning user doesn't land on Saved if they last left the sheet
  // there — the primary read is "what did I eat recently".
  const [browseTab, setBrowseTab] = React.useState<BrowseTab>("recent");
  React.useEffect(() => {
    if (!visible) setBrowseTab("recent");
  }, [visible]);

  const inManualEntryMode = !!barcode?.manualEntry;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot} testID="log-sheet-root">
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Dismiss log sheet"
          testID="log-sheet-backdrop"
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)" }]}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel="Log a meal"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} accessible={false} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[Type.headline, { color: colors.text }]}>Log a meal</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close log sheet"
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>

          {inManualEntryMode ? (
            <BarcodeManualEntry
              entry={barcode!.manualEntry!}
              onConfirm={barcode?.onConfirmManual}
            />
          ) : (
            <DefaultComposition
              search={search}
              barcode={barcode}
              recent={recent}
              saved={saved}
              voice={voice}
              photo={photo}
              browseTab={browseTab}
              onBrowseTabChange={setBrowseTab}
              onAddManually={onAddManually}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------- Default composition -------------------------- */

function DefaultComposition({
  search,
  barcode,
  recent,
  saved,
  voice,
  photo,
  browseTab,
  onBrowseTabChange,
  onAddManually,
}: {
  search: LogSheetProps["search"];
  barcode: LogSheetProps["barcode"];
  recent: LogSheetProps["recent"];
  saved: LogSheetProps["saved"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  browseTab: BrowseTab;
  onBrowseTabChange: (tab: BrowseTab) => void;
  onAddManually?: () => void;
}) {
  const colors = useThemeColors();
  const showRecent = !!recent;
  const showSaved = !!saved;
  const showBrowseToggle = showRecent && showSaved;

  return (
    <View style={{ flex: 1 }}>
      {/* Search row — primary input. Right-edge icons (scan / voice
          / photo) ride along when the host wires the corresponding
          callbacks. Each icon is tap-to-open: the host closes
          LogSheet and opens the dedicated modal. */}
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search foods"
          accessibilityHint="Opens the food search where you can find foods, brands, and recipes"
          testID="log-sheet-search-row"
          onPress={() => search?.onOpen?.()}
          style={({ pressed }) => [
            styles.searchInputWrap,
            {
              backgroundColor: colors.inputBg,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Search size={IconSize.base} color={colors.textSecondary} />
          <Text
            style={{ flex: 1, color: colors.textSecondary, fontSize: 14 }}
            numberOfLines={1}
          >
            Search foods, brands, or recipes
          </Text>
          <RightEdgeIcons barcode={barcode} voice={voice} photo={photo} />
        </Pressable>
      </View>

      {/* Browse pill toggle — Recent / Saved. Hidden when only one
          source is available; the available one renders directly. */}
      {showBrowseToggle ? (
        <View style={[styles.browsePillRow, { backgroundColor: colors.inputBg }]}>
          {(["recent", "saved"] as const).map((id) => {
            const active = browseTab === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  if (id === browseTab) return;
                  onBrowseTabChange(id);
                  if (process.env.EXPO_OS === "ios") {
                    void Haptics.selectionAsync();
                  }
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={id === "recent" ? "Recent" : "Saved meals"}
                style={[
                  styles.browsePill,
                  { backgroundColor: active ? colors.background : "transparent" },
                ]}
              >
                <Text
                  style={[
                    styles.browsePillLabel,
                    { color: active ? colors.text : colors.textSecondary },
                  ]}
                >
                  {id === "recent" ? "Recent" : "Saved meals"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Browse content */}
      <View style={{ flex: 1 }}>
        {showRecent && (browseTab === "recent" || !showSaved) ? (
          <RecentList recent={recent!} />
        ) : null}
        {showSaved && (browseTab === "saved" || !showRecent) ? (
          <SavedList saved={saved!} />
        ) : null}
        {!showRecent && !showSaved ? (
          <View style={{ flex: 1, padding: Spacing.lg, alignItems: "center", justifyContent: "center" }}>
            <Text style={[Type.caption, { color: colors.textSecondary, textAlign: "center" }]}>
              Search above for foods, or scan / speak / snap a photo.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer: "Or add manually" — escape hatch for users who want
          to type macros directly. Host wires this to the manual
          quick-add form. */}
      {onAddManually ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Or add manually"
          onPress={onAddManually}
          style={({ pressed }) => [
            styles.manualFooter,
            { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <PencilLine size={IconSize.base} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[Type.body, { color: colors.textSecondary, flex: 1 }]}>
            Or add manually
          </Text>
          <ChevronRight size={IconSize.base} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------- Right-edge icons -------------------------- */

function RightEdgeIcons({
  barcode,
  voice,
  photo,
}: {
  barcode: LogSheetProps["barcode"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
}) {
  const colors = useThemeColors();
  // Render the icons in the documented order: Scan → Voice → Photo
  // (matches the prior tab order to preserve user muscle memory from
  // the 6-tab era). Each icon only renders when the host wires its
  // open/start/capture callback — no callback, no icon (host has
  // opted out of that input mode).
  const icons: {
    key: "scan" | "voice" | "photo";
    label: string;
    Icon: typeof Search;
    onPress?: () => void;
    locked: boolean;
  }[] = [
    {
      key: "scan",
      label: "Scan barcode",
      Icon: ScanBarcode,
      onPress: barcode?.onOpen,
      locked: barcode?.locked ?? false,
    },
    {
      key: "voice",
      label: "Voice log",
      Icon: Mic,
      onPress: voice?.onStart,
      locked: voice?.locked ?? false,
    },
    {
      key: "photo",
      label: "Photo log",
      Icon: Camera,
      onPress: photo?.onCapture,
      locked: photo?.locked ?? false,
    },
  ];
  return (
    <View style={styles.rightEdgeIcons}>
      {icons.map(({ key, label, Icon, onPress, locked }) =>
        onPress ? (
          <Pressable
            key={key}
            onPress={() => {
              if (process.env.EXPO_OS === "ios") {
                void Haptics.selectionAsync();
              }
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={locked ? `${label} (Pro)` : label}
            hitSlop={6}
            style={({ pressed }) => [
              styles.rightEdgeIcon,
              { opacity: pressed ? 0.55 : 1 },
            ]}
          >
            <Icon size={IconSize.base} color={colors.textSecondary} strokeWidth={2} />
            {locked ? (
              <View style={styles.lockBadge}>
                <Lock size={8} color="#fff" strokeWidth={2.5} />
              </View>
            ) : null}
          </Pressable>
        ) : null,
      )}
    </View>
  );
}

/* -------------------------- Recent list -------------------------- */

function RecentList({ recent }: { recent: NonNullable<LogSheetProps["recent"]> }) {
  const colors = useThemeColors();
  const { entries, onPick, state } = recent;
  const today = entries.filter((e) => e.bucket === "today");
  const week = entries.filter((e) => e.bucket === "week");

  if (state?.loading) {
    return <SkeletonList colors={colors} />;
  }

  if (entries.length === 0) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <Clock size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          Your recent foods will appear here
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          {"Log something once and it'll show up next time."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}>
      {today.length > 0 ? (
        <View>
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: 6 }]}>
            {"Today's recents"}
          </Text>
          {today.map((e) => (
            <BrowseRow key={e.id} title={e.title} kcal={e.kcal} source={e.source} onPick={() => onPick(e)} />
          ))}
        </View>
      ) : null}
      {week.length > 0 ? (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: 6 }]}>
            Earlier this week
          </Text>
          {week.map((e) => (
            <BrowseRow key={e.id} title={e.title} kcal={e.kcal} source={e.source} onPick={() => onPick(e)} />
          ))}
        </View>
      ) : null}
      {entries.some((e) => e.source === "fatsecret") ? (
        <FatSecretBadge variant="text" style={{ marginTop: 8, marginHorizontal: 4 }} />
      ) : null}
    </ScrollView>
  );
}

/* -------------------------- Saved list -------------------------- */

function SavedList({ saved }: { saved: NonNullable<LogSheetProps["saved"]> }) {
  const colors = useThemeColors();
  const { meals, onPick, state } = saved;

  if (state?.loading) {
    return <SkeletonList colors={colors} />;
  }

  if (meals.length === 0) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <History size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          No saved meals yet
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          Save a meal you eat often to log it in one tap.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}>
      {meals.map((m) => (
        <BrowseRow
          key={m.id}
          title={m.title}
          kcal={m.kcal}
          source={m.source}
          onPick={() => onPick(m)}
        />
      ))}
    </ScrollView>
  );
}

/* -------------------------- Browse row -------------------------- */

function BrowseRow({
  title,
  kcal,
  source,
  onPick,
}: {
  title: string;
  kcal: number;
  source: SourceDotSource;
  onPick: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log ${title}`}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPick();
      }}
      style={({ pressed }) => [styles.resultRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.resultThumb, { backgroundColor: colors.inputBg }]} />
      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
        <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <SourceDot source={source} size={6} />
          <Text
            style={[
              Type.caption,
              { color: colors.textSecondary, marginLeft: 6, fontVariant: ["tabular-nums"] },
            ]}
          >
            {kcal} kcal
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/* -------------------------- Skeleton -------------------------- */

function SkeletonList({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ padding: Spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeletonThumb, { backgroundColor: colors.inputBg }]} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.inputBg, width: "65%" }]} />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.inputBg, width: "30%", marginTop: 6, height: 8 },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/* -------------------------- Barcode manual entry -------------------------- */

function BarcodeManualEntry({
  entry,
  onConfirm,
}: {
  entry: LogSheetBarcodeManualEntry;
  onConfirm?: NonNullable<NonNullable<LogSheetProps["barcode"]>["onConfirmManual"]>;
}) {
  const colors = useThemeColors();
  const [portion, setPortion] = React.useState("100");
  const [kcal, setKcal] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  const inputStyle = {
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    borderRadius: 8,
    color: colors.text,
    textAlign: "right" as const,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          padding: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}
      >
        <Text style={[Type.body, { color: colors.text, fontWeight: "700" }]}>{entry.productName}</Text>
        {entry.brand ? (
          <Text style={[Type.caption, { color: colors.textSecondary }]}>{entry.brand}</Text>
        ) : null}
        <TrustChip variant="manual" />
      </View>

      <Text style={[Type.caption, { color: colors.textSecondary }]}>
        {"No nutrition data — enter manually. We'll save this so the next scan finds it."}
      </Text>

      <View style={styles.inputRow}>
        <Text style={[Type.body, { color: colors.textSecondary }]}>Portion (g)</Text>
        <TextInput
          accessibilityLabel="Portion in grams"
          keyboardType="decimal-pad"
          value={portion}
          onChangeText={setPortion}
          style={[inputStyle, { width: 100 }]}
        />
      </View>
      <View style={styles.inputRow}>
        <Text style={[Type.body, { color: colors.textSecondary }]}>kcal</Text>
        <TextInput
          accessibilityLabel="Kilocalories"
          keyboardType="decimal-pad"
          value={kcal}
          onChangeText={setKcal}
          style={[inputStyle, { width: 100 }]}
        />
      </View>
      <Text style={[Type.caption, { color: colors.textSecondary, fontWeight: "600" }]}>
        Macros (g)
      </Text>
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}
          >
            Protein
          </Text>
          <TextInput
            accessibilityLabel="Protein grams"
            keyboardType="decimal-pad"
            value={protein}
            onChangeText={setProtein}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}
          >
            Carbs
          </Text>
          <TextInput
            accessibilityLabel="Carbs grams"
            keyboardType="decimal-pad"
            value={carbs}
            onChangeText={setCarbs}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}
          >
            Fat
          </Text>
          <TextInput
            accessibilityLabel="Fat grams"
            keyboardType="decimal-pad"
            value={fat}
            onChangeText={setFat}
            style={inputStyle}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log it"
        onPress={() => {
          if (!onConfirm) return;
          if (process.env.EXPO_OS === "ios") {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          onConfirm({
            ...entry,
            portionGrams: Number(portion) || 100,
            kcal: Number(kcal) || 0,
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
          });
        }}
        style={{
          height: 44,
          borderRadius: Radius.md,
          backgroundColor: Accent.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Log it</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    height: "92%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    height: 48,
    borderRadius: Radius.md,
  },
  rightEdgeIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rightEdgeIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    position: "relative",
  },
  lockBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  browsePillRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: 3,
    borderRadius: Radius.md,
  },
  browsePill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  browsePillLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  manualFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skeletonThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    opacity: 0.6,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
  },
  emptyBlock: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: Radius.md,
    paddingVertical: 32,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
  },
  resultThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

export default LogSheet;
