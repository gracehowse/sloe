import { Check, Package, X } from "lucide-react";
import {
  formatShoppingGroupLabel,
  formatShoppingGroupParts,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "../../../lib/planning/shoppingDisplayGroups.ts";
import {
  formatShoppingRecipeCountCaption,
  shoppingRecipeTitlesFromItems,
} from "../../../lib/planning/shoppingScanLabel.ts";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "../../../lib/household/memberAccents.ts";

type MemberInfo = { displayName: string; index: number };

type ShoppingListRowProps = {
  group: ShoppingDisplayGroup;
  densityV1: boolean;
  activeHouseholdId: string | null;
  memberById: Map<string, MemberInfo>;
  onToggle: (group: ShoppingDisplayGroup) => void;
  onRemove: (group: ShoppingDisplayGroup) => void;
  onMarkStaple: (group: ShoppingDisplayGroup) => void;
};

/** Web shopping row — Mob-inspired density (no images): bold qty + checkbox right (ENG-1669). */
export function ShoppingListRow({
  group,
  densityV1,
  activeHouseholdId,
  memberById,
  onToggle,
  onRemove,
  onMarkStaple,
}: ShoppingListRowProps) {
  const allChecked = isShoppingGroupFullyChecked(group);
  const rowLabel = formatShoppingGroupLabel(group, {
    forShoppingScan: densityV1,
  });
  const parts = formatShoppingGroupParts(group, {
    forShoppingScan: densityV1,
  });
  const recipeTitles = shoppingRecipeTitlesFromItems(group.items);
  const recipeCountCaption =
    densityV1 && !allChecked
      ? formatShoppingRecipeCountCaption(recipeTitles.length)
      : null;

  const checkedByEntries = group.items
    .map((i) => i.checkedBy ?? null)
    .filter((id): id is string => Boolean(id));
  const uniqueCheckedBy = [...new Set(checkedByEntries)];
  const showAttribution =
    activeHouseholdId != null &&
    allChecked &&
    uniqueCheckedBy.length === 1;
  const attributedMember = showAttribution
    ? memberById.get(uniqueCheckedBy[0]!)
    : null;

  const checkbox = (
    <button
      type="button"
      onClick={() => onToggle(group)}
      aria-pressed={allChecked}
      aria-label={`${allChecked ? "Uncheck" : "Check"} ${rowLabel}`}
      className="shrink-0 grid place-items-center transition-colors"
      style={{
        width: 22,
        height: 22,
        borderRadius: densityV1 ? 4 : 12,
        border: allChecked
          ? "1.5px solid var(--primary)"
          : "1.5px solid var(--border)",
        background: allChecked ? "var(--primary)" : "transparent",
        cursor: "pointer",
      }}
    >
      {allChecked ? (
        <Check
          width={11}
          height={11}
          strokeWidth={3}
          className="text-primary-foreground"
          aria-hidden
        />
      ) : null}
    </button>
  );

  const label = (
    <span
      className={`flex-1 min-w-0 ${
        allChecked ? "line-through text-muted-foreground" : "text-foreground"
      }`}
    >
      {densityV1 ? (
        <span className="block">
          {parts.quantity ? (
            <span className="font-bold">{parts.quantity} </span>
          ) : null}
          <span className="font-normal">{parts.name}</span>
        </span>
      ) : (
        <span className="block font-medium">{rowLabel}</span>
      )}
      {recipeCountCaption ? (
        <span
          data-testid={`shopping-recipe-count-${group.key}`}
          className="block text-[11px] text-muted-foreground mt-1"
        >
          {recipeCountCaption}
        </span>
      ) : null}
    </span>
  );

  return (
    <li
      className={`flex items-center group ${
        densityV1 ? "" : "border-t border-border first:border-t-0"
      }`}
      style={{ gap: 10, padding: densityV1 ? "8px 0" : "8px 0", fontSize: 13 }}
      title={
        densityV1 && recipeTitles.length > 0
          ? recipeTitles.join(", ")
          : undefined
      }
    >
      {densityV1 ? (
        <>
          {label}
          {attributedMember ? (
            <span
              data-testid={`shopping-attribution-${group.key}`}
              className="inline-flex items-center gap-1 shrink-0"
              title={`${householdMemberFirstName(attributedMember.displayName)} checked this`}
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center text-[9px] font-bold text-white"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 9999,
                  background: householdMemberAccent(attributedMember.index),
                }}
              >
                {householdMemberInitials(attributedMember.displayName)}
              </span>
            </span>
          ) : null}
          {checkbox}
        </>
      ) : (
        <>
          {checkbox}
          {label}
          {attributedMember ? (
            <span
              data-testid={`shopping-attribution-${group.key}`}
              className="inline-flex items-center gap-1 shrink-0"
              title={`${householdMemberFirstName(attributedMember.displayName)} checked this`}
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center text-[9px] font-bold text-white"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 9999,
                  background: householdMemberAccent(attributedMember.index),
                }}
              >
                {householdMemberInitials(attributedMember.displayName)}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">
                {householdMemberFirstName(attributedMember.displayName)}
              </span>
            </span>
          ) : null}
        </>
      )}
      <button
        type="button"
        onClick={() => void onMarkStaple(group)}
        aria-label={`Always have ${rowLabel} — hide from future shopping lists`}
        data-testid={`shopping-row-staple-${group.key}`}
        className="shrink-0 size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-primary-solid hover:bg-primary-soft transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Package width={14} height={14} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onRemove(group)}
        aria-label={`Remove ${rowLabel}`}
        data-testid={`shopping-row-remove-${group.key}`}
        className="shrink-0 size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive-soft transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X width={14} height={14} aria-hidden />
      </button>
    </li>
  );
}
