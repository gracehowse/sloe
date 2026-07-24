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
  composeShoppingRowLabel,
  formatShoppingProvenanceCaption,
  toPurchasableShoppingQuantity,
} from "../../../lib/planning/shoppingListDisplay.ts";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "../../../lib/household/memberAccents.ts";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { SHOPPING_ROW_ACTION_WIDTH, useShoppingRowSwipe } from "./useShoppingRowSwipe.ts";

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

function AttributionChip({
  member,
  groupKey,
  withName,
}: {
  member: MemberInfo;
  groupKey: string;
  withName: boolean;
}) {
  return (
    <span
      data-testid={`shopping-attribution-${groupKey}`}
      className="inline-flex items-center gap-1 shrink-0"
      title={`${householdMemberFirstName(member.displayName)} checked this`}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center text-[10px] font-bold text-white"
        style={{
          width: 16,
          height: 16,
          borderRadius: 9999,
          background: householdMemberAccent(member.index),
        }}
      >
        {householdMemberInitials(member.displayName)}
      </span>
      {withName ? (
        <span className="text-[10px] font-semibold text-muted-foreground">
          {householdMemberFirstName(member.displayName)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One trailing action in the two presentations this surface needs, from a
 * single control (duplicating them would duplicate the test ids and a11y
 * names): `railOpen` → the full-height 88px pane mobile's `Swipeable` renders
 * (soft plum staple, SOLID destructive delete); otherwise → the compact icon
 * button pointer devices have always had, absolutely positioned so it reserves
 * no layout width.
 */
function RowAction({ railOpen, icon: Icon, label, destructive, onClick, ariaLabel, testId }: {
  railOpen: boolean;
  icon: typeof Package;
  label: string;
  destructive?: boolean;
  onClick: () => void;
  ariaLabel: string;
  testId: string;
}) {
  const railTone = destructive
    ? "bg-destructive text-destructive-foreground"
    : "bg-primary-soft text-primary-solid";
  const clusterTone = destructive
    ? "text-muted-foreground hover:text-destructive hover:bg-destructive-soft"
    : "text-muted-foreground hover:text-primary-solid hover:bg-primary-soft";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`${
        railOpen
          ? `flex flex-col items-center justify-center gap-1 ${railTone}`
          : `size-6 inline-flex items-center justify-center rounded-md transition-colors pointer-events-none group-hover:pointer-events-auto ${clusterTone}`
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary`}
      style={railOpen ? { width: SHOPPING_ROW_ACTION_WIDTH } : undefined}
    >
      <Icon width={railOpen ? 22 : 14} height={railOpen ? 22 : 14} aria-hidden />
      {railOpen ? <span className="text-[11px] font-bold">{label}</span> : null}
    </button>
  );
}

/**
 * Design-consistency row (2026-07-24). Three defects fixed together: the
 * checkbox no longer floats in dead space (label takes the free width, box sits
 * hard against the trailing margin); the action pair no longer reserves ~68px
 * of permanently-empty layout, and is reachable on touch via the swipe rail
 * mobile already ships; and the whole row is the toggle at a >=44px hit area,
 * with the 22px box as visual only.
 *
 * The reveal SHRINKS the row rather than sliding it: a translated row clips its
 * own leading text off the left edge, so the item name would vanish at exactly
 * the moment the user is deciding whether to delete it.
 */
function ShoppingScanRow({
  group,
  activeHouseholdId,
  memberById,
  onToggle,
  onRemove,
  onMarkStaple,
}: Omit<ShoppingListRowProps, "densityV1">) {
  const swipe = useShoppingRowSwipe();

  const allChecked = isShoppingGroupFullyChecked(group);
  const parts = formatShoppingGroupParts(group, { forShoppingScan: true });
  const quantity = toPurchasableShoppingQuantity(parts.quantity);
  const rowLabel = composeShoppingRowLabel(quantity, parts.name);
  const recipeTitles = shoppingRecipeTitlesFromItems(group.items);
  const provenance = formatShoppingProvenanceCaption(recipeTitles.length);

  const checkedBy = [
    ...new Set(group.items.map((i) => i.checkedBy).filter((id): id is string => Boolean(id))),
  ];
  const attributedMember =
    activeHouseholdId != null && allChecked && checkedBy.length === 1
      ? memberById.get(checkedBy[0]!)
      : null;

  return (
    <li
      // The hairline is load-bearing: with the checkbox pinned to the trailing
      // margin a short label ("Salt") leaves a wide gap, and the rule is what
      // carries the eye across it. Mobile matches.
      className="group relative overflow-hidden border-b border-border last:border-b-0"
      title={recipeTitles.length > 0 ? recipeTitles.join(", ") : undefined}
    >
      <div
        className="relative z-10 bg-background"
        style={{
          marginRight: swipe.offset,
          transition: swipe.dragging ? undefined : "margin-right 180ms ease",
          touchAction: "pan-y",
        }}
        {...swipe.rowHandlers}
      >
        <button
          type="button"
          onClick={() => swipe.guardTap(() => onToggle(group))}
          aria-pressed={allChecked}
          aria-label={`${allChecked ? "Uncheck" : "Check"} ${rowLabel}`}
          className="flex w-full items-center gap-3 py-2 text-left min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span
            className={`flex-1 min-w-0 text-[13px] ${
              allChecked ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {/* Two lines, matching mobile's `numberOfLines={2}` — and it holds
                the row height steady while the rail takes width. */}
            <span className="line-clamp-2">
              {quantity.kind === "amount" ? (
                <span className="font-bold">{`${quantity.text} `}</span>
              ) : null}
              <span className="font-normal">{parts.name}</span>
              {quantity.kind === "qualitative" ? (
                <span className="text-muted-foreground">{` · ${quantity.text}`}</span>
              ) : null}
            </span>
            {provenance ? (
              <span
                data-testid={`shopping-recipe-count-${group.key}`}
                className="block text-[11px] text-muted-foreground mt-1"
              >
                {provenance}
              </span>
            ) : null}
          </span>
          {attributedMember ? (
            <AttributionChip member={attributedMember} groupKey={group.key} withName={false} />
          ) : null}
          <span
            aria-hidden
            className="shrink-0 grid place-items-center transition-colors"
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: `1.5px solid ${allChecked ? "var(--primary)" : "var(--border)"}`,
              background: allChecked ? "var(--primary)" : "transparent",
            }}
          >
            {allChecked ? (
              <Check width={11} height={11} strokeWidth={3} className="text-primary-foreground" />
            ) : null}
          </span>
        </button>
      </div>

      {/* AFTER the row in the DOM so a keyboard reaches the toggle first. Focus
          opens the rail so the focused pane is visible; a mouse gets the compact
          cluster, inset clear of the checkbox and masked with the row fill. */}
      <div
        className={
          swipe.railOpen
            ? "absolute inset-y-0 right-0 z-0 flex items-stretch"
            : "absolute inset-y-0 right-8 z-20 flex items-center gap-1 bg-background pl-2 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        }
        onFocus={() => swipe.setRailFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            swipe.setRailFocused(false);
          }
        }}
      >
        <RowAction
          railOpen={swipe.railOpen}
          icon={Package}
          label="Staple"
          onClick={() => void onMarkStaple(group)}
          ariaLabel={`Always have ${rowLabel} — hide from future shopping lists`}
          testId={`shopping-row-staple-${group.key}`}
        />
        <RowAction
          railOpen={swipe.railOpen}
          icon={X}
          label="Delete"
          destructive
          onClick={() => onRemove(group)}
          ariaLabel={`Remove ${rowLabel}`}
          testId={`shopping-row-remove-${group.key}`}
        />
      </div>
    </li>
  );
}

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
  // Design-consistency pass (2026-07-24). The pre-unification layout stays
  // alive under the kill switch and on the ENG-1669 flag-off (card) path.
  if (isFeatureEnabled("design_consistency_v1") && densityV1) {
    return (
      <ShoppingScanRow
        group={group}
        activeHouseholdId={activeHouseholdId}
        memberById={memberById}
        onToggle={onToggle}
        onRemove={onRemove}
        onMarkStaple={onMarkStaple}
      />
    );
  }

  const allChecked = isShoppingGroupFullyChecked(group);
  const rowLabel = formatShoppingGroupLabel(group, { forShoppingScan: densityV1 });
  const parts = formatShoppingGroupParts(group, { forShoppingScan: densityV1 });
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
    activeHouseholdId != null && allChecked && uniqueCheckedBy.length === 1;
  const attributedMember = showAttribution ? memberById.get(uniqueCheckedBy[0]!) : null;

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
        border: allChecked ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
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
          {parts.quantity ? <span className="font-bold">{parts.quantity} </span> : null}
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
      style={{ gap: 10, padding: "8px 0", fontSize: 13 }}
      title={densityV1 && recipeTitles.length > 0 ? recipeTitles.join(", ") : undefined}
    >
      {densityV1 ? (
        <>
          {label}
          {attributedMember ? (
            <AttributionChip member={attributedMember} groupKey={group.key} withName={false} />
          ) : null}
          {checkbox}
        </>
      ) : (
        <>
          {checkbox}
          {label}
          {attributedMember ? (
            <AttributionChip member={attributedMember} groupKey={group.key} withName />
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
