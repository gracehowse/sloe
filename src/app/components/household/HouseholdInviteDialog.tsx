"use client";

import * as React from "react";
import { Mail, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { supabase } from "@/lib/supabase/browserClient";
import { isFeatureEnabled } from "@/lib/analytics/track";
import {
  cancelHouseholdInvite,
  listSentHouseholdInvites,
  sendHouseholdInvite,
  type HouseholdInvite,
} from "@/lib/household/householdClient";
import {
  getOrCreateReferralReward,
  REFERRAL_FLAG,
  type ReferralReward,
} from "@/lib/referrals/referralClient";
import { ReferralRewardCard } from "./ReferralRewardCard";

/**
 * HouseholdInviteDialog — F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`,
 * 2026-05-06) web parity for the email-targeted household invite flow.
 *
 * Replaces the dead `/home?view=plan` anchor that the "+ Add" button on
 * HouseholdSettingsPage used to be. Opens a Radix dialog with:
 *   - Email input + "Send invite" button.
 *   - Sent-invites list with status pill + cancel for pending rows.
 *   - Invite code fallback for share-by-code joins.
 *
 * Mirrors `apps/mobile/components/household/HouseholdInviteSheet.tsx`.
 */
export interface HouseholdInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  inviteCode: string;
}

const STATUS_LABEL: Record<HouseholdInvite["status"], string> = {
  pending: "Pending",
  accepted: "Joined",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

const ERROR_COPY: Record<string, string> = {
  missing_email: "Add an email address first.",
  invalid_email: "That doesn't look like a valid email.",
  cannot_invite_self: "You can't invite yourself.",
  not_household_owner: "Only the household owner can send invites.",
  invite_failed: "Couldn't send the invite — try again in a moment.",
  cancel_failed: "Couldn't cancel that invite.",
  load_failed: "Couldn't load invites.",
};

export function HouseholdInviteDialog({
  open,
  onOpenChange,
  householdId,
  inviteCode,
}: HouseholdInviteDialogProps) {
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [invites, setInvites] = React.useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [referralReward, setReferralReward] = React.useState<ReferralReward | null>(null);
  const [referralLoading, setReferralLoading] = React.useState(false);
  const [referralError, setReferralError] = React.useState<string | null>(null);
  const referralEnabled = isFeatureEnabled(REFERRAL_FLAG);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const result = await listSentHouseholdInvites(supabase as any, householdId);
    setInvites(result.data ?? []);
    setLoading(false);
  }, [householdId]);

  React.useEffect(() => {
    if (open) {
      void reload();
      setError(null);
    } else {
      setEmail("");
    }
  }, [open, reload]);

  React.useEffect(() => {
    if (!open || !referralEnabled) return;
    let cancelled = false;
    setReferralLoading(true);
    setReferralError(null);
    void getOrCreateReferralReward(supabase as any, window.location.origin)
      .then((result) => {
        if (cancelled) return;
        setReferralReward(result.data);
        setReferralError(result.error);
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, referralEnabled]);

  const onSend = React.useCallback(async () => {
    setSending(true);
    setError(null);
    const result = await sendHouseholdInvite(supabase as any, householdId, email);
    setSending(false);
    if (result.error) {
      setError(ERROR_COPY[result.error] ?? ERROR_COPY.invite_failed!);
      return;
    }
    setEmail("");
    await reload();
  }, [email, householdId, reload]);

  const onCancel = React.useCallback(
    async (invite: HouseholdInvite) => {
      const ok = window.confirm(`Cancel the invite to ${invite.invitee_email}?`);
      if (!ok) return;
      const result = await cancelHouseholdInvite(supabase as any, invite.id);
      if (result.error) {
        setError(ERROR_COPY[result.error] ?? "Couldn't cancel that invite.");
        return;
      }
      await reload();
    },
    [reload],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to household</DialogTitle>
          <DialogDescription>
            Send by email or share the code below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {referralEnabled && (
            <ReferralRewardCard
              reward={referralReward}
              loading={referralLoading}
              error={referralError}
            />
          )}

          {/* Email input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Send by email</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-md border border-border bg-card px-3">
                <Mail className="w-4 h-4 text-muted-foreground" aria-hidden />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sending}
                  data-testid="household-invite-email-input"
                  className="border-0 px-0 focus-visible:ring-0"
                />
              </div>
              <Button
                onClick={onSend}
                disabled={sending || email.trim().length === 0}
                data-testid="household-invite-send"
              >
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              They'll see an Accept / Decline prompt the next time they open Sloe.
            </p>
            {error && (
              <p className="text-xs text-destructive" data-testid="household-invite-error">
                {error}
              </p>
            )}
          </div>

          {/* Sent invites */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Invites sent</label>
            {loading ? (
              <p className="text-xs text-muted-foreground py-2">Loading…</p>
            ) : invites.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No invites yet.</p>
            ) : (
              <ul className="rounded-md border border-border bg-card divide-y divide-border">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 p-3"
                    data-testid={`household-invite-row-${inv.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {inv.invitee_email}
                      </p>
                      <p className="text-xs text-muted-foreground">{STATUS_LABEL[inv.status]}</p>
                    </div>
                    {inv.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => onCancel(inv)}
                        className="text-destructive hover:opacity-80"
                        aria-label={`Cancel invite to ${inv.invitee_email}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Invite code fallback */}
          <div className="space-y-2 rounded-md border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">Or share a code</p>
            <p
              className="text-xl font-extrabold tracking-[0.25em] tabular-nums text-foreground text-center py-1"
              data-testid="household-invite-code"
            >
              {inviteCode.toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Anyone with this code can join from "Join household" on their device.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HouseholdInviteDialog;
