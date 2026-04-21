import { memo, useCallback, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import {
  formatMixedShoppingAmounts,
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  mergeShoppingFromFields,
  singleRecipeTitleFromFromField,
  type ShoppingDisplayGroup,
} from "../../lib/planning/shoppingDisplayGroups.ts";
import { dedupeShoppingLabel } from "../../lib/planning/shoppingListLifecycle.ts";
import type { UserTier } from "../../types/recipe.ts";
import { EmptyState } from "./suppr/empty-state.tsx";
import { Button } from "./ui/button.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";

interface ShoppingListProps {
  userTier: UserTier;
  onUpgrade?: () => void;
  onNavigate?: (view: string) => void;
}

export const ShoppingList = memo(function ShoppingList({ userTier: _userTier, onUpgrade: _onUpgrade, onNavigate }: ShoppingListProps) {
  const {
    shoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
    generateShoppingListFromPlan,
    shoppingListOutOfSync,
    savedRecipesForLibrary,
  } = useAppData();

  const resolveRecipeThumb = useCallback(
    (from: string) => {
      const title = singleRecipeTitleFromFromField(from);
      if (!title) return null;
      const lib = savedRecipesForLibrary.find((r) => r.title === title);
      return lib?.image ?? null;
    },
    [savedRecipesForLibrary],
  );
  const [customName, setCustomName] = useState("");


  const categories = Array.from(new Set(shoppingItems.map((item) => item.category)));

  const displayProgress = useMemo(() => {
    let groupCount = 0;
    let checkedGroups = 0;
    for (const cat of categories) {
      const groups = groupShoppingItemsByIngredientName(shoppingItems.filter((i) => i.category === cat));
      for (const g of groups) {
        groupCount++;
        if (isShoppingGroupFullyChecked(g)) checkedGroups++;
      }
    }
    return { groupCount, checkedGroups };
  }, [shoppingItems, categories]);

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

  const removeGroup = (group: ShoppingDisplayGroup) => {
    for (const item of group.items) {
      removeShoppingItem(item.id);
    }
  };

  const csvContent = useMemo(() => {
    const header = "category,name,amount,unit,checked,from";
    const rows = shoppingItems.map((item) =>
      [
        item.category,
        item.name,
        item.amount,
        item.unit,
        item.checked ? "yes" : "no",
        item.from,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    return [header, ...rows].join("\n");
  }, [shoppingItems]);

  const textContent = useMemo(() => {
    if (shoppingItems.length === 0) {
      return "Shopping list is empty.";
    }
    const lines: string[] = ["Suppr shopping list", ""];
    for (const cat of categories) {
      const groups = groupShoppingItemsByIngredientName(shoppingItems.filter((item) => item.category === cat));
      lines.push(`## ${cat}`, "");
      for (const g of groups) {
        const box = isShoppingGroupFullyChecked(g) ? "[x]" : "[ ]";
        // Share the same dedupe path as the on-screen render for
        // single-item groups so the exported list doesn't leak the
        // "60 g 60 g protein powder" artefact.
        const single = g.items.length === 1
          ? dedupeShoppingLabel({
              amount: g.items[0]!.amount,
              unit: g.items[0]!.unit,
              name: g.displayName,
            })
          : null;
        const qty = single
          ? `${single.amount} ${single.unit}`.trim()
          : formatMixedShoppingAmounts(g.items);
        const name = single ? single.name : g.displayName;
        const from = mergeShoppingFromFields(g.items);
        lines.push(`${box} ${name} — ${qty} (${from})`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }, [shoppingItems, categories]);

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (shoppingItems.length === 0) {
      toast.message("Nothing to export");
      return;
    }
    downloadFile(csvContent, `shopping-list-${Date.now()}.csv`, "text/csv;charset=utf-8");
    toast.success("Downloaded CSV");
  };

  const handleExportText = () => {
    if (shoppingItems.length === 0) {
      toast.message("Nothing to export");
      return;
    }
    downloadFile(textContent, `shopping-list-${Date.now()}.txt`, "text/plain;charset=utf-8");
    toast.success("Downloaded text file");
  };

  const handlePrint = () => {
    if (shoppingItems.length === 0) {
      toast.message("Nothing to print");
      return;
    }
    window.print();
  };

  const handleAddCustom = () => {
    const name = customName.trim();
    if (!name) {
      return;
    }
    addShoppingItem({
      name,
      amount: "1",
      unit: "item",
      category: "Other",
      from: "Custom",
    });
    setCustomName("");
  };

  // Prototype port (2026-04-20) — breadcrumb row + subtitle ("N items ·
  // from this week's plan") mirror the Claude Design web bundle
  // (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
  // WebShopping + flows.jsx ShoppingPage). The breadcrumb's final crumb
  // is today's short label (e.g. "Wed, 14 May") so the topbar + main
  // pane carry the same date ribbon when the sibling sidebar-and-
  // breadcrumb scaffold lands. Total-item count is derived — not the
  // static "12 items" from the prototype — so it tracks the live list.
  const todayCrumbLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  }, []);
  const totalItemCount = useMemo(() => {
    let n = 0;
    for (const cat of categories) {
      n += groupShoppingItemsByIngredientName(shoppingItems.filter((i) => i.category === cat)).length;
    }
    return n;
  }, [shoppingItems, categories]);
  const subtitleText = totalItemCount > 0
    ? `${totalItemCount} item${totalItemCount === 1 ? "" : "s"} · from this week's plan`
    : "From your meal plan";

  return (
    <div className="max-w-5xl mx-auto px-pm-5 py-pm-5 print:max-w-none print:px-4 print:py-4">
      {/* Breadcrumb — prototype port (2026-04-20). Matches the topbar
          crumb pattern so the content-pane header flows from the
          sidebar scaffold landing in a sibling PR. Hidden on print +
          below md, where the bottom-tab layout already anchors
          location. */}
      <nav
        aria-label="Breadcrumb"
        className="hidden md:flex items-center gap-1.5 text-[13px] text-muted-foreground mb-3 print:hidden"
      >
        <span>Recipes</span>
        <span aria-hidden>·</span>
        <span className="font-semibold text-foreground">Shopping list</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{todayCrumbLabel}</span>
      </nav>

      {/* Header */}
      <div className="mb-5 print:mb-4">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <h1 className="text-[24px] md:text-[26px] font-bold text-foreground -tracking-[0.02em]">
              Shopping list
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1 print:text-muted-foreground">
              {subtitleText}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all flex items-center gap-2 text-foreground text-[13px] font-medium shadow-sm"
            >
              <Icons.printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all flex items-center gap-2 text-foreground text-[13px] font-medium shadow-sm"
            >
              <Icons.import className="w-4 h-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportText}
              className="px-3.5 py-2 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all flex items-center gap-2 text-foreground text-[13px] font-medium shadow-sm"
            >
              <Icons.recipe className="w-4 h-4" />
              Text
            </button>
          </div>
        </div>
      </div>

      {shoppingListOutOfSync ? (
        <div
          className="mb-6 rounded-2xl border-2 border-warning/80 bg-warning/10 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden"
          role="status"
        >
          <div className="flex gap-3 min-w-0">
            <Icons.caution className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">List may not match your meal plan</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your planner changed (meals or portions) after this list was built. Regenerate so quantities match what you
                intend to cook.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void generateShoppingListFromPlan()}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-warning hover:bg-warning/90 text-white text-sm font-semibold shadow-sm"
          >
            Regenerate from plan
          </button>
        </div>
      ) : null}

      {/* Progress (kept — valuable signal + mobile parity). */}
      {shoppingItems.length > 0 ? (
        <div className="bg-card border border-border rounded-xl p-4 mb-5 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Shopping progress</h3>
            <span className="text-base font-bold text-primary tabular-nums">
              {displayProgress.checkedGroups} / {displayProgress.groupCount} items
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary transition-pm duration-[180ms]"
              style={{
                width: `${displayProgress.groupCount ? (displayProgress.checkedGroups / displayProgress.groupCount) * 100 : 0}%`,
              }}
            ></div>
          </div>
        </div>
      ) : null}

      {/* Add Item */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6 shadow-sm print:hidden">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Add custom item..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
            className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-5 py-2.5 bg-primary text-white rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 flex items-center gap-2 text-sm font-semibold"
          >
            <Icons.add className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Empty State */}
      {shoppingItems.length === 0 && (
        <EmptyState
          icon={<Icons.plan />}
          title="Your shopping list is empty"
          description="Generate a meal plan first, then build your shopping list from it. You can also add custom items manually above."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                track(AnalyticsEvents.empty_state_cta_clicked, {
                  // L6 G5 (2026-04-18) — `surface` lets dashboards slice
                  // empty-state CTA effectiveness by origin.
                  surface: "shopping_list",
                  title: "Your shopping list is empty",
                  ctaLabel: "Go to Meal Planner",
                });
                onNavigate?.("planner");
              }}
            >
              Go to Meal Planner
            </Button>
          }
        />
      )}

      {/* Items by Category — prototype-port treatment (2026-04-20).
          3-column grid on lg+, 2-col on md, 1-col on mobile (matches
          `screens-web.jsx` WebShopping layout). Each category is a
          card with:
            - uppercase muted overline ("PRODUCE" / "PROTEIN" / etc.)
            - a single vertical list of ingredient rows separated by
              top-border dividers
            - circular checkbox on the left: empty ring when unchecked,
              filled primary when checked (stroke-3 inner check)
          Partial-check state (some items in a merged group checked
          but not all) is preserved from the prior list — the circle
          ring goes primary-coloured and the inner mark becomes a
          minus glyph. Print styling inherits the list. */}
      {shoppingItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 print:block">
          {categories.map((category) => {
            const groups = groupShoppingItemsByIngredientName(shoppingItems.filter((item) => item.category === category));
            return (
              <div
                key={category}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm print:shadow-none print:border-0 print:break-inside-avoid print:mb-6"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  {category}
                </p>
                <ul className="flex flex-col">
                  {groups.map((group) => {
                    const allChecked = isShoppingGroupFullyChecked(group);
                    const someChecked = group.items.some((i) => i.checked);
                    // G-2 (TestFlight `ALU8hrB1…`, 2026-04-19): same
                    // dedupe logic as the legacy render — single-item
                    // groups run through `dedupeShoppingLabel` so an
                    // importer leak like "60 g protein powder" doesn't
                    // print as "60 g 60 g protein powder".
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
                    const displayName = dedupedSingle ? dedupedSingle.name : group.displayName;
                    const fromMerged = mergeShoppingFromFields(group.items);
                    const multiFrom = fromMerged.includes(",");
                    const thumb = resolveRecipeThumb(fromMerged);
                    const qtyParen = qtyLine ? ` (${qtyLine})` : "";
                    return (
                      <li
                        key={group.key}
                        className="flex items-center gap-3 py-2.5 border-t border-border first:border-t-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroupChecked(group)}
                          aria-pressed={allChecked}
                          aria-label={`${allChecked ? "Uncheck" : "Check"} ${displayName}`}
                          className={`flex-shrink-0 w-[22px] h-[22px] rounded-full border-[1.5px] transition-colors flex items-center justify-center print:hidden ${
                            allChecked
                              ? "bg-primary border-primary"
                              : someChecked
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/60"
                          }`}
                        >
                          {allChecked ? (
                            <Icons.check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                          ) : someChecked ? (
                            <Icons.remove className="w-3 h-3 text-primary" strokeWidth={3} />
                          ) : null}
                        </button>
                        <span className="hidden print:inline w-5 text-center text-sm text-muted-foreground">
                          {allChecked ? "☑" : "☐"}
                        </span>
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="hidden lg:block h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border/80"
                          />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] leading-snug ${
                              allChecked ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {displayName}
                            {qtyParen ? (
                              <span className="text-muted-foreground tabular-nums">{qtyParen}</span>
                            ) : null}
                          </p>
                          {group.items.length > 1 ? (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Multiple units combined — totals not added when units differ.
                            </p>
                          ) : null}
                          {multiFrom ? (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {fromMerged}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGroup(group)}
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors print:hidden p-1 -m-1 rounded"
                          aria-label={`Remove ${group.displayName}`}
                        >
                          <Icons.delete className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Actions */}
      {shoppingItems.length > 0 ? (
        <div className="mt-6 bg-card border border-border rounded-2xl p-4 shadow-sm print:hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">Generate from your current meal plan</p>
            <button
              type="button"
              onClick={() => void generateShoppingListFromPlan()}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl transition-all text-sm font-medium"
            >
              Regenerate from plan
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
