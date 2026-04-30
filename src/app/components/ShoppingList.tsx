import { memo, useMemo } from "react";
import { X } from "lucide-react";
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
 * Web Shopping list — prototype baseline + F3 lifecycle interactions.
 *
 * Layout matches `docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * `WebShopping` exactly: `<h1 style="font-size:24">Shopping list</h1>`,
 * subtitle `N items · from this week's plan`, 3-column
 * `grid-cols-3 gap-4 max-w-[900px]` of category cards.
 *
 * F3 hybrid additions (audit 2026-04-28, see
 * `docs/decisions/2026-04-28-shopping-list-web-parity-hybrid.md`):
 *  - Per-row X remove (mobile lifecycle parity)
 *  - "Remove N checked" link, only when ≥1 row is checked
 *  - Slim progress bar with `role="progressbar"` + `aria-valuenow`
 *
 * Intentionally NOT shipped (prototype strip holds for chrome):
 *  - Share button (defer until web share format is designed)
 *  - Trash / clear-all (redundant with clear-checked + plan regen)
 *  - Print / CSV / Text / meatballs export UI
 *  - Breadcrumb, regenerate card, out-of-sync banner
 *  - "Add custom item" input
 *  - Recipe thumbnail images
 *
 * Data flow: `toggleShoppingChecked`, `removeShoppingItem`, and
 * `setShoppingItems` all persist via `useAppData`.
 */
export const ShoppingList = memo(function ShoppingList({
  userTier: _userTier,
  onUpgrade: _onUpgrade,
  onNavigate: _onNavigate,
}: ShoppingListProps) {
  const {
    shoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    setShoppingItems,
  } = useAppData();

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

  // F3 (2026-04-28): count of fully-checked groups for the progress
  // bar and the "Remove N checked" link.
  const checkedCount = useMemo(
    () =>
      categorySections.reduce(
        (n, s) => n + s.groups.filter((g) => isShoppingGroupFullyChecked(g)).length,
        0,
      ),
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

  /** F3 (2026-04-28) — per-row remove. Mobile parity at
   *  `apps/mobile/app/shopping.tsx` (uses the same context handler). */
  const removeGroup = (group: ShoppingDisplayGroup) => {
    for (const item of group.items) removeShoppingItem(item.id);
  };

  /** F3 (2026-04-28) — clear-checked link. Filters the persisted
   *  shopping array down to unchecked items in one write. Mirrors
   *  the mobile flow which uses the same `setShoppingItems` setter. */
  const handleClearChecked = () => {
    if (checkedCount === 0) return;
    setShoppingItems((prev) => prev.filter((item) => !item.checked));
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
      <p className="text-muted-foreground" style={{ fontSize: 13, marginBottom: 12 }}>
        {subtitle}
      </p>

      {/* F3 (2026-04-28): slim progress bar + clear-checked link.
          Mobile parity at `apps/mobile/app/shopping.tsx`. Hidden on
          empty lists; the clear-checked link only renders when ≥1
          row is checked. */}
      {totalItemCount > 0 ? (
        <div
          className="flex items-center gap-3 mb-5"
          style={{ maxWidth: 900 }}
        >
          <div
            data-testid="shopping-progress-bar"
            role="progressbar"
            aria-valuenow={checkedCount}
            aria-valuemin={0}
            aria-valuemax={totalItemCount}
            aria-label={`${checkedCount} of ${totalItemCount} items checked off`}
            className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full bg-primary transition-all"
              style={{
                width:
                  totalItemCount > 0
                    ? `${(checkedCount / totalItemCount) * 100}%`
                    : "0%",
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {checkedCount}/{totalItemCount}
          </p>
          {checkedCount > 0 ? (
            <button
              type="button"
              onClick={handleClearChecked}
              data-testid="shopping-clear-checked"
              className="text-[12px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded shrink-0"
            >
              Remove {checkedCount} checked
            </button>
          ) : null}
        </div>
      ) : null}

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
          {categorySections.map((section) => {
            // 2026-04-30 audit visual-qa P1 #8 (mobile parity with
            // `apps/mobile/app/shopping.tsx` L471-503): section-level
            // progress so the user feels each category complete as
            // they shop. A group is "checked" when all its items are
            // checked — same `isShoppingGroupFullyChecked` predicate
            // used elsewhere in this file for the row toggle.
            const sectionTotal = section.groups.length;
            const sectionChecked = section.groups.filter((g) =>
              isShoppingGroupFullyChecked(g),
            ).length;
            return (
            <div
              key={section.name}
              className="bg-card border border-border rounded-2xl"
              style={{ padding: 14 }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 10 }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {section.name}
                </p>
                <span
                  className="text-[11px] font-bold tabular-nums text-muted-foreground"
                  style={{ letterSpacing: 0.5 }}
                >
                  {sectionChecked}/{sectionTotal}
                </span>
              </div>
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
                      className="flex items-center border-t border-border first:border-t-0 group"
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
                        className={`flex-1 ${
                          allChecked
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {rowLabel}
                      </span>
                      {/* F3 (2026-04-28): per-row remove button.
                          Visible on hover (group-hover:opacity-100)
                          + always visible on focus for keyboard
                          users. Mobile parity. */}
                      <button
                        type="button"
                        onClick={() => removeGroup(group)}
                        aria-label={`Remove ${displayName}`}
                        data-testid={`shopping-row-remove-${group.key}`}
                        className="shrink-0 size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X width={14} height={14} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
