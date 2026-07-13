"use client";

import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "../../../lib/supabase/browserClient.ts";
import { DestructiveConfirmDialog } from "../suppr/destructive-confirm-dialog";

/**
 * ENG-1517 — the web Sign Out control, confirmed before it ends the session
 * (parity with the mobile Settings sign-out row). Extracted from `Profile.tsx`
 * so the confirm-dialog state doesn't grow that legacy screen past its budget.
 * Not styled destructive-red on the trigger — Sign Out is reversible — but the
 * confirm step guards against a stray click, since it sits near Delete account.
 */
export function SignOutButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors mb-4"
      >
        Sign Out
      </button>
      <DestructiveConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out?"
        description="You'll need to sign in again to get back to your plan."
        confirmLabel="Sign Out"
        onConfirm={() => {
          void supabase.auth.signOut();
          toast.success("Signed out");
        }}
      />
    </>
  );
}

export default SignOutButton;
