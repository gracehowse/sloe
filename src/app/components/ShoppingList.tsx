import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Icons } from "./ui/icons";
import { SupprCard } from "./ui/suppr-card";
import { ShoppingUpdateFromPlanButton } from "./ShoppingUpdateFromPlanButton";
import { ShoppingSmartSuggestions } from "./shopping/ShoppingSmartSuggestions";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "../../lib/planning/shoppingDisplayGroups.ts";
import { ShoppingListRow } from "./shopping/ShoppingListRow.tsx";
import { ScreenChrome } from "./suppr/screen-chrome.tsx";
import { sortShoppingCategories } from "../../lib/planning/shoppingAisleOrder.ts";
import { withNormalizedShoppingFields } from "../../lib/planning/normalizeShoppingIngredientRow.ts";
import { formatShoppingListSubtitle } from "../../lib/planning/shoppingListMeta.ts";
import {
  formatShoppingProgressSubtitle,
  formatShoppingWeekEyebrow,
} from "../../lib/planning/shoppingListDisplay.ts";
import { appendPantryStaple } from "../../lib/planning/pantryStaples.ts";
import { getMyHousehold, type HouseholdData } from "../../lib/household/householdClient.ts";
import { householdMemberFirstName } from "../../lib/household/memberAccents.ts";
import { SupprButton } from "./suppr/suppr-button.tsx";
import type { UserTier } from "../../types/recipe.ts";

interface ShoppingListProps {
  userTier: UserTier;
  onUpgrade?: () => void;
  onNavigate?: (view: string) => void;
}

