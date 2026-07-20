"use client";

import { useCallback, useEffect, useState } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { SupprButton } from "./suppr/suppr-button";
import { DestructiveConfirmDialog } from "./suppr/destructive-confirm-dialog";
import ReceivedInvitesBanner from "./household/ReceivedInvitesBanner";
import { useAuthSession } from "../../context/AuthSessionContext";
import { supabase } from "../../lib/supabase/browserClient";
// ENG-1540: local day-key — date_key rows use the user's LOCAL day, not UTC.
import { dateKeyFromDate } from "../../lib/datetime/dateKey";
// Direct-to-Supabase household client. Web previously used the Next.js
// REST routes at /api/household; the routes still exist but the runtime
// path is now the shared client so web + mobile stay structurally
// identical (TestFlight feedback AAegi1DJEiscjIFi_pYaep4 also fixed a
// long-standing broken Authorization header here that passed an
// unresolved Promise as the bearer value).
import {
  createHousehold as createHouseholdRemote,
  getMyHousehold,
  joinHouseholdByInviteCode,
  leaveHousehold as leaveHouseholdRemote,
  setHouseholdShareLunch,
  type HouseholdData,
} from "../../lib/household/householdClient";
// F-16 legal-approved copy + banner storage key. Imported from the
// shared module so web + mobile cannot silently diverge — the parity
// test in `tests/unit/householdJoinDisclosureCopy.test.ts` pins
// verbatim equality.
import {
  HOUSEHOLD_CARD_HEADER_COPY,
  HOUSEHOLD_JOIN_DISCLOSURE_COPY,
  SCOPE_NARROWING_NOTICE_COPY,
  SCOPE_NARROWING_NOTICE_KEY,
  SHARE_LUNCH_TOGGLE_HELPER,
  SHARE_LUNCH_TOGGLE_LABEL,
  TARGETS_PRIVATE_LABEL,
} from "../../lib/household/scopeCopy";

// F-142 (2026-05-10): the createHousehold envelope now carries
// `{ code, message, raw }` instead of a string, with the friendly
// copy authored once in the shared client. The mapper here is a
// thin passthrough kept for symmetry with `mapJoinError`.
function mapCreateError(err: { code: string; message: string }): string {
  return err.message;
}

function mapJoinError(code: string): string {
  switch (code) {
    case "missing_code":
      return "Enter the invite code first.";
    case "invalid_code":
      return "No household found with that invite code.";
    case "already_in_household":
      return "Leave your current household first.";
    case "household_full":
      return "This household has reached the maximum of 8 members.";
    case "not_authenticated":
      return "Please sign in again.";
    // T20 (2026-04-24): distinct codes from the hardened RPC.
    case "household_disbanded":
      return "This household has been disbanded.";
    case "invite_expired":
      return "This invite code has expired. Ask the owner for a new one.";
    default: // ENG-1389: rate_limited = per-user invite-code brute-force throttle.
      return code === "rate_limited" ? "Too many attempts. Please wait a minute and try again." : "Couldn't join household.";
  }
}

