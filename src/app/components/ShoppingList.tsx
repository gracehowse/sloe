import { useMemo, useState } from "react";
import { ShoppingCart, Check, Plus, Trash2, Download, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { UserTier } from "../../types/recipe.ts";

interface ShoppingListProps {
  userTier: UserTier;
  onUpgrade?: () => void;
}

export function ShoppingList({ userTier, onUpgrade }: ShoppingListProps) {
  const {
    shoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
    generateShoppingListFromPlan,
  } = useAppData();
  const [customName, setCustomName] = useState("");

  const isPaidUser = userTier === "base" || userTier === "pro";

  const categories = Array.from(new Set(shoppingItems.map((item) => item.category)));
  const checkedCount = shoppingItems.filter((item) => item.checked).length;

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
    const lines: string[] = ["Platemate shopping list", ""];
    for (const cat of categories) {
      const categoryItems = shoppingItems.filter((item) => item.category === cat);
      lines.push(`## ${cat}`, "");
      for (const item of categoryItems) {
        const box = item.checked ? "[x]" : "[ ]";
        lines.push(`${box} ${item.name} — ${item.amount} ${item.unit} (${item.from})`);
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

  if (!isPaidUser) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/50">
            <ShoppingCart className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="mb-4 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Shopping List</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto text-lg">
          Automatically generate organized shopping lists from your meal plans. Never forget an ingredient again.
        </p>

        <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 mb-10 text-left max-w-2xl mx-auto shadow-2xl">
          <h3 className="mb-6 text-slate-900 dark:text-white">Premium Feature</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Shopping lists are available for Base and Pro subscribers. Generate lists from meal plans, automatically combine duplicate ingredients, and organize by category for efficient shopping.
          </p>
        </div>

        <button
          type="button"
          onClick={onUpgrade}
          className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 text-lg font-semibold"
        >
          Upgrade to Access
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 print:max-w-none print:px-4 print:py-4">
      {/* Header */}
      <div className="mb-8 print:mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl print:hidden">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent print:text-slate-900 print:bg-none">
                Shopping List
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 print:text-slate-600">From your meal plan</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium shadow-sm"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportText}
              className="px-4 py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium shadow-sm"
            >
              <FileText className="w-4 h-4" />
              Text
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-violet-50/80 to-indigo-50/80 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-200/50 dark:border-violet-800/50 rounded-2xl p-6 mb-8 shadow-xl print:hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-900 dark:text-white">Shopping Progress</h3>
          <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
            {checkedCount} / {shoppingItems.length} items
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
            style={{ width: `${shoppingItems.length ? (checkedCount / shoppingItems.length) * 100 : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Add Item */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg print:hidden">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Add custom item..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
            className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105 flex items-center gap-2 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </div>

      {/* Items by Category */}
      {categories.map((category) => {
        const categoryItems = shoppingItems.filter((item) => item.category === category);
        return (
          <div key={category} className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
            <h3 className="text-slate-900 dark:text-white mb-4">{category}</h3>
            <div className="space-y-3">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    item.checked
                      ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60"
                      : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleShoppingChecked(item.id)}
                    className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center print:hidden ${
                      item.checked
                        ? "bg-violet-600 border-violet-600"
                        : "border-slate-300 dark:border-slate-600 hover:border-violet-500"
                    }`}
                  >
                    {item.checked && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <span className="hidden print:inline w-6 text-center text-sm text-slate-500">
                    {item.checked ? "☑" : "☐"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${item.checked ? "line-through text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white"}`}>
                      {item.amount} {item.unit} {item.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {item.from.includes(",") ? (
                        <>
                          <span className="font-medium text-slate-600 dark:text-slate-300">Combined from plan: </span>
                          {item.from}
                        </>
                      ) : (
                        <>From: {item.from}</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeShoppingItem(item.id)}
                    className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors print:hidden"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg print:hidden">
        <div className="flex items-center justify-between">
          <p className="text-slate-600 dark:text-slate-400">Generate from your current meal plan</p>
          <button
            type="button"
            onClick={() => void generateShoppingListFromPlan()}
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all font-medium"
          >
            Regenerate from Plan
          </button>
        </div>
      </div>
    </div>
  );
}
