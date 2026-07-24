import { Alert, StyleSheet, View, Text, type TextStyle, type ViewStyle } from "react-native";
import { Check, Package, Trash2 } from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  formatShoppingGroupLabel,
  formatShoppingGroupParts,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "@suppr/shared/planning/shoppingDisplayGroups";
import {
  formatShoppingRecipeCountCaption,
  shoppingRecipeTitlesFromItems,
} from "@suppr/shared/planning/shoppingScanLabel";
import {
  composeShoppingRowLabel,
  formatShoppingProvenanceCaption,
  toPurchasableShoppingQuantity,
} from "@suppr/shared/planning/shoppingListDisplay";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "@suppr/shared/household/memberAccents";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { isFeatureEnabled } from "@/lib/analytics";

type ShoppingItemLike = {
  id: string;
  checked: boolean;
  from: string;
  checkedBy: string | null;
};

type MemberInfo = { displayName: string; index: number };

type ShoppingListGroupRowProps = {
  group: ShoppingDisplayGroup;
  densityV1: boolean;
  householdActive: boolean;
  memberById: Map<string, MemberInfo>;
  accent: {
    primary: string;
    primarySoft: string;
    primarySolid: string;
  };
  colors: {
    primaryForeground: string;
    destructiveForeground: string;
    text: string;
    textSecondary: string;
    border: string;
    tabIconDefault: string;
  };
  /** Legacy card-row styles (flag off). */
  styles: {
    itemRow: ViewStyle;
    checkbox: ViewStyle;
    checkboxChecked: ViewStyle;
    itemName: TextStyle;
    itemChecked: TextStyle;
    itemFrom: TextStyle;
    attributionChip: ViewStyle;
    attributionInitials: ViewStyle;
    attributionText: TextStyle;
    attributionLabel: TextStyle;
  };
  onToggle: (group: ShoppingDisplayGroup, allChecked: boolean) => void;
  onRemove: (group: ShoppingDisplayGroup) => void;
  onMarkStaple: (group: ShoppingDisplayGroup) => void;
};

/**
 * Shopping row — ENG-1669 Mob-inspired density (no ingredient images):
 * bold qty + regular name left, rounded-square checkbox right.
 * Flag-off keeps checkbox-left legacy layout.
 */
