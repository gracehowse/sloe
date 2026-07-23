import { Alert, View, Text, type TextStyle, type ViewStyle } from "react-native";
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
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "@suppr/shared/household/memberAccents";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";

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
  const allChecked = isShoppingGroupFullyChecked(group);
  const rowLabel = formatShoppingGroupLabel(group, {
    forShoppingScan: densityV1,
  });
  const parts = formatShoppingGroupParts(group, {
    forShoppingScan: densityV1,
  });
  const recipeTitles = shoppingRecipeTitlesFromItems(group.items);
  const fromLabel = recipeTitles.join(", ");
  const recipeCountCaption = densityV1
    ? formatShoppingRecipeCountCaption(recipeTitles.length)
    : null;
  const showFromParagraph = !densityV1 && Boolean(fromLabel);
  const showRecipeCount = densityV1 && !allChecked && recipeCountCaption != null;

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
          {parts.quantity ? (
            <Text style={{ fontWeight: "700" }}>{parts.quantity} </Text>
          ) : null}
          <Text style={{ fontWeight: "400" }}>{parts.name}</Text>
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
          style={{ ...Type.caption, color: colors.textSecondary, marginTop: 2 }}
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
                minHeight: 40,
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