export function HouseholdPanel() {
  const { authedUserId } = useAuthSession();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [shareLunchSaving, setShareLunchSaving] = useState(false);
  // F-16 one-time scope-narrowing banner. `null` until localStorage
  // is read on mount; `true` = already dismissed; `false` = show it.
  // Fails closed on storage error (banner hidden) so a corrupt
  // localStorage never re-spams the user.
  const [scopeNoticeSeen, setScopeNoticeSeen] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!authedUserId) { setLoading(false); return; }
    try {
      const { data: result, error: loadErr } = await getMyHousehold(supabase as any, authedUserId);
      if (loadErr) {
        setError(loadErr);
      } else if (result) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message || "Couldn't load household.");
    }
    setLoading(false);
  }, [authedUserId]);

  useEffect(() => { void load(); }, [load]);

  // Read the one-time scope-narrowing notice flag. Guarded for SSR +
  // fails closed on any localStorage error.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const v = window.localStorage.getItem(SCOPE_NARROWING_NOTICE_KEY);
      setScopeNoticeSeen(v === "1");
    } catch {
      setScopeNoticeSeen(true);
    }
  }, []);

  const dismissScopeNotice = useCallback(() => {
    setScopeNoticeSeen(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SCOPE_NARROWING_NOTICE_KEY, "1");
      }
    } catch {
      // Best-effort — silent failure is acceptable; the banner stays
      // dismissed for the session and will re-surface next load.
    }
  }, []);

  const toggleShareLunch = useCallback(async (next: boolean) => {
    if (!data?.household?.id) return;
    if (shareLunchSaving) return;
    setShareLunchSaving(true);
    const previous = data;
    // Optimistic update so the switch feels responsive; revert on fail.
    setData({
      ...data,
      household: { ...data.household, shareLunch: next },
    });
    try {
      const { error: updErr } = await setHouseholdShareLunch(supabase as any, data.household.id, next);
      if (updErr) {
        setData(previous);
        setError("Lunch sharing could not be saved. Please try again.");
      } else {
        setError(null);
        void load();
      }
    } catch (e) {
      setData(previous);
      setError((e as Error).message || "Lunch sharing could not be saved.");
    } finally {
      setShareLunchSaving(false);
    }
  }, [data, shareLunchSaving, load]);

  const createHousehold = async () => {
    if (!authedUserId) return;
    setError(null);
    try {
      const { error: createErr } = await createHouseholdRemote(
        supabase as any,
        authedUserId,
        householdName.trim() || undefined,
      );
      if (createErr) {
        // F-142 telemetry parity with mobile — same event name, same
        // properties shape so PostHog dashboards aggregate cleanly.
        try {
          const { track } = await import("@/lib/analytics/track");
          track("household_create_failed", {
            code: createErr.code,
            raw_message: (createErr.raw as any)?.message ?? null,
            raw_code: (createErr.raw as any)?.code ?? null,
          });
        } catch {
          // analytics failure must never block error handling
        }
        // Surface the friendly message authored once in the shared
        // client; `mapCreateError` is a thin passthrough kept for
        // symmetry with `mapJoinError`.
        setError(mapCreateError(createErr));
        return;
      }
      setShowCreate(false);
      setHouseholdName("");
      void load();
    } catch (e) {
      try {
        const { track } = await import("@/lib/analytics/track");
        track("household_create_failed", {
          code: "unexpected_throw",
          raw_message: (e as Error)?.message ?? null,
        });
      } catch {
        // swallow analytics failure
      }
      setError((e as Error).message || "Failed to create household");
    }
  };

  const joinHousehold = async () => {
    setError(null);
    try {
      const { error: joinErr } = await joinHouseholdByInviteCode(
        supabase as any,
        inviteCode.trim(),
      );
      if (joinErr) {
        setError(mapJoinError(joinErr));
        return;
      }
      setShowJoin(false);
      setInviteCode("");
      void load();
    } catch (e) {
      setError((e as Error).message || "Invalid invite code");
    }
  };

  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const leaveHousehold = async () => {
    if (!authedUserId) return;
    try {
      const { error: leaveErr } = await leaveHouseholdRemote(supabase as any, authedUserId);
      if (leaveErr) {
        setError(leaveErr);
        return;
      }
      void load();
    } catch (e) {
      setError((e as Error).message || "Failed to leave household");
    }
  };

  if (!authedUserId) return null;
  if (loading) return <div className="text-sm text-muted-foreground">Loading household...</div>;
  const todayKey = dateKeyFromDate(new Date());
  // One-time F-16 banner. Rendered only after localStorage is read +
  // only when the user has not yet dismissed.
  const scopeBanner = scopeNoticeSeen === false ? (
    <div
      role="status"
      className="mb-3 flex items-start gap-3 rounded-lg border-l-4 border-primary bg-primary/10 p-3"
    >
      <p className="flex-1 text-xs leading-relaxed text-foreground">
        {SCOPE_NARROWING_NOTICE_COPY}
      </p>
      <button
        onClick={dismissScopeNotice}
        aria-label="Dismiss notice"
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  ) : null;

  // No household — show create/join options
  if (!data?.household) {
    // One-treatment elevation (Grace 2026-06-09): the household card sits on
    // the page ground → soft lift (`card-slab`). Was flat slab.
    return (
      <div className="rounded-xl bg-card p-4 card-slab">
        {scopeBanner}
        {/* F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`, 2026-05-06):
            received-invites banner above the create/join CTAs. When
            the user has been invited by an existing household owner,
            this banner appears the moment they open Suppr. Accepting
            joins them to the inviter's household and `onAccepted`
            re-pulls /household state. */}
        <ReceivedInvitesBanner onAccepted={() => void load()} />
        <div className="flex items-center gap-2 mb-3">
          <IconBox size="sm" tone="primary"><Icons.users /></IconBox>
          <p className="text-sm font-semibold text-foreground">Household Meal Planning</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          {HOUSEHOLD_CARD_HEADER_COPY}
        </p>

        {error && <p className="text-xs text-destructive mb-3">{error}</p>}

        {showCreate ? (
          <div className="space-y-2">
            <input
              className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Household name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              maxLength={50}
            />
            <div className="flex gap-2">
              <SupprButton variant="primary" type="button" onClick={() => void createHousehold()}>Create</SupprButton>
              <SupprButton variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</SupprButton>
            </div>
          </div>
        ) : showJoin ? (
          <div className="space-y-2">
            <input
              className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono tracking-wider"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            {/* F-16 scope narrowing (legal-approved 2026-04-25): the
                disclosure now reflects the tightened model — dinners
                only by default, lunches opt-in, targets + remaining
                stay private. Imported verbatim from scopeCopy.ts so
                web + mobile cannot drift (parity test pins this). */}
            <p className="text-[11px] text-muted-foreground leading-snug">
              {HOUSEHOLD_JOIN_DISCLOSURE_COPY}
            </p>
            <div className="flex gap-2">
              <SupprButton variant="primary" type="button" onClick={() => void joinHousehold()}>Join</SupprButton>
              <SupprButton variant="ghost" type="button" onClick={() => setShowJoin(false)}>Cancel</SupprButton>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <SupprButton variant="primary" type="button" onClick={() => setShowCreate(true)} className="flex-1">Create Household</SupprButton>
            <SupprButton variant="ghost" type="button" onClick={() => setShowJoin(true)} className="flex-1">Join with Code</SupprButton>
          </div>
        )}
      </div>
    );
  }

  // Has household — show dashboard
  const todayMeals = data.meals.filter((m) => m.date_key === todayKey);
  const upcomingMeals = data.meals.filter((m) => m.date_key > todayKey);

  return (
    <div className="space-y-4">
      {scopeBanner}
      {/* Header. One-treatment elevation (Grace 2026-06-09): page-ground card
          → soft lift (`card-slab`). Was flat slab. */}
      <div className="rounded-xl bg-card p-4 card-slab">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconBox size="sm" tone="primary"><Icons.users /></IconBox>
            <p className="text-sm font-semibold text-foreground">{data.household.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {data.household.isOwner && (
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="text-xs font-semibold text-primary-solid hover:underline"
              >
                {showInvite ? "Hide code" : "Invite"}
              </button>
            )}
            <button
              onClick={() => setConfirmingLeave(true)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Leave
            </button>
          </div>
        </div>

        {showInvite && (
          <div className="mb-3 p-2.5 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Share this code to invite members</p>
            <p className="text-lg font-mono font-bold text-foreground tracking-[0.3em]">{data.household.invite_code}</p>
          </div>
        )}

        {/* Share-lunch toggle. Owners can flip it; members see the
            state read-only. Control intentionally sits above the
            members list so the scope of what's shared is obvious
            before the reader scans names. */}
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <p className="text-xs font-semibold text-foreground">{SHARE_LUNCH_TOGGLE_LABEL}</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{SHARE_LUNCH_TOGGLE_HELPER}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={data.household.shareLunch}
              onChange={(e) => void toggleShareLunch(e.target.checked)}
              disabled={!data.household.isOwner || shareLunchSaving}
              aria-label={SHARE_LUNCH_TOGGLE_LABEL}
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-disabled:opacity-50 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
          </label>
        </div>

        {/* Members list. Per F-16 legal approval, only the caller's own
            row shows remaining-today numbers. Other members show name
            + role only — the server already strips targets/remaining
            from those rows; this UI matches so a future code path
            that accidentally re-shared them would render nothing.

            G-5 (2026-04-19, TestFlight `AJKHqJeCi83sCHF3_7CZMhY`): the
            four numbers under a member's row were ambiguous ("target?
            consumed? remaining?"). Column labels now read "Cal left /
            Protein left / Carbs left / Fat left" and a one-line
            caption under MEMBERS states what the numbers represent.
            Structural parity with mobile is pinned by
            `tests/unit/householdMemberNumberLabels.test.ts`. */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Members</p>
        <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
          Remaining today — your totals left to hit your targets.
        </p>
        <div className="space-y-1.5">
          {data.members.map((m) => {
            const isSelf = m.userId === authedUserId;
            return (
              <div key={m.userId} className="flex items-center gap-2">
                <span className="text-xs text-foreground font-medium w-28 truncate">
                  {m.displayName}{isSelf ? " (you)" : ""}
                </span>
                {isSelf && m.remaining ? (
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Cal left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: m.remaining.calories > 0 ? "var(--success)" : "var(--accent-warning-solid)" }}>{m.remaining.calories}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Protein left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-protein)" }}>{m.remaining.protein}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Carbs left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-carbs)" }}>{m.remaining.carbs}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Fat left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-fat)" }}>{m.remaining.fat}g</p>
                    </div>
                  </div>
                ) : !isSelf && m.remaining ? (
                  // H4 opt-in path: other member has toggled
                  // share_targets on — render their remaining-today
                  // macros with the same layout as self.
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Cal left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: m.remaining.calories > 0 ? "var(--success)" : "var(--accent-warning-solid)" }}>{m.remaining.calories}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Protein left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-protein)" }}>{m.remaining.protein}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Carbs left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-carbs)" }}>{m.remaining.carbs}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">Fat left</p>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--macro-fat)" }}>{m.remaining.fat}g</p>
                    </div>
                  </div>
                ) : (
                  // H4 default path: targets are null (member hasn't
                  // opted in, or API stripped). Never render "0" or
                  // fall back to numbers — show the privacy label.
                  <span
                    className="flex-1 text-right text-[11px] text-muted-foreground inline-flex items-center justify-end gap-1"
                    aria-label={TARGETS_PRIVATE_LABEL}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    {TARGETS_PRIVATE_LABEL}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's shared meals. One-treatment elevation (Grace 2026-06-09):
          page-ground card → soft lift (`card-slab`). Was flat slab. */}
      <div className="rounded-xl bg-card p-4 card-slab">
        <p className="text-sm font-semibold text-foreground mb-2">Today&apos;s Shared Meals</p>
        {todayMeals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shared meals planned for today.</p>
        ) : (
          <div className="space-y-2">
            {todayMeals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <div>
                  <p className="text-xs font-semibold text-foreground">{meal.recipe_title}</p>
                  <p className="text-[10px] text-muted-foreground">{meal.meal_label} · {meal.servings} servings</p>
                </div>
                {meal.calories_per_serving != null && (
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums text-foreground">{meal.calories_per_serving} kcal</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {meal.protein_per_serving ?? 0}P · {meal.carbs_per_serving ?? 0}C · {meal.fat_per_serving ?? 0}F
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <DestructiveConfirmDialog
        open={confirmingLeave}
        onOpenChange={(open) => {
          if (!open) setConfirmingLeave(false);
        }}
        title="Leave this household?"
        description="You'll keep your own targets and meal history. You can rejoin later with an invite code."
        confirmLabel="Leave"
        onConfirm={() => {
          void leaveHousehold();
        }}
      />

      {/* Upcoming meals. One-treatment elevation (Grace 2026-06-09):
          page-ground card → soft lift (`card-slab`). Was flat slab. */}
      {upcomingMeals.length > 0 && (
        <div className="rounded-xl bg-card p-4 card-slab">
          <p className="text-sm font-semibold text-foreground mb-2">Upcoming</p>
          <div className="space-y-1.5">
            {upcomingMeals.slice(0, 7).map((meal) => (
              <div key={meal.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs text-foreground">{meal.recipe_title}</p>
                  <p className="text-[10px] text-muted-foreground">{meal.date_key.slice(5)} · {meal.meal_label}</p>
                </div>
                {meal.calories_per_serving != null && (
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">{meal.calories_per_serving} kcal/srv</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
