import { useState } from "react";
import { ShoppingCart, Check, Plus, Trash2, Download, Printer } from "lucide-react";
import { useAppData } from "../../context/AppDataContext.tsx";
import type { UserTier } from "../../types/recipe.ts";

interface ShoppingListProps {
  userTier: UserTier;
}

export function ShoppingList({ userTier }: ShoppingListProps) {
  const { shoppingItems, toggleShoppingChecked, removeShoppingItem, addShoppingItem } = useAppData();
  const [customName, setCustomName] = useState("");

  const isPaidUser = userTier === "base" || userTier === "pro";

  const categories = Array.from(new Set(shoppingItems.map((item) => item.category)));
  const checkedCount = shoppingItems.filter((item) => item.checked).length;

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

        <button type="button" className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 text-lg font-semibold">
          Upgrade to Access
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Shopping List</h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400">From your 7-day meal plan</p>
          </div>
          <div className="flex gap-3">
            <button type="button" className="px-4 py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium shadow-sm">
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button type="button" className="px-4 py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium shadow-sm">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-violet-50/80 to-indigo-50/80 dark:from-violet-950/30 dark:to-indigo-950/30 border-2 border-violet-200/50 dark:border-violet-800/50 rounded-2xl p-6 mb-8 shadow-xl">
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
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
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
                    className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${
                      item.checked
                        ? "bg-violet-600 border-violet-600"
                        : "border-slate-300 dark:border-slate-600 hover:border-violet-500"
                    }`}
                  >
                    {item.checked && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <div className="flex-1">
                    <p className={`font-medium ${item.checked ? "line-through text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white"}`}>
                      {item.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.amount} {item.unit} · {item.from}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeShoppingItem(item.id)}
                    className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors"
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
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-slate-600 dark:text-slate-400">Your list is saved in this browser</p>
          <button type="button" className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all font-medium">
            Regenerate from Plan
          </button>
        </div>
      </div>
    </div>
  );
}