/**
 * Web Shopping list — F3 hybrid lifecycle
 * (`docs/decisions/2026-04-28-shopping-list-web-parity-hybrid.md`), household
 * banner (2026-04-30), ENG-1527 update-from-plan, ENG-1634 smart suggestions.
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
    userId,
    activeHouseholdId,
    shoppingListPlanStartDate,
    shoppingListOutOfSync,
    resyncShoppingListFromPlan,
    pantryStaples,
    savePantryStaples,
  } = useAppData();

  // ENG-1669 — in-store scan density (default ON; PostHog kill switch).
  const densityV1 = isFeatureEnabled("shopping_list_density_v1");
  // Design-consistency pass (2026-07-24) — ONE `ScreenChrome` at every
  // breakpoint, retiring the `hidden md:block` desktop-only title block.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");

  // Member metadata (household only) — banner + per-row attribution chip.
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  useEffect(() => {
    if (!userId || !activeHouseholdId) {
      setHousehold(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        // `supabase` from browserClient.ts is the typed client; the
        // shared household helper takes a structurally-typed client so
        // we cast through `unknown` to keep the isolation contract.
        const { data } = await getMyHousehold(
          supabase as unknown as Parameters<typeof getMyHousehold>[0],
          userId,
        );
        if (!cancelled) setHousehold(data ?? null);
      } catch {
        if (!cancelled) setHousehold(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, activeHouseholdId]);

  const memberById = useMemo(() => {
    const m = new Map<string, { displayName: string; index: number }>();
    (household?.members ?? []).forEach((member, idx) => {
      m.set(member.userId, { displayName: member.displayName, index: idx });
    });
    return m;
  }, [household]);

  const sharedWithLabel = useMemo(() => {
    if (!household?.household || !userId) return null;
    const others = (household.members ?? [])
      .filter((m) => m.userId !== userId)
      .map((m) => householdMemberFirstName(m.displayName));
    if (others.length === 0) return null;
    if (others.length === 1) return `Shared with ${others[0]}`;
    if (others.length === 2) return `Shared with ${others[0]} & ${others[1]}`;
    return `Shared with ${others.slice(0, -1).join(", ")} & ${others[others.length - 1]}`;
  }, [household, userId]);

  const categories = useMemo(
    () => sortShoppingCategories(shoppingItems.map((item) => item.category)),
    [shoppingItems],
  );

  const categorySections = useMemo(
    () =>
      categories.map((category) => ({
        name: category,
        groups: groupShoppingItemsByIngredientName(
          shoppingItems
            .filter((item) => item.category === category)
            .map(withNormalizedShoppingFields),
        ),
      })),
    [categories, shoppingItems],
  );

  const totalItemCount = categorySections.reduce((n, s) => n + s.groups.length, 0);
  const checkedCount = categorySections.reduce(
    (n, s) => n + s.groups.filter((g) => isShoppingGroupFullyChecked(g)).length,
    0,
  );

  // Kill-switch subtitle (pre-unification copy).
  const subtitle = formatShoppingListSubtitle({
    itemCount: totalItemCount,
    planStartDate: shoppingListPlanStartDate,
    outOfSync: shoppingListOutOfSync,
    omitItemCount: densityV1,
  });

  // Chrome meta, shared with mobile: plan week as eyebrow, progress as subtitle.
  const weekEyebrow = formatShoppingWeekEyebrow(shoppingListPlanStartDate);
  const progressSubtitle = formatShoppingProgressSubtitle({
    checkedCount,
    totalCount: totalItemCount,
    outOfSync: shoppingListOutOfSync,
  });

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
    for (const item of group.items) removeShoppingItem(item.id);
  };

  const markGroupAsStaple = useCallback(
    async (group: ShoppingDisplayGroup) => {
      const name = group.displayName.trim();
      if (!name) return;
      const next = appendPantryStaple(pantryStaples, name);
      await savePantryStaples(next);
      for (const item of group.items) removeShoppingItem(item.id);
      toast.success(`"${name}" added to pantry staples — hidden from future lists`);
    },
    [pantryStaples, removeShoppingItem, savePantryStaples],
  );

  const rowsFor = (section: { groups: ShoppingDisplayGroup[] }) => (
    <ul className="flex flex-col">
      {section.groups.map((group) => (
        <ShoppingListRow
          key={group.key}
          group={group}
          densityV1={densityV1}
          activeHouseholdId={activeHouseholdId}
          memberById={memberById}
          onToggle={toggleGroupChecked}
          onRemove={removeGroup}
          onMarkStaple={(g) => {
            void markGroupAsStaple(g);
          }}
        />
      ))}
    </ul>
  );

  const handleClearChecked = () => {
    if (checkedCount === 0) return;
    setShoppingItems((prev) => prev.filter((item) => !item.checked));
  };

  return (
    <>
      {unifiedChrome ? (
        <ScreenChrome
          scope="all"
          overline={weekEyebrow}
          title="Shopping list"
          subtitle={progressSubtitle ?? undefined}
          testID="shopping-screen-chrome"
          overlineTestID="shopping-list-eyebrow"
          titleTestID="shopping-list-title"
        />
      ) : null}
      <div className="product-shell py-pm-6 space-y-5">
      {/* Honeydew parity banner — household only, above the list. */}
      {sharedWithLabel ? (
        <button
          type="button"
          data-testid="shopping-household-banner"
          aria-label={`${sharedWithLabel}. Manage household.`}
          onClick={() => _onNavigate?.("household-settings")}
          className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary/10 text-foreground hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          style={{ maxWidth: 900 }}
        >
          <Users width={14} height={14} className="text-primary shrink-0" aria-hidden />
          <span className="text-[11px] font-semibold">{sharedWithLabel}</span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            Synced live across your household
          </span>
        </button>
      ) : null}

      {/* Kill-switch path: the desktop-only twin `ScreenChrome` retired. */}
      {unifiedChrome ? null : (
      <div className="hidden md:block">
      <h1
        className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"
        style={{ margin: "0 0 4px" }}
      >
        {densityV1 && totalItemCount > 0
          ? `Shopping list (${totalItemCount})`
          : "Shopping list"}
      </h1>
      <p
        className="text-muted-foreground"
        style={{ fontSize: 13, marginBottom: 12 }}
        data-testid="shopping-list-subtitle"
      >
        {subtitle}
      </p>
      </div>
      )}

      {/* ENG-1527 — non-destructive "Update from plan" when the list is stale. */}
      {shoppingListOutOfSync && totalItemCount > 0 && isFeatureEnabled("shopping_update_from_plan_v1") ? (
        <div className="mb-4" style={{ maxWidth: 900 }}>
          <ShoppingUpdateFromPlanButton resync={resyncShoppingListFromPlan} />
        </div>
      ) : null}

      {totalItemCount > 0 && !densityV1 ? (
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
              className="text-[11px] font-semibold text-primary-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded shrink-0"
            >
              Remove {checkedCount} checked
            </button>
          ) : null}
        </div>
      ) : null}
      {totalItemCount > 0 && densityV1 && checkedCount > 0 ? (
        <div className="mb-4" style={{ maxWidth: 900 }}>
          <button
            type="button"
            onClick={handleClearChecked}
            data-testid="shopping-clear-checked"
            className="text-[11px] font-semibold text-muted-foreground hover:text-primary-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            title="Remove checked items"
          >
            Clear checked
          </button>
        </div>
      ) : null}

      {/* ENG-1634 — Smart suggestions (flag-gated; mobile parity). */}
      <ShoppingSmartSuggestions />

      {totalItemCount === 0 ? (
        <SupprCard
          // One card grammar (ENG-1497 / ENG-1499): page-ground cards are FLAT
          // + hairline at the 24px `--radius-card-lg` corner (`.card-slab`).
          elevation="card"
          padding="none"
          radius="xl"
          className="px-6 py-12 text-center"
          style={{ maxWidth: 900 }}
        >
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/[0.08]">
            <Icons.shopping className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground-brand mb-1.5">
            Your shopping list builds itself
          </p>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Plan your meals for the week and we&apos;ll gather every ingredient into one list, grouped by aisle.
          </p>
          {_onNavigate ? (unifiedChrome ? (
            /* The hand-rolled 1.5px outline pill was a third variant the system
               does not have, and disagreed with mobile's ghost empty-state CTA. */
            <SupprButton variant="ghost" className="mt-5" onClick={() => _onNavigate("plan")}>
              Start planning
            </SupprButton>
          ) : (
            <button
              type="button"
              onClick={() => _onNavigate("plan")}
              /* Kill-switch path: the retired Sloe-§1 aubergine OUTLINE pill. */
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-transparent border-[1.5px] border-primary-solid px-5 py-2.5 text-sm font-bold text-primary-solid hover:bg-primary/5 transition-colors"
            >
              Start planning
            </button>
          )) : null}
        </SupprCard>
      ) : (
        <div
          className={
            densityV1
              ? "flex flex-col gap-6"
              : "grid grid-cols-1 md:grid-cols-3 gap-4"
          }
          style={{ maxWidth: densityV1 ? 560 : 900 }}
        >
          {categorySections.map((section) => {
            const sectionTotal = section.groups.length;
            const sectionChecked = section.groups.filter((g) =>
              isShoppingGroupFullyChecked(g),
            ).length;
            if (densityV1) {
              return (
                <section key={section.name}>
                  <h2 className="text-[15px] font-bold tracking-tight text-foreground mb-2">
                    {section.name}
                  </h2>
                  {rowsFor(section)}
                </section>
              );
            }
            return (
            <SupprCard
              key={section.name}
              // One card grammar (ENG-1497 / ENG-1499): page-ground aisle card →
              // FLAT + hairline at the 24px corner, matching mobile.
              elevation="card"
              padding="none"
              radius="xl"
              style={{ padding: 14 }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 10 }}
              >
                {/* Gap 8 (parity): Newsreader serif, matching mobile Type.headline. */}
                <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium tracking-tight text-foreground-secondary">
                  {section.name}
                </p>
                <span
                  className="text-[11px] font-bold tabular-nums text-muted-foreground"
                  style={{ letterSpacing: 0.5 }}
                >
                  {sectionChecked}/{sectionTotal}
                </span>
              </div>
              {rowsFor(section)}
            </SupprCard>
            );
          })}
        </div>
      )}
      </div>
    </>
  );
});
