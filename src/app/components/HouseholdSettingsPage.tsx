"use client";

/**
 * HouseholdSettingsPage — full household settings page.
 *
 * 2026-04-20 Claude Design prototype port
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/flows.jsx`
 * `HouseholdSettings` ~L674). Renders:
 *
 *   - Back chevron + "Household" title
 *   - MEMBERS section (avatar, name + role, macro / restriction meta,
 *     chevron) with a + Add shortcut
 *   - WHICH MEALS ARE SHARED? radio-list (prototype preset copy)
 *   - WEEKLY PLAN 7×4 grid with tap-to-cycle cells + long-press /
 *     right-click to open a member picker modal for fine control
 *   - Per-member colour legend
 *   - Sticky "Save changes" button at the bottom
 *
 * Server state today is a single boolean — `households.share_lunch`
 * — which can't round-trip the full 7×4 grid. We therefore persist
 * the grid to per-household local storage via
 * `sharingGridStorage.ts` AND derive `share_lunch` from the grid for
 * the one server-side column that already gates lunch visibility
 * (F-16 scope narrowing). When the eventual grid-schema migration
 * ships, only the read/write sites change.
 *
 * Invite / create / leave / share-lunch-toggle flows continue to
 * live in `HouseholdPanel` — this page links to it (or to the Plan
 * tab where the panel is rendered) so nothing is duplicated.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { useAuthSession } from "../../context/AuthSessionContext";
import { supabase } from "../../lib/supabase/browserClient";
import {
  getMyHousehold,
  setHouseholdMemberShareTargets,
  setHouseholdShareLunch,
  type HouseholdData,
} from "../../lib/household/householdClient";
import {
  SHARE_TARGETS_TOGGLE_HELPER,
  SHARE_TARGETS_TOGGLE_LABEL,
} from "../../lib/household/scopeCopy";
import {
  HOUSEHOLD_DAY_IDS,
  HOUSEHOLD_SLOT_IDS,
  HOUSEHOLD_SHARING_PRESETS,
  buildGridForPreset,
  cellMembers,
  cycleCell,
  deriveShareLunch,
  emptyGrid,
  presetFromShareLunch,
  sharedCellCount,
  toggleCellMember,
  type HouseholdDayId,
  type HouseholdSharingState,
  type HouseholdSlotId,
} from "../../lib/household/sharingGrid";
import {
  readSharingState,
  writeSharingState,
  type SharingStorageAdapter,
} from "../../lib/household/sharingGridStorage";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
} from "../../lib/household/memberAccents";

export type HouseholdSettingsPageProps = {
  onBack?: () => void;
};

const DAY_LABELS: Record<HouseholdDayId, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const SLOT_META: Record<HouseholdSlotId, { full: string; icon: keyof typeof Icons }> = {
  breakfast: { full: "Breakfast", icon: "breakfast" },
  lunch: { full: "Lunch", icon: "lunch" },
  dinner: { full: "Dinner", icon: "dinner" },
  snack: { full: "Snack", icon: "snack" },
};

/** Web storage adapter — localStorage with SSR guard. */
const webStorage: SharingStorageAdapter = {
  getItem: (k) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(k, v);
    } catch {
      // no-op
    }
  },
  removeItem: (k) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(k);
    } catch {
      // no-op
    }
  },
};

