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
        const qty =
          g.items.length === 1
            ? `${g.items[0]!.amount} ${g.items[0]!.unit}`
            : formatMixedShoppingAmounts(g.items);
        const from = mergeShoppingFromFields(g.items);
        lines.push(`${box} ${g.displayName} — ${qty} (${from})`);
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

  return (
    <div className="max-w-4xl mx-auto px-pm-5 py-pm-5 print:max-w-none print:px-4 print:py-4">
      {/* Header */}
      <div className="mb-4 print:mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary rounded-xl print:hidden">
                <Icons.shopping className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-foreground">
                Shopping List
              </h1>
            </div>
            <p className="text-muted-foreground print:text-muted-foreground">From your meal plan</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all flex items-center gap-2 text-foreground font-medium shadow-sm"
            >
              <Icons.printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all flex items-center gap-2 text-foreground font-medium shadow-sm"
            >
              <Icons.import className="w-4 h-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportText}
              className="px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all flex items-center gap-2 text-foreground font-medium shadow-sm"
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

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4 print:hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-foreground">Shopping Progress</h3>
          <span className="text-lg font-bold text-primary">
            {displayProgress.checkedGroups} / {displayProgress.groupCount} items
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-primary transition-pm duration-[180ms]"
            style={{
              width: `${displayProgress.groupCount ? (displayProgress.checkedGroups / displayProgress.groupCount) * 100 : 0}%`,
            }}
          ></div>
        </div>
      </div>

      {/* Add Item */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg print:hidden">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Add custom item..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
            className="flex-1 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105 flex items-center gap-2 font-semibold"
          >
            <Icons.add className="w-5 h-5" />
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

      {/* Items by Category */}
      {categories.map((category) => {
        const groups = groupShoppingItemsByIngredientName(shoppingItems.filter((item) => item.category === category));
        return (
          <div key={category} className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-lg">
            <div className="sticky top-0 z-10 -mx-2 mb-4 border-b border-border/90 bg-card/90 backdrop-blur-md px-2 py-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{category}</h3>
            </div>
            <div className="space-y-3">
              {groups.map((group) => {
                const allChecked = isShoppingGroupFullyChecked(group);
                const someChecked = group.items.some((i) => i.checked);
                const dimmed = allChecked;
                const lineThrough = allChecked;
                const qtyLine =
                  group.items.length === 1
                    ? `${group.items[0]!.amount} ${group.items[0]!.unit}`
                    : formatMixedShoppingAmounts(group.items);
                const fromMerged = mergeShoppingFromFields(group.items);
                const multiFrom = fromMerged.includes(",");
                const thumb = resolveRecipeThumb(fromMerged);
                return (
                  <div
                    key={group.key}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-pm ${
                      dimmed
                        ? "bg-muted border-border opacity-60"
                        : "bg-card border-border hover:border-primary/30"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroupChecked(group)}
                      className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center print:hidden ${
                        allChecked
                          ? "bg-primary border-primary"
                          : someChecked
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                      }`}
                    >
                      {allChecked ? (
                        <Icons.check className="w-4 h-4 text-white" />
                      ) : someChecked ? (
                        <Icons.remove className="w-4 h-4 text-primary" />
                      ) : null}
                    </button>
                    <span className="hidden print:inline w-6 text-center text-sm text-muted-foreground">
                      {allChecked ? "☑" : "☐"}
                    </span>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="hidden h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border/80 sm:block"
                      />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium ${lineThrough ? "line-through text-muted-foreground" : "text-foreground"}`}
                      >
                        {qtyLine} {group.displayName}
                      </p>
                      {group.items.length > 1 ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Multiple quantities/units combined for shopping — amounts are not added when units differ.
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground truncate">
                        {multiFrom ? (
                          <>
                            <span className="font-medium text-foreground">Combined from plan: </span>
                            {fromMerged}
                          </>
                        ) : (
                          <>From: {fromMerged}</>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGroup(group)}
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors print:hidden"
                      aria-label={`Remove ${group.displayName}`}
                    >
                      <Icons.delete className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg print:hidden">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Generate from your current meal plan</p>
          <button
            type="button"
            onClick={() => void generateShoppingListFromPlan()}
            className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl transition-all font-medium"
          >
            Regenerate from Plan
          </button>
        </div>
      </div>
    </div>
  );
});
