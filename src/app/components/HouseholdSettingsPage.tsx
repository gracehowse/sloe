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
import { SupprButton } from "./suppr/suppr-button";
import HouseholdInviteDialog from "./household/HouseholdInviteDialog";
import { useAuthSession } from "../../context/AuthSessionContext";
import { supabase } from "../../lib/supabase/browserClient";
import {
  getMyHousehold,
  setHouseholdMemberShareTargets,
  setHouseholdShareLunch,
  setMemberSharePreset,
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
  fromSchemaSharePreset,
  toSchemaSharePreset,
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
  // F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`, 2026-05-06): the
  // "+ Add" anchor used to navigate to the Plan tab and stop. Now it
  // opens the invite dialog (email send + sent-invites list + code).
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
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

  // Modal-dismissibility audit (2026-04-30) — member-picker bottom
  // sheet previously dismissed via backdrop click only. Wire Escape
  // so keyboard users can close it (the X button below covers the
  // visible-affordance gap; backdrop tap is preserved).
  useEffect(() => {
    if (!editingCell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingCell(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingCell]);

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
              // Netflix-model v1 (2026-05-01) — hydrate from the
              // caller's own `share_preset` on their member row.
              // Falls back to `presetFromShareLunch` for older accounts
              // that haven't saved a preset yet, which reads the
              // legacy `share_lunch` boolean.
              const me = result.members.find((m) => m.userId === authedUserId);
              const schemaPreset = me?.sharePreset;
              const preset = schemaPreset
                ? fromSchemaSharePreset(schemaPreset)
                : presetFromShareLunch(Boolean(result.household?.shareLunch));
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
    if (!data?.household?.id || !authedUserId) return;
    setSaving(true);
    setError(null);
    try {
      // 1) Persist the full grid to local storage — it stays the
      //    source of truth for the `custom` preset's per-cell layout
      //    until the grid-schema migration ships.
      await writeSharingState(webStorage, data.household.id, sharing);
      // 2) Netflix-model v1 (2026-05-01) — write the per-member
      //    `share_preset` column. Supersedes the owner-level
      //    `share_lunch` boolean as the meal-label filter. `share_lunch`
      //    is kept in step for any clients still reading the legacy
      //    flag; a future commit retires that column.
      const schemaPreset = toSchemaSharePreset(sharing.preset);
      const { error: presetErr } = await setMemberSharePreset(
        supabase as any,
        authedUserId,
        schemaPreset,
      );
      if (presetErr) {
        setError("Your sharing preference couldn't be saved.");
      }
      const nextShareLunch = deriveShareLunch(sharing.grid);
      if (Boolean(data.household.shareLunch) !== nextShareLunch && data.household.isOwner) {
        await setHouseholdShareLunch(
          supabase as any,
          data.household.id,
          nextShareLunch,
        );
      }
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 1800);
    } catch (e) {
      setError((e as Error).message || "Couldn't save household settings.");
    } finally {
      setSaving(false);
    }
  }, [data, sharing, authedUserId]);

  if (!authedUserId) {
    return (
      <div className="product-shell py-pm-5">
        <p className="text-sm text-muted-foreground">Sign in to manage your household.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="product-shell py-pm-5">
        <p className="text-sm text-muted-foreground">Loading household…</p>
      </div>
    );
  }

  if (!data?.household) {
    return (
      <div className="product-shell py-pm-5">
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
    <div className="product-shell py-pm-5 pb-32">
      <Header onBack={onBack} />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs"
          style={{ color: "var(--accent-destructive-solid, #9E3F2E)" }}
        >
          {error}
        </div>
      ) : null}

      {/* Solo-household empty card — ports mobile household-settings-solo-empty.
          When the user is the only member the sharing grid is meaningless; surface
          an invite prompt at the top so the next action is obvious. §10.7 empty-state
          recipe: Newsreader-italic headline + Inter body + CTA. */}
      {members.length <= 1 ? (
        <div
          data-testid="household-settings-solo-empty"
          className="mb-4 rounded-lg border border-primary/20 p-4 flex flex-col items-center text-center"
          style={{ backgroundColor: "rgba(59,42,77,0.05)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-2 shrink-0"
            style={{ backgroundColor: "rgba(59,42,77,0.12)" }}
          >
            <Icons.add className="w-5 h-5 text-primary" aria-hidden />
          </div>
          {/* §10.7: headline in Newsreader italic */}
          <p className="font-[family-name:var(--font-headline)] italic text-[15px] text-foreground mb-1">
            Household is solo
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3 px-2">
            Invite a partner, flatmate, or family member to share meal plans and shopping lists.
          </p>
          {/* Invite — secondary action → ghost (button system, 2026-06-12).
              Transparent, no border, plum label + plum glyph. Matches mobile
              solo-invite CTA. */}
          <SupprButton
            variant="ghost"
            type="button"
            onClick={() => setInviteDialogOpen(true)}
            data-testid="household-settings-solo-invite"
            aria-label="Invite a household member"
          >
            <Icons.add className="w-3.5 h-3.5" aria-hidden />
            Invite
          </SupprButton>
        </div>
      ) : null}

      {/* Members */}
      <section className="mb-4" data-testid="household-settings-members">
        <div className="flex items-center justify-between mb-2">
          {/* §2.3 section eyebrow: Inter 11px, uppercase, +0.08em tracking, sage #7C8466 */}
          <p className="text-[11px] font-bold uppercase text-[#7C8466]" style={{ letterSpacing: "0.88px" }}>
            Members
          </p>
          <button
            type="button"
            onClick={() => setInviteDialogOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            data-testid="household-settings-add"
            aria-label="Invite a household member"
          >
            <Icons.add className="w-3 h-3" aria-hidden />
            Invite
          </button>
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
            // 2026-05-02 chevron-fix: own row routes to ?view=targets so
            // the affordance no longer leads nowhere (user feedback,
            // claude/household-section-streak-sidebar-bundle). Other
            // members render a non-interactive row without a chevron
            // until a read-only member detail surface ships — matching
            // mobile parity.
            const inner = (
              <>
                <span
                  aria-hidden
                  className="inline-grid place-items-center w-9 h-9 rounded-full text-xs font-bold text-foreground shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* §3.12 identity row: display name in Newsreader serif */}
                    <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground truncate">
                      {m.displayName}
                    </p>
                    {/* §3.12 "You" pill on the self row */}
                    {isSelf ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ backgroundColor: "rgba(91,59,110,0.12)", color: "#3B2A4D" }}
                      >
                        You
                      </span>
                    ) : (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        · {m.role}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{macroCopy}</p>
                </div>
                {isSelf ? (
                  <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                ) : null}
              </>
            );
            if (isSelf) {
              return (
                <a
                  key={m.userId}
                  href="/home?view=targets"
                  data-testid={`household-settings-member-row-${m.userId}`}
                  aria-label={`Edit your targets — ${m.displayName}`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  {inner}
                </a>
              );
            }
            return (
              <div
                key={m.userId}
                data-testid={`household-settings-member-row-${m.userId}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* Privacy — per-member share_targets opt-in (H4, 2026-04-21) */}
      <section className="mb-4" data-testid="household-settings-privacy">
        {/* §2.3 section eyebrow: sage #7C8466, +0.08em tracking */}
        <p className="text-[11px] font-bold uppercase mb-2 text-[#7C8466]" style={{ letterSpacing: "0.88px" }}>
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
        {/* §2.3 section eyebrow: sage #7C8466 */}
        <p className="text-[11px] font-bold uppercase mb-2 text-[#7C8466]" style={{ letterSpacing: "0.88px" }}>
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
        <div className="flex items-baseline justify-between mb-2">
          {/* §2.3 section eyebrow: sage #7C8466 */}
          <p className="text-[11px] font-bold uppercase text-[#7C8466]" style={{ letterSpacing: "0.88px" }}>
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
                          ? "bg-primary/20 text-primary-solid border-primary/30"
                          : isSome
                            ? "bg-primary/10 text-primary-solid border-primary/30"
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
                className="inline-grid place-items-center w-[18px] h-[18px] rounded-full text-[9px] font-bold text-foreground"
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
        {/* The footer's ONE commit action → SupprButton variant="primary"
            (solid aubergine pill, white label — button system 2026-06-12).
            Supersedes the aubergine-OUTLINE treatment. Mobile parity:
            `apps/mobile/app/household-settings.tsx`. */}
        <SupprButton
          variant="primary"
          type="button"
          onClick={() => void onSave()}
          loading={saving}
          disabled={!household.isOwner}
          data-testid="household-settings-save"
          className="w-full"
          title={household.isOwner ? undefined : "Only the household owner can change sharing"}
        >
          {/* DC12 (2026-05-14, premium-bar audit) — specific
              confirmation. Mobile parity:
              `apps/mobile/app/household-settings.tsx`. */}
          {saving ? "Saving…" : savedToast ? "Household saved" : "Save changes"}
        </SupprButton>
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
          {/* §10.3 sheet radius: 20pt (aligns with mobile SHEET_RADIUS=20) — deferred: see ENG-998 for token */}
          <div
            className="w-full max-w-md border border-border bg-background p-5 pb-7 relative"
            style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4 opacity-60" />
            {/* Modal-dismissibility audit (2026-04-30) — visible close
                affordance so the sheet doesn't feel trapped on touch
                devices where the backdrop area is small. */}
            <button
              type="button"
              onClick={() => setEditingCell(null)}
              aria-label="Close member picker"
              className="absolute top-4 right-4 w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <Icons.close className="w-4 h-4" aria-hidden />
            </button>
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
                    className="inline-grid place-items-center w-8 h-8 rounded-full text-[11px] font-bold text-foreground shrink-0"
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

      {/* F-111 invite dialog — opens from the Members section "Invite"
          button. Sends email-targeted invites via the
          household_invite_send RPC; falls back to the 6-char code. */}
      {data?.household && (
        <HouseholdInviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          householdId={data.household.id}
          inviteCode={data.household.invite_code}
        />
      )}
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
      {/* §2.2 display-title: Newsreader serif 28px — matches mobile FontFamily.serifSemibold 28sp. */}
      <h1 className="font-[family-name:var(--font-headline)] text-[28px] font-semibold text-foreground -tracking-[0.02em] leading-tight">Household</h1>
    </div>
  );
}