export function ShoppingListGroupRow({
  group,
  densityV1,
  householdActive,
  memberById,
  accent,
  colors,
  styles,
  onToggle,
  onRemove,
  onMarkStaple,
}: ShoppingListGroupRowProps) {
  // Design-consistency pass (2026-07-24) — shop-unit quantities + always-on
  // recipe provenance, shared with web via `shoppingListDisplay`. Scoped to the
  // scan-density layout exactly as web scopes it (`ShoppingListRow` only swaps
  // in `ShoppingScanRow` when `densityV1` is on), so the ENG-1669 flag-off card
  // row stays byte-identical on both platforms.
  const unified = isFeatureEnabled("design_consistency_v1") && densityV1;

  const allChecked = isShoppingGroupFullyChecked(group);
  const parts = formatShoppingGroupParts(group, {
    forShoppingScan: densityV1,
  });
  // Display-only rounding: the stored grams are untouched, but a list that
  // says "1 g ground coriander" is not a list anyone can shop from.
  const quantity = toPurchasableShoppingQuantity(parts.quantity);
  const rowLabel = unified
    ? composeShoppingRowLabel(quantity, parts.name)
    : formatShoppingGroupLabel(group, { forShoppingScan: densityV1 });
  const recipeTitles = shoppingRecipeTitlesFromItems(group.items);
  const fromLabel = recipeTitles.join(", ");
  // Always show provenance under the unified pass — a caption that appears on
  // some rows and not others reads as missing data, not as "one recipe".
  const recipeCountCaption = !densityV1
    ? null
    : unified
      ? formatShoppingProvenanceCaption(recipeTitles.length)
      : formatShoppingRecipeCountCaption(recipeTitles.length);
  const showFromParagraph = !densityV1 && Boolean(fromLabel);
  const showRecipeCount =
    densityV1 && recipeCountCaption != null && (unified || !allChecked);

  const checkedByEntries = group.items
    .map((i) => (i as ShoppingItemLike).checkedBy ?? null)
    .filter((id): id is string => Boolean(id));
  const uniqueCheckedBy = [...new Set(checkedByEntries)];
  const showAttribution =
    householdActive && allChecked && uniqueCheckedBy.length === 1;
  const attributedMember = showAttribution
    ? memberById.get(uniqueCheckedBy[0]!)
    : null;

  const longPressMessage = (() => {
    if (group.items.length > 1 && !densityV1) {
      return `"${rowLabel}" (${group.items.length} rows)`;
    }
    if (densityV1 && recipeTitles.length > 0) {
      return recipeTitles.join("\n");
    }
    return undefined;
  })();

  const checkbox = (
    <View
      style={
        densityV1
          ? {
              width: 22,
              height: 22,
              borderRadius: Radius.sm,
              borderWidth: 1.5,
              borderColor: allChecked ? accent.primary : colors.border,
              backgroundColor: allChecked ? accent.primary : "transparent",
              justifyContent: "center",
              alignItems: "center",
            }
          : [styles.checkbox, allChecked && styles.checkboxChecked]
      }
    >
      {allChecked ? (
        <Check size={densityV1 ? 12 : 14} color={colors.primaryForeground} strokeWidth={3} />
      ) : null}
    </View>
  );

  const labelBlock = (
    <View style={{ flex: 1, minWidth: 0, paddingRight: Spacing.sm }}>
      {densityV1 ? (
        <Text
          style={{
            ...Type.body,
            color: allChecked ? colors.tabIconDefault : colors.text,
            textDecorationLine: allChecked ? "line-through" : "none",
          }}
          numberOfLines={2}
        >
          {unified ? (
            <>
              {quantity.kind === "amount" ? (
                <Text style={{ fontWeight: "700" }}>{quantity.text} </Text>
              ) : null}
              <Text style={{ fontWeight: "400" }}>{parts.name}</Text>
              {quantity.kind === "qualitative" ? (
                <Text style={{ fontWeight: "400", color: colors.textSecondary }}>
                  {` · ${quantity.text}`}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {parts.quantity ? (
                <Text style={{ fontWeight: "700" }}>{parts.quantity} </Text>
              ) : null}
              <Text style={{ fontWeight: "400" }}>{parts.name}</Text>
            </>
          )}
        </Text>
      ) : (
        <Text style={[styles.itemName, allChecked && styles.itemChecked]}>
          {rowLabel}
        </Text>
      )}
      {showFromParagraph ? (
        <Text style={styles.itemFrom}>{fromLabel}</Text>
      ) : null}
      {showRecipeCount ? (
        <Text
          testID={`shopping-recipe-count-${group.key}`}
          style={{ ...Type.caption, color: colors.textSecondary, marginTop: 0 }}
        >
          {recipeCountCaption}
        </Text>
      ) : null}
      {attributedMember ? (
        <View
          testID={`shopping-attribution-${group.key}`}
          style={[styles.attributionChip, { alignSelf: "flex-start" }]}
        >
          <View
            style={[
              styles.attributionInitials,
              {
                backgroundColor: householdMemberAccent(attributedMember.index),
              },
            ]}
          >
            <Text style={styles.attributionText}>
              {householdMemberInitials(attributedMember.displayName)}
            </Text>
          </View>
          <Text style={styles.attributionLabel}>
            {householdMemberFirstName(attributedMember.displayName)} checked
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Swipeable
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      renderLeftActions={() => (
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          <PressableScale
            haptic="confirm"
            onPress={() => onMarkStaple(group)}
            style={{
              width: 88,
              backgroundColor: accent.primarySoft,
              justifyContent: "center",
              alignItems: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={`Always have ${rowLabel} — hide from future shopping lists`}
            testID={`shopping-swipe-staple-${group.key}`}
          >
            <Package size={22} color={accent.primarySolid} />
            <Text
              style={{
                color: accent.primarySolid,
                fontSize: 11,
                fontWeight: "700",
                marginTop: 4,
              }}
            >
              Staple
            </Text>
          </PressableScale>
        </View>
      )}
      renderRightActions={() => (
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          <PressableScale
            haptic="destructive"
            onPress={() => onRemove(group)}
            style={{
              width: 88,
              backgroundColor: Accent.destructive,
              justifyContent: "center",
              alignItems: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${rowLabel} from shopping list`}
            testID={`shopping-swipe-delete-${group.key}`}
          >
            <Trash2 size={22} color={colors.destructiveForeground} />
            <Text
              style={{
                color: colors.destructiveForeground,
                fontSize: 11,
                fontWeight: "700",
                marginTop: 4,
              }}
            >
              Delete
            </Text>
          </PressableScale>
        </View>
      )}
    >
      <PressableScale
        haptic="selection"
        style={
          densityV1
            ? {
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: Spacing.sm,
                // 44pt touch floor (DS §10.1) — the whole row is the toggle.
                minHeight: unified ? 44 : 40,
                // The hairline is load-bearing, not decoration: with the
                // checkbox pinned right, a short label ("Salt") leaves a wide
                // gap and the rule carries the eye across it. Web matches.
                borderBottomWidth: unified ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: colors.border,
              }
            : styles.itemRow
        }
        onPress={() => onToggle(group, allChecked)}
        onLongPress={() => {
          Alert.alert(
            group.items.length > 1 ? "Shopping item" : rowLabel,
            longPressMessage,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Always on hand",
                onPress: () => onMarkStaple(group),
              },
              {
                text: "Remove",
                style: "destructive",
                onPress: () => onRemove(group),
              },
            ],
          );
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allChecked }}
        accessibilityLabel={rowLabel}
      >
        {densityV1 ? (
          <>
            {labelBlock}
            {checkbox}
          </>
        ) : (
          <>
            {checkbox}
            {labelBlock}
          </>
        )}
      </PressableScale>
    </Swipeable>
  );
}