export function HouseholdSettingsPage({ onBack }: HouseholdSettingsPageProps) {
  const { authedUserId } = useAuthSession();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<HouseholdSharingState>({
    preset: "dinners",
    grid: emptyGrid(),
  });
  const [editingCell, setEditingCell] = useState<
    | { day: HouseholdDayId; slot: HouseholdSlotId }
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [shareTargetsSaving, setShareTargetsSaving] = useState(false);

  // Load household + hydrate sharing state.
  useEffect(() => {
    let cancelled = false;
    if (!authedUserId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data: result, error: loadErr } = await getMyHousehold(supabase as any, authedUserId);
        if (cancelled) return;
        if (loadErr) {
          setError(loadErr);
        } else if (result) {
          setData(result);
          // Hydrate sharing state: prefer a locally-persisted grid,
          // fall back to the preset derived from `share_lunch` so the
          // screen opens with a sane default rather than an all-solo
          // grid for first-time visitors.
          const hid = result.household?.id;
          const memberIds = result.members.map((m) => m.userId);
          if (hid) {
            const stored = await readSharingState(webStorage, hid);
            if (stored) {
              if (!cancelled) setSharing(stored);
            } else {
              const preset = presetFromShareLunch(Boolean(result.household?.shareLunch));
              if (!cancelled) {
                setSharing({ preset, grid: buildGridForPreset(preset, memberIds) });
              }
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Couldn't load household.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);
  const me = useMemo(
    () => members.find((m) => m.userId === authedUserId) ?? null,
    [members, authedUserId],
  );
  const myShareTargets = Boolean(me?.shareTargets);

  const onToggleShareTargets = useCallback(
    async (next: boolean) => {
      if (!authedUserId || shareTargetsSaving) return;
      setShareTargetsSaving(true);
      // Optimistic local flip — mirrors mobile parity. Reverts on failure.
      const previous = data;
      setData((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.userId === authedUserId ? { ...m, shareTargets: next } : m,
              ),
            }
          : prev,
      );
      try {
        const { error: updErr } = await setHouseholdMemberShareTargets(
          supabase as any,
          authedUserId,
          next,
        );
        if (updErr) {
          setData(previous);
          setError("Target sharing could not be saved. Please try again.");
        } else {
          setError(null);
        }
      } catch (e) {
        setData(previous);
        setError((e as Error).message || "Target sharing could not be saved.");
      } finally {
        setShareTargetsSaving(false);
      }
    },
    [authedUserId, data, shareTargetsSaving],
  );

  const setPreset = useCallback(
    (p: (typeof HOUSEHOLD_SHARING_PRESETS)[number]["id"]) => {
      if (p === "custom") {
        setSharing((s) => ({ ...s, preset: "custom" }));
        return;
      }
      setSharing({ preset: p, grid: buildGridForPreset(p, memberIds) });
    },
    [memberIds],
  );

  const onCycle = useCallback(
    (day: HouseholdDayId, slot: HouseholdSlotId) => {
      setSharing((s) => ({
        preset: "custom",
        grid: cycleCell(s.grid, day, slot, memberIds),
      }));
    },
    [memberIds],
  );

  const onToggleMember = useCallback(
    (day: HouseholdDayId, slot: HouseholdSlotId, memberId: string) => {
      setSharing((s) => ({
        preset: "custom",
        grid: toggleCellMember(s.grid, day, slot, memberId),
      }));
    },
    [],
  );

  const onSave = useCallback(async () => {
    if (!data?.household?.id) return;
    setSaving(true);
    setError(null);
    try {
      // 1) persist grid locally (source of truth for the settings UI
      //    until a grid schema ships).
      await writeSharingState(webStorage, data.household.id, sharing);
      // 2) derive + persist the server-side boolean so the
      //    legal-gated filter matches the grid.
      const nextShareLunch = deriveShareLunch(sharing.grid);
      if (Boolean(data.household.shareLunch) !== nextShareLunch && data.household.isOwner) {
        const { error: updErr } = await setHouseholdShareLunch(
          supabase as any,
          data.household.id,
          nextShareLunch,
        );
        if (updErr) {
          setError("Lunch sharing could not be saved on the server.");
        }
      }
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 1800);
    } catch (e) {
      setError((e as Error).message || "Couldn't save household settings.");
    } finally {
      setSaving(false);
    }
  }, [data, sharing]);

  if (!authedUserId) {
    return (
      <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
        <p className="text-sm text-muted-foreground">Sign in to manage your household.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
        <p className="text-sm text-muted-foreground">Loading household…</p>
      </div>
    );
  }

  if (!data?.household) {
    return (
      <div className="max-w-2xl mx-auto px-pm-5 py-pm-5">
        <Header onBack={onBack} />
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-2">No household yet</p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Create or join a household from the Plan tab. Sharing settings show up here once
            you&apos;re part of one.
          </p>
          <a
            href="/home?view=plan"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Open Plan
            <Icons.forward className="w-3.5 h-3.5" aria-hidden />
          </a>
        </div>
      </div>
    );
  }

  const household = data.household;
  const totalCells = HOUSEHOLD_DAY_IDS.length * HOUSEHOLD_SLOT_IDS.length;
  const sharedCount = sharedCellCount(sharing.grid);
  const editingMeta = editingCell
    ? {
        day: editingCell.day,
        slot: editingCell.slot,
        slotFull: SLOT_META[editingCell.slot].full,
        dayLabel: DAY_LABELS[editingCell.day],
      }
    : null;

  return (
    <div className="max-w-2xl mx-auto px-pm-5 py-pm-5 pb-32">
      <Header onBack={onBack} />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      {/* Members */}
      <section className="mb-5" data-testid="household-settings-members">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Members
          </p>
          <a
            href="/home?view=plan"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            data-testid="household-settings-add"
          >
            <Icons.add className="w-3 h-3" aria-hidden />
            Add
          </a>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {members.map((m, idx) => {
            const color = householdMemberAccent(idx);
            const initials = householdMemberInitials(m.displayName);
            const isSelf = m.userId === authedUserId;
            const remaining = isSelf ? m.remaining : undefined;
            const targets = isSelf ? m.targets : undefined;
            const macroCopy = remaining
              ? `${targets?.calories ?? 0} kcal · ${targets?.protein ?? 0}g protein`
              : m.role === "owner"
                ? "Owner"
                : "Member";
            return (
              <div
                key={m.userId}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
              >
                <span
                  aria-hidden
                  className="inline-grid place-items-center w-9 h-9 rounded-full text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {m.displayName}
                    {isSelf ? " (you)" : ""}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      · {m.role}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{macroCopy}</p>
                </div>
                <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
              </div>
            );
          })}
        </div>
      </section>

      {/* Privacy — per-member share_targets opt-in (H4, 2026-04-21) */}
      <section className="mb-5" data-testid="household-settings-privacy">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2.5">
          Privacy
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">
              {SHARE_TARGETS_TOGGLE_LABEL}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-1">
              {SHARE_TARGETS_TOGGLE_HELPER}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={myShareTargets}
              onChange={(e) => void onToggleShareTargets(e.target.checked)}
              disabled={shareTargetsSaving || !me}
              aria-label={SHARE_TARGETS_TOGGLE_LABEL}
              data-testid="household-settings-share-targets"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-disabled:opacity-50 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
          </label>
        </div>
      </section>

      {/* Presets */}
      <section className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2.5">
          Which meals are shared?
        </p>
        <div className="rounded-xl border border-border bg-card overflow-hidden" role="radiogroup" aria-label="Sharing presets">
          {HOUSEHOLD_SHARING_PRESETS.map((p, i) => {
            const active = sharing.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreset(p.id)}
                data-testid={`household-preset-${p.id}`}
                className={[
                  "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors",
                  i < HOUSEHOLD_SHARING_PRESETS.length - 1 ? "border-b border-border" : "",
                  active ? "bg-primary/5" : "",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "w-[22px] h-[22px] rounded-full border-2 grid place-items-center shrink-0",
                    active ? "border-primary" : "border-border",
                  ].join(" ")}
                >
                  {active ? <span className="w-2.5 h-2.5 rounded-full bg-primary" /> : null}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">{p.label}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">{p.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Grid */}
      <section className="mb-4">
        <div className="flex items-baseline justify-between mb-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Weekly plan
          </p>
          <p className="text-[11px] text-muted-foreground" data-testid="household-grid-summary">
            {sharedCount} of {totalCells} shared
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div
            className="grid gap-1.5 mb-2"
            style={{ gridTemplateColumns: "28px repeat(7, minmax(0, 1fr))" }}
          >
            <div />
            {HOUSEHOLD_DAY_IDS.map((d) => (
              <div
                key={d}
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center"
              >
                {DAY_LABELS[d]}
              </div>
            ))}
          </div>
          {HOUSEHOLD_SLOT_IDS.map((s) => {
            const Icon = Icons[SLOT_META[s].icon] ?? Icons.dinner;
            return (
              <div
                key={s}
                className="grid gap-1.5 mb-1.5 last:mb-0"
                style={{ gridTemplateColumns: "28px repeat(7, minmax(0, 1fr))" }}
              >
                <div
                  className="grid place-items-center text-muted-foreground"
                  aria-label={SLOT_META[s].full}
                  title={SLOT_META[s].full}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                </div>
                {HOUSEHOLD_DAY_IDS.map((d) => {
                  const mem = cellMembers(sharing.grid, d, s);
                  const count = mem.length;
                  const all = members.length;
                  const isAll = count === all && all > 0;
                  const isSome = count > 1 && count < all;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onCycle(d, s)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setEditingCell({ day: d, slot: s });
                      }}
                      data-testid={`household-grid-cell-${d}-${s}`}
                      title={
                        count === 0
                          ? "Solo"
                          : isAll
                            ? "Everyone"
                            : `${count} people — right-click to customise`
                      }
                      className={[
                        "h-[34px] rounded-lg text-[11px] font-bold tabular-nums grid place-items-center",
                        "border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isAll
                          ? "bg-primary/20 text-primary border-primary/30"
                          : isSome
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-muted text-muted-foreground border-transparent",
                      ].join(" ")}
                    >
                      {count === 0 ? "·" : isAll ? "All" : String(count)}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            Tap a cell to toggle between solo and everyone. Right-click (or long-press on touch) to
            pick specific members.
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-1.5 flex-wrap mt-3">
          {members.map((m, idx) => (
            <div
              key={m.userId}
              className="inline-flex items-center gap-1.5 py-1 pl-1 pr-2.5 rounded-full bg-muted"
            >
              <span
                aria-hidden
                className="inline-grid place-items-center w-[18px] h-[18px] rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: householdMemberAccent(idx) }}
              >
                {householdMemberInitials(m.displayName)}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {householdMemberFirstName(m.displayName)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Save — sticky so long grids don't bury the primary action */}
      <div className="sticky bottom-2 mt-6 pt-4 bg-gradient-to-t from-background via-background/90 to-transparent">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || !household.isOwner}
          data-testid="household-settings-save"
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          title={household.isOwner ? undefined : "Only the household owner can change sharing"}
        >
          {saving ? "Saving…" : savedToast ? "Saved" : "Save changes"}
        </button>
        {!household.isOwner ? (
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Only the household owner can change sharing.
          </p>
        ) : null}
      </div>

      {/* Member picker modal — fine-grained control per cell */}
      {editingMeta ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setEditingCell(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Members for ${editingMeta.slotFull} on ${editingMeta.dayLabel}`}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-border bg-background p-5 pb-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4 opacity-60" />
            <p className="text-sm font-bold text-foreground mb-1">Who&apos;s eating?</p>
            <p className="text-xs text-muted-foreground mb-4">
              {editingMeta.slotFull} · {editingMeta.dayLabel}
            </p>
            {members.map((m, idx) => {
              if (!editingCell) return null;
              const on = cellMembers(sharing.grid, editingCell.day, editingCell.slot).includes(
                m.userId,
              );
              const color = householdMemberAccent(idx);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => onToggleMember(editingCell.day, editingCell.slot, m.userId)}
                  className="flex items-center gap-3 w-full px-1 py-2.5 border-b border-border last:border-b-0 text-left"
                >
                  <span
                    aria-hidden
                    className="inline-grid place-items-center w-8 h-8 rounded-full text-[11px] font-bold text-white shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {householdMemberInitials(m.displayName)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-foreground truncate">
                      {m.displayName}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {m.role === "owner" ? "Owner" : "Member"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={[
                      "w-[22px] h-[22px] rounded-md border-2 grid place-items-center shrink-0",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent",
                    ].join(" ")}
                  >
                    {on ? <Icons.check className="w-3 h-3" /> : null}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setEditingCell(null)}
              className="w-full mt-4 py-3 rounded-xl bg-muted text-foreground text-[13px] font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined") {
      // Default: back to Plan where the panel lives.
      window.location.href = "/home?view=plan";
    }
  }, [onBack]);
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Back"
        className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-foreground hover:bg-muted/50"
      >
        <Icons.back className="w-5 h-5" aria-hidden />
      </button>
      <h1 className="text-[20px] font-bold text-foreground -tracking-[0.01em]">Household</h1>
    </div>
  );
}
