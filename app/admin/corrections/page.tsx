import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import { createSupabaseServiceRoleClient } from "../../../src/lib/supabase/serverAnonClient.ts";
import { QueueRow } from "./QueueRow";

/**
 * F-138 Phase 4 — admin corrections queue.
 *
 * Spec: docs/planning/F-138-P4-admin-queue-spec.md
 *
 * Server component. Two queries land here on every request (no caching —
 * the admin needs to see fresh state after each action):
 *
 *   A. user_foods where verification_status = 'pending'
 *      (oldest first — pending submissions awaiting review)
 *
 *   B. user_foods where verification_status = 'verified'
 *      AND flagged_for_admin_at IS NOT NULL
 *      (oldest flag first — community-flagged verified rows)
 *
 * Auth gate: caller must have a row in `admin_users`. Non-admins get
 * `notFound()` so the route doesn't reveal its existence (spec §3.1 +
 * §4). The state-machine trigger in the P0 migration would block writes
 * from non-admins anyway, but the UI gate is the first line of defence.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CorrectionRow = {
  id: string;
  barcode: string;
  brand: string | null;
  calories: number;
  carbs: number;
  category: string | null;
  created_at: string;
  downvotes: number;
  evidence_url: string | null;
  fat: number;
  fiber_g: number | null;
  flagged_for_admin_at: string | null;
  name: string;
  protein: number;
  saturated_fat_g: number | null;
  serving_size_g: number | null;
  sodium_mg: number | null;
  submitted_by: string | null;
  sugar_g: number | null;
  upvotes: number;
  verification_status: string;
};

export default async function AdminCorrectionsPage() {
  const cookieStore = await cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || `https://${projectId}.supabase.co`;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || publicAnonKey;
  const sessionClient = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // middleware owns writes
      },
    },
  });
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) notFound();

  const admin = createSupabaseServiceRoleClient();
  if (!admin) notFound();

  // Auth gate — admin_users membership. Spec §4: use the existing
  // admin_users table, not a hardcoded email check.
  const { data: adminRow } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) notFound();

  // Section A — pending queue (oldest first).
  const { data: pendingRows } = await admin
    .from("user_foods")
    .select(
      "id, barcode, brand, calories, carbs, category, created_at, downvotes, evidence_url, fat, fiber_g, flagged_for_admin_at, name, protein, saturated_fat_g, serving_size_g, sodium_mg, submitted_by, sugar_g, upvotes, verification_status",
    )
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  // Section B — verified-but-flagged (oldest flag first).
  const { data: flaggedRows } = await admin
    .from("user_foods")
    .select(
      "id, barcode, brand, calories, carbs, category, created_at, downvotes, evidence_url, fat, fiber_g, flagged_for_admin_at, name, protein, saturated_fat_g, serving_size_g, sodium_mg, submitted_by, sugar_g, upvotes, verification_status",
    )
    .eq("verification_status", "verified")
    .not("flagged_for_admin_at", "is", null)
    .order("flagged_for_admin_at", { ascending: true })
    .limit(100);

  const pending = (pendingRows ?? []) as CorrectionRow[];
  const flagged = (flaggedRows ?? []) as CorrectionRow[];
  const totalCount = pending.length + flagged.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Corrections queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalCount === 0
            ? "Inbox zero. No pending or flagged corrections."
            : `${pending.length} pending · ${flagged.length} flagged`}
        </p>
      </header>

      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Pending review · oldest first
          </h2>
          <div className="space-y-3" data-testid="admin-queue-pending-section">
            {pending.map((row) => (
              <QueueRow key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      {flagged.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Verified but flagged · oldest flag first
          </h2>
          <div className="space-y-3" data-testid="admin-queue-flagged-section">
            {flagged.map((row) => (
              <QueueRow key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      {totalCount === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="admin-queue-empty-state">
          The queue is empty.
        </p>
      )}
    </div>
  );
}
