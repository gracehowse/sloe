"use client";

import * as React from "react";
import { Mail } from "lucide-react";

import { supabase } from "@/lib/supabase/browserClient";
import {
  acceptHouseholdInvite,
  declineHouseholdInvite,
  listReceivedHouseholdInvites,
  type HouseholdInvite,
} from "@/lib/household/householdClient";
import { Button } from "../ui/button";

/**
 * ReceivedInvitesBanner — F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`,
 * 2026-05-06) web parity. Pulls pending invites addressed to the
 * caller's email (RLS scopes by JWT email) and surfaces an Accept /
 * Decline pair per invite.
 *
 * Mirrors the mobile component at
 * `apps/mobile/components/household/ReceivedInvitesBanner.tsx`. Self-
 * loading; host passes `onAccepted` so household state can be re-pulled
 * after a successful accept.
 */
export interface ReceivedInvitesBannerProps {
  onAccepted?: () => void;
}

export function ReceivedInvitesBanner({ onAccepted }: ReceivedInvitesBannerProps) {
  const [invites, setInvites] = React.useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const result = await listReceivedHouseholdInvites(supabase as any);
    setInvites(result.data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const handleAccept = React.useCallback(
    async (invite: HouseholdInvite) => {
      setBusyId(invite.id);
      setError(null);
      const result = await acceptHouseholdInvite(supabase as any, invite.id);
      setBusyId(null);
      if (result.error) {
        setError(
          result.error === "accept_failed"
            ? "The invite may have expired. Ask the inviter to send a new one."
            : "Try again in a moment.",
        );
        return;
      }
      await reload();
      onAccepted?.();
    },
    [onAccepted, reload],
  );

  const handleDecline = React.useCallback(
    async (invite: HouseholdInvite) => {
      const ok = window.confirm(
        `Decline the invite to join ${invite.invitee_email.split("@")[0]}'s household?`,
      );
      if (!ok) return;
      setBusyId(invite.id);
      setError(null);
      const result = await declineHouseholdInvite(supabase as any, invite.id);
      setBusyId(null);
      if (result.error) {
        setError("Couldn't decline — try again in a moment.");
        return;
      }
      await reload();
    },
    [reload],
  );

  if (loading || invites.length === 0) return null;

  return (
    <div
      className="mb-3 rounded-md border border-primary/40 bg-primary/10 p-4 space-y-2"
      data-testid="household-received-invites-banner"
    >
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-primary" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {invites.length === 1 ? "Household invitation" : `${invites.length} household invitations`}
        </p>
      </div>
      {invites.map((inv) => (
        <div key={inv.id} className="space-y-2 pt-1">
          <p className="text-sm text-foreground">
            You've been invited to join a household.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleAccept(inv)}
              disabled={busyId === inv.id}
              data-testid={`household-invite-accept-${inv.id}`}
              className="flex-1"
            >
              {busyId === inv.id ? "Working…" : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDecline(inv)}
              disabled={busyId === inv.id}
              data-testid={`household-invite-decline-${inv.id}`}
              className="flex-1"
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

export default ReceivedInvitesBanner;
