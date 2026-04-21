import { memo, useMemo } from "react";
import { useAppData } from "../../context/AppDataContext.tsx";
import {
  formatMixedShoppingAmounts,
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "../../lib/planning/shoppingDisplayGroups.ts";
import { dedupeShoppingLabel } from "../../lib/planning/shoppingListLifecycle.ts";
import type { UserTier } from "../../types/recipe.ts";

interface ShoppingListProps {
  userTier: UserTier;
  onUpgrade?: () => void;
  onNavigate?: (view: string) => void;
}

/**
 * Web Shopping list — prototype port (2026-04-20 rewrite).
 *
 * Matches `docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * `WebShopping` exactly: `<h1 style="font-size:24">Shopping list</h1>`,
 * subtitle `N items · from this week's plan`, and a 3-column
 * `grid-cols-3 gap-4 max-w-[900px]` of category cards. Each card
 * carries an overline, then rows separated by top-border with a
 * 18×18 circular checkbox ring and inline `{name} ({qty} {unit})`
 * text.
 *
 * Intentionally stripped vs earlier ports (per Grace 2026-04-20):
 *  - no breadcrumb row (Recipes · Shopping list · date)
 *  - no Shopping progress bar / capsule
 *  - no Print / CSV / Text / meatballs export UI
 *  - no "Add custom item" input
 *  - no per-row trash icon
 *  - no recipe thumbnail images
 *  - no regenerate card
 *  - no out-of-sync banner (code path retained in context)
 *
 * Data flow preserved: `toggleShoppingChecked` still persists via
 * `useAppData`. Empty state is a single muted "No items" card.
 */
export const ShoppingList = memo(function ShoppingList({
  userTier: _userTier,
  onUpgrade: _onUpgrade,
  onNavigate: _onNavigate,
}: ShoppingListProps) {
  const { shoppingItems, toggleShoppingChecked } = useAppData();

  const categories = useMemo(
    () => Array.from(new Set(shoppingItems.map((item) => item.category))),
    [shoppingItems],
  );

  const categorySections = useMemo(
    () =>
      categories.map((category) => ({
        name: category,
        groups: groupShoppingItemsByIngredientName(
          shoppingItems.filter((item) => item.category === category),
        ),
      })),
    [categories, shoppingItems],
  );

  const totalItemCount = useMemo(
    () => categorySections.reduce((n, s) => n + s.groups.length, 0),
    [categorySections],
  );

  const subtitle = `${totalItemCount} item${totalItemCount === 1 ? "" : "s"} · from this week's plan`;

  const toggleGroupChecked = (group: ShoppingDisplayGroup) => {
    const allChecked = isShoppingGroupFullyChecked(group);
    for (const item of group.items) {
      if (allChecked) {
        if (item.checked) toggleShoppingChecked(item.id);
      } else if (!item.checked) {
        toggleShoppingChecked(item.id);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-pm-5 py-pm-5">
      {/* Title + subtitle — paste-level fidelity to prototype WebShopping. */}
      <h1
        className="text-foreground font-bold -tracking-[0.02em]"
        style={{ fontSize: 24, margin: "0 0 4px" }}
      >
        Shopping list
      </h1>
      <p className="text-muted-foreground" style={{ fontSize: 13, marginBottom: 20 }}>
        {subtitle}
      </p>

      {totalItemCount === 0 ? (
        <div
          className="bg-card border border-border rounded-2xl"
          style={{ padding: 14, maxWidth: 900 }}
        >
          <p className="text-muted-foreground" style={{ fontSize: 13 }}>
            No items
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          style={{ maxWidth: 900 }}
        >
          {categorySections.map((section) => (
            <div
              key={section.name}
              className="bg-card border border-border rounded-2xl"
              style={{ padding: 14 }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                style={{ marginBottom: 10 }}
              >
                {section.name}
              </p>
              <ul className="flex flex-col">
                {section.groups.map((group) => {
                  const allChecked = isShoppingGroupFullyChecked(group);
                  const dedupedSingle =
                    group.items.length === 1
                      ? dedupeShoppingLabel({
                          amount: group.items[0]!.amount,
                          unit: group.items[0]!.unit,
                          name: group.displayName,
                        })
                      : null;
                  const qtyLine = dedupedSingle
                    ? `${dedupedSingle.amount} ${dedupedSingle.unit}`.trim()
                    : formatMixedShoppingAmounts(group.items);
                  const displayName = dedupedSingle
                    ? dedupedSingle.name
                    : group.displayName;
                  const rowLabel = qtyLine
                    ? `${displayName} (${qtyLine})`
                    : displayName;
                  return (
                    <li
                      key={group.key}
                      className="flex items-center border-t border-border first:border-t-0"
                      style={{ gap: 10, padding: "8px 0", fontSize: 13 }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroupChecked(group)}
                        aria-pressed={allChecked}
                        aria-label={`${allChecked ? "Uncheck" : "Check"} ${displayName}`}
                        className="shrink-0"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          border: "1.5px solid var(--border)",
                          background: allChecked ? "var(--primary)" : "transparent",
                          cursor: "pointer",
                        }}
                      />
                      <span
                        className={
                          allChecked
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }
                      >
                        {rowLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
