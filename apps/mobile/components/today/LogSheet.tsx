import * as React from "react";
import {
  FlatList,
  Image,
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
  Clock,
  History,
  Mic,
  ScanBarcode,
  Search,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { SourceDot, type SourceDotSource } from "@/components/ui/SourceDot";
import { FatSecretBadge } from "@/components/ui/FatSecretBadge";
import { TrustChip } from "@/components/ui/TrustChip";

/**
 * Mobile `<LogSheet>` — canonical log entry sheet.
 *
 * Production design spec — 2026-04-27 Surface B.
 * Authority: D-2026-04-27-15 (one canonical log path).
 *
 * Replaces the legacy `<TodayFabSheet>` + the 8+ entry-point splay.
 * Six sub-tabs:
 *   1. Search foods   — inline search input + result rows
 *   2. Scan barcode   — camera viewport (slotted by caller)
 *   3. Recent         — Today's recents + Earlier this week
 *   4. Saved meals    — list of templates
 *   5. Voice log      — 88×88 mic button (Pro-gated upstream)
 *   6. Photo log      — camera shutter (Pro-gated upstream)
 *
 * Why callbacks not flows: the existing search / barcode / voice /
 * photo pipelines live in dedicated components (FoodSearchModal,
 * BarcodeScannerModal, VoiceLogSheet, PhotoLogSheet). The LogSheet
 * is the single visible entry point; the underlying pipelines are
 * unchanged. The LogSheet's job is consolidation of access, not
 * rebuilding nutrition logic.
 *
 * Spec deviation: spec calls for `@gorhom/bottom-sheet` with snap
 * points 50%/92%. That dependency is not yet in the project; rather
 * than introduce it for one component (which would require linking
 * react-native-reanimated wrappers that already exist), we use the
 * RN `Modal` pattern that all other Suppr sheets use. Snap behaviour
 * is approximated via `presentationStyle="overFullScreen"` + height-
 * controlled inner content. Documented at
 * `docs/journeys/log-sheet-2026-04-27.md`.
 *
 * Web mirror: `src/app/components/suppr/log-sheet.tsx`.
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
  initialTab?: LogSheetTab;
  search?: {
    query: string;
    onQueryChange: (q: string) => void;
    results: LogSheetSearchResult[];
    onAdd: (result: LogSheetSearchResult) => void;
    state?: LogSheetTabState;
  };
  barcode?: {
    cameraSlot?: React.ReactNode;
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
    state?: LogSheetTabState;
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
  voice?: {
    micSlot?: React.ReactNode;
    state?: LogSheetTabState;
    /** Fired when the default mic button is tapped. The host should
     *  close the LogSheet and open the dedicated VoiceLogSheet. */
    onStart?: () => void;
  };
  photo?: {
    shutterSlot?: React.ReactNode;
    state?: LogSheetTabState;
    /** Fired when the default capture button is tapped. The host
     *  should close the LogSheet and open the dedicated PhotoLogSheet. */
    onCapture?: () => void;
  };
}

const TAB_LIST: ReadonlyArray<{
  id: LogSheetTab;
  label: string;
  Icon: typeof Search;
}> = [
  { id: "search", label: "Search foods", Icon: Search },
  { id: "barcode", label: "Scan barcode", Icon: ScanBarcode },
  { id: "recent", label: "Recent", Icon: Clock },
  { id: "saved", label: "Saved meals", Icon: History },
  { id: "voice", label: "Voice log", Icon: Mic },
  { id: "photo", label: "Photo log", Icon: Camera },
];

