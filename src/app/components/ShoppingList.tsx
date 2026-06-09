import { memo, useEffect, useMemo, useState } from "react";
import { Check, Users, X } from "lucide-react";
import { Icons } from "./ui/icons";
import { SupprCard } from "./ui/suppr-card";
import { useAppData } from "../../context/AppDataContext.tsx";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  formatShoppingGroupLabel,
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  type ShoppingDisplayGroup,
} from "../../lib/planning/shoppingDisplayGroups.ts";
import { sortShoppingCategories } from "../../lib/planning/shoppingAisleOrder.ts";
import { withNormalizedShoppingFields } from "../../lib/planning/normalizeShoppingIngredientRow.ts";
import {
  getMyHousehold,
  type HouseholdData,
} from "../../lib/household/householdClient.ts";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "../../lib/household/memberAccents.ts";
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
 * Honeydew parity (2026-04-30): when the user is in a household, the
 * shopping list is shared. Real-time sync (item add/check/remove
 * propagates within ~1s) is wired in `useShoppingListState`. This
 * component surfaces:
 *  - "Shared with Sarah & Tom" banner above the subtitle
 *  - Per-row attribution chip showing who checked an item
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
 * `setShoppingItems` all persist via `useAppData`. The hook also
 * subscribes to Supabase real-time changes and refreshes on every
 * household-mate edit.
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
  } = useAppData();

  // Resolve member metadata once, only when in a household. Used for
  // the "Shared with Sarah & Tom" banner + per-row attribution chip.
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

  const totalItemCount = useMemo(
    () => categorySections.reduce((n, s) => n + s.groups.length, 0),
    [categorySections],
  );

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

  const removeGroup = (group: ShoppingDisplayGroup) => {
    for (const item of group.items) removeShoppingItem(item.id);
  };

  const handleClearChecked = () => {
    if (checkedCount === 0) return;
    setShoppingItems((prev) => prev.filter((item) => !item.checked));
  };

  return (
    <div className="product-shell py-pm-6 space-y-5">
      {/* Honeydew parity banner — visible only when in a household.
          Renders above the title so the user sees who they're shopping
          with before scanning the list. Hidden for solo users. */}
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

      <div className="hidden md:block">
      {/* Sloe DS (Figma 289:2 D8 — Shopping list) — page title reads in
          Newsreader serif plum (`text-foreground-brand`), matching the
          Plan / Today / Progress landmark headings. */}
      <h1
        className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand"
        style={{ margin: "0 0 4px" }}
      >
        Shopping list
      </h1>
      <p className="text-muted-foreground" style={{ fontSize: 13, marginBottom: 12 }}>
        {subtitle}
      </p>
      </div>

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
              className="text-[11px] font-semibold text-primary-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded shrink-0"
            >
              Remove {checkedCount} checked
            </button>
          ) : null}
        </div>
      ) : null}

      {totalItemCount === 0 ? (
        <SupprCard
          padding="none"
          radius="xl"
          className="px-6 py-12 text-center"
          style={{ maxWidth: 900 }}
        >
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/[0.08]">
            <Icons.shopping className="h-6 w-6 text-primary" aria-hidden />
          </div>
          {/* Sloe DS (289:2) — empty-state headline in Newsreader serif plum. */}
          <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground-brand mb-1.5">
            Your shopping list builds itself
          </p>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Plan your meals for the week and we&apos;ll gather every ingredient into one list, grouped by aisle.
          </p>
          {_onNavigate ? (
            <button
              type="button"
              onClick={() => _onNavigate("plan")}
              /* Sloe treatment §1: primary inline CTA = aubergine OUTLINE
                 (transparent fill, 1.5px primarySolid border + label). */
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-transparent border-[1.5px] border-primary-solid px-5 py-2.5 text-sm font-bold text-primary-solid hover:bg-primary/5 transition-colors"
            >
              Start planning
            </button>
          ) : null}
        </SupprCard>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          style={{ maxWidth: 900 }}
        >
          {categorySections.map((section) => {
            const sectionTotal = section.groups.length;
            const sectionChecked = section.groups.filter((g) =>
              isShoppingGroupFullyChecked(g),
            ).length;
            return (
            <SupprCard
              key={section.name}
              padding="none"
              radius="xl"
              style={{ padding: 14 }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 10 }}
              >
                {/* Gap 8 (parity): promote section header to Newsreader serif to match
                    mobile's Type.headline treatment (DS §2.3 + plan.md §3.9
                    'serif group headers'). Drops the ALL-CAPS eyebrow pattern. */}
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
              <ul className="flex flex-col">
                {section.groups.map((group) => {
                  const allChecked = isShoppingGroupFullyChecked(group);
                  const rowLabel = formatShoppingGroupLabel(group);

                  // Honeydew parity (2026-04-30): per-row check
                  // attribution. When the group is checked AND we
                  // have a household AND a single member toggled it,
                  // surface their initials chip.
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
                        aria-label={`${allChecked ? "Uncheck" : "Check"} ${rowLabel}`}
                        className="shrink-0 grid place-items-center transition-colors"
                        style={{
                          // Gap 9 (parity): align checkbox size with mobile (22×22 r11).
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          border: allChecked ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                          background: allChecked ? "var(--primary)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        {allChecked ? (
                          <Check width={11} height={11} strokeWidth={3} className="text-primary-foreground" aria-hidden />
                        ) : null}
                      </button>
                      <span
                        className={`flex-1 ${
                          allChecked
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {rowLabel}
                      </span>
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
                              // Gap 14 (parity): align avatar size with mobile (16×16 full radius).
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
                      <button
                        type="button"
                        onClick={() => removeGroup(group)}
                        aria-label={`Remove ${rowLabel}`}
                        data-testid={`shopping-row-remove-${group.key}`}
                        className="shrink-0 size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X width={14} height={14} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SupprCard>
            );
          })}
        </div>
      )}
    </div>
  );
});