export function LogSheet({
  visible,
  onClose,
  initialTab = "search",
  search,
  barcode,
  recent,
  saved,
  voice,
  photo,
}: LogSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [tab, setTab] = React.useState<LogSheetTab>(initialTab);

  // Reset to initial tab on every fresh open. See web mirror for why.
  React.useEffect(() => {
    if (!visible) setTab(initialTab);
  }, [visible, initialTab]);

  const handleSelectTab = React.useCallback(
    (id: LogSheetTab) => {
      if (id === tab) return;
      setTab(id);
      if (process.env.EXPO_OS === "ios") {
        void Haptics.selectionAsync();
      }
    },
    [tab],
  );

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
          {/* Drag handle 36×4 */}
          <View
            style={[styles.handle, { backgroundColor: colors.border }]}
            accessible={false}
          />

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

          {/* Sub-tab pill bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subtabContainer}
            accessibilityRole="tablist"
            accessibilityLabel="Log sheet sub-tabs"
          >
            {TAB_LIST.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => handleSelectTab(id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label} tab`}
                  testID={`log-sheet-tab-${id}`}
                  style={[
                    styles.subtab,
                    {
                      backgroundColor: active ? Accent.primary : colors.inputBg,
                    },
                  ]}
                >
                  <Icon
                    size={IconSize.md}
                    color={active ? "#fff" : colors.textSecondary}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.subtabLabel,
                      {
                        color: active ? "#fff" : colors.textSecondary,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {tab === "search" ? <SearchTab {...(search ?? { query: "", onQueryChange: () => {}, results: [], onAdd: () => {} })} /> : null}
            {tab === "barcode" ? <BarcodeTab {...(barcode ?? {})} /> : null}
            {tab === "recent" ? <RecentTab {...(recent ?? { entries: [], onPick: () => {} })} /> : null}
            {tab === "saved" ? <SavedTab {...(saved ?? { meals: [], onPick: () => {} })} /> : null}
            {tab === "voice" ? <VoiceTab {...(voice ?? {})} /> : null}
            {tab === "photo" ? <PhotoTab {...(photo ?? {})} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------- Search tab -------------------------- */

function SearchTab({
  query,
  onQueryChange,
  results,
  onAdd,
  state,
}: NonNullable<LogSheetProps["search"]>) {
  const colors = useThemeColors();

  return (
    <View style={{ flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
      <View
        style={[
          styles.searchInputWrap,
          { backgroundColor: colors.inputBg },
        ]}
      >
        <Search size={IconSize.base} color={colors.textSecondary} />
        <TextInput
          accessibilityLabel="Search foods"
          placeholder="Search foods, brands, or recipes…"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          style={{ flex: 1, color: colors.text, fontSize: 14 }}
        />
      </View>

      {state?.offline ? (
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
          {"You're offline. Searching cached foods only."}
        </Text>
      ) : null}

      {state?.error ? (
        <View style={[styles.errorBand, { backgroundColor: "rgba(232,160,32,0.10)" }]}>
          <WifiOff size={IconSize.md} color="#e8a020" />
          <Text style={[Type.caption, { color: "#e8a020", marginLeft: Spacing.xs }]}>
            {"Couldn't search. Try again →"}
          </Text>
        </View>
      ) : null}

      {state?.loading ? (
        <View style={{ marginTop: Spacing.md }}>
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
      ) : null}

      {!state?.loading && !state?.error && results.length === 0 && query.trim() ? (
        <View style={[styles.emptyBlock, { borderColor: colors.border }]}>
          <Search size={32} color={colors.textTertiary} />
          <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
            {`No matches for "${query}"`}
          </Text>
          <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            Try fewer words, or scan a barcode.
          </Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: Spacing.xxl }}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            {item.thumbnail ? (
              <Image source={{ uri: item.thumbnail }} style={styles.resultThumb} />
            ) : (
              <View style={[styles.resultThumb, { backgroundColor: colors.inputBg }]} />
            )}
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <SourceDot source={item.source} size={6} />
                <Text style={[Type.caption, { color: colors.textSecondary, marginLeft: 6, fontVariant: ["tabular-nums"] }]}>
                  {item.kcal} kcal
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.title}`}
              onPress={() => {
                if (process.env.EXPO_OS === "ios") {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                onAdd(item);
              }}
              hitSlop={6}
              style={[
                styles.addBtn,
                { backgroundColor: `${Accent.primary}1A` },
              ]}
            >
              <Text style={{ color: Accent.primary, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>+</Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          results.some((r) => r.source === "fatsecret") ? (
            /* FatSecret attribution — ToS requires the badge wherever
               FatSecret-sourced content is displayed. Footer of the
               result list so it's immediately below the FatSecret rows. */
            <FatSecretBadge
              variant="text"
              style={{ marginTop: 8, marginHorizontal: 4 }}
              testID="fatsecret-badge-search"
            />
          ) : null
        }
      />
    </View>
  );
}

/* -------------------------- Barcode tab -------------------------- */

function BarcodeTab({
  cameraSlot,
  manualEntry,
  onConfirmManual,
  state,
}: NonNullable<LogSheetProps["barcode"]>) {
  const colors = useThemeColors();

  if (state?.permissionDenied) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <ScanBarcode size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          Camera access needed
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          Grant camera access to scan barcodes.
        </Text>
      </View>
    );
  }

  if (manualEntry) {
    return <BarcodeManualEntry entry={manualEntry} onConfirm={onConfirmManual} />;
  }

  return (
    <View style={{ flex: 1, padding: Spacing.md }}>
      <View
        style={{
          aspectRatio: 4 / 3,
          backgroundColor: "#000",
          borderRadius: Radius.md,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {cameraSlot ?? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#888" }}>Camera viewport</Text>
          </View>
        )}
        {/* Corner brackets */}
        <View style={[styles.bracket, { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[styles.bracket, { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 }]} />
        <View style={[styles.bracket, { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
        <View style={[styles.bracket, { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 }]} />
      </View>
      <Text
        style={[
          Type.caption,
          { color: colors.textSecondary, textAlign: "center", marginTop: Spacing.md },
        ]}
      >
        {"Point at a barcode — we'll match it to USDA, OFF, or FatSecret."}
      </Text>
    </View>
  );
}

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
    fontVariant: ["tabular-nums"] as Array<"tabular-nums">,
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
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Protein (g)</Text>
          <TextInput
            accessibilityLabel="Protein grams"
            keyboardType="decimal-pad"
            value={protein}
            onChangeText={setProtein}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Carbs (g)</Text>
          <TextInput
            accessibilityLabel="Carbs grams"
            keyboardType="decimal-pad"
            value={carbs}
            onChangeText={setCarbs}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Fat (g)</Text>
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

/* -------------------------- Recent tab -------------------------- */

function RecentTab({
  entries,
  onPick,
  state,
}: NonNullable<LogSheetProps["recent"]>) {
  const colors = useThemeColors();
  const today = entries.filter((e) => e.bucket === "today");
  const week = entries.filter((e) => e.bucket === "week");

  if (state?.loading) {
    return (
      <View style={{ padding: Spacing.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={[styles.skeletonThumb, { backgroundColor: colors.inputBg }]} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <View style={[styles.skeletonLine, { backgroundColor: colors.inputBg, width: "65%" }]} />
            </View>
          </View>
        ))}
      </View>
    );
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
    <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
      {today.length > 0 ? (
        <View>
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: 6 }]}>
            {"Today's recents"}
          </Text>
          {today.map((e) => (
            <RecentRow key={e.id} entry={e} onPick={onPick} />
          ))}
        </View>
      ) : null}
      {week.length > 0 ? (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: 6 }]}>
            Earlier this week
          </Text>
          {week.map((e) => (
            <RecentRow key={e.id} entry={e} onPick={onPick} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function RecentRow({
  entry,
  onPick,
}: {
  entry: LogSheetRecentEntry;
  onPick: (entry: LogSheetRecentEntry) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log ${entry.title}`}
      onPress={() => onPick(entry)}
      style={({ pressed }) => [styles.resultRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.resultThumb, { backgroundColor: colors.inputBg }]} />
      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
        <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
          {entry.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <SourceDot source={entry.source} size={6} />
          <Text
            style={[
              Type.caption,
              { color: colors.textSecondary, marginLeft: 6, fontVariant: ["tabular-nums"] },
            ]}
          >
            {entry.kcal} kcal
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/* -------------------------- Saved tab -------------------------- */

function SavedTab({
  meals,
  onPick,
  state,
}: NonNullable<LogSheetProps["saved"]>) {
  const colors = useThemeColors();

  if (state?.loading) {
    return (
      <View style={{ padding: Spacing.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={[styles.skeletonThumb, { backgroundColor: colors.inputBg }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.inputBg, flex: 1, marginLeft: Spacing.sm }]} />
          </View>
        ))}
      </View>
    );
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
    <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
      {meals.map((m) => (
        <Pressable
          key={m.id}
          accessibilityRole="button"
          accessibilityLabel={`Log ${m.title}`}
          onPress={() => onPick(m)}
          style={({ pressed }) => [styles.resultRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View style={[styles.resultThumb, { backgroundColor: colors.inputBg }]} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
              {m.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
              <SourceDot source={m.source} size={6} />
              <Text
                style={[
                  Type.caption,
                  { color: colors.textSecondary, marginLeft: 6, fontVariant: ["tabular-nums"] },
                ]}
              >
                {m.kcal} kcal
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/* -------------------------- Voice tab -------------------------- */

function VoiceTab({ micSlot, state, onStart }: NonNullable<LogSheetProps["voice"]>) {
  const colors = useThemeColors();

  if (state?.permissionDenied) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <Mic size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          Microphone access needed
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          Grant mic access to use voice log.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg, gap: Spacing.md }}>
      {state?.showFirstRunTip ? (
        <View
          style={{
            padding: Spacing.md,
            borderRadius: Radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={[Type.caption, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: "700" }}>{"First time? "}</Text>
            {"Speak naturally — “a chicken caesar salad with extra dressing” works."}
          </Text>
        </View>
      ) : null}
      {micSlot ?? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap to start recording"
          onPress={onStart}
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Mic size={32} color="#fff" />
        </Pressable>
      )}
      <Text style={[Type.caption, { color: colors.textSecondary }]}>
        {"Tap to start. We'll transcribe + match macros."}
      </Text>
    </View>
  );
}

/* -------------------------- Photo tab -------------------------- */

function PhotoTab({ shutterSlot, state, onCapture }: NonNullable<LogSheetProps["photo"]>) {
  const colors = useThemeColors();

  if (state?.permissionDenied) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <Camera size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          Camera access needed
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          Grant camera access to use photo log.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: Spacing.md, gap: Spacing.md, alignItems: "center" }}>
      {state?.showFirstRunTip ? (
        <View
          style={{
            width: "100%",
            padding: Spacing.md,
            borderRadius: Radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Sparkles size={IconSize.xs} color="#e8a020" />
          <Text style={[Type.caption, { color: colors.textSecondary, flex: 1 }]}>
            <Text style={{ fontWeight: "700" }}>{"First time? "}</Text>
            {"One photo of your plate is enough — we'll estimate."}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          aspectRatio: 4 / 3,
          width: "100%",
          backgroundColor: "#000",
          borderRadius: Radius.md,
          overflow: "hidden",
        }}
      >
        {shutterSlot ?? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#888" }}>Camera viewport</Text>
          </View>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Capture photo"
        onPress={onCapture}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: Accent.primary,
          borderWidth: 4,
          borderColor: Accent.primary,
        }}
      />
    </View>
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
  subtabContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  subtab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  subtabLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.md,
  },
  errorBand: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.md,
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
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bracket: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "rgba(255,255,255,0.8)",
  },
});

export default LogSheet;
