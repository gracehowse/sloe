# Admin corrections queue — runbook

**Route:** `/admin/corrections`
**Spec:** `docs/planning/F-138-P4-admin-queue-spec.md`
**Audience:** Grace, solo admin (today)
**Day-to-day target:** clear the queue in under 10 minutes for ~20 rows

---

## One-time setup

The route is gated by membership in the `admin_users` table (per the
F-138 P0 schema). Seed your admin row once:

```sql
insert into public.admin_users (user_id, note)
select id, 'Grace — F-138 Phase 4 seed (2026-05-10)'
  from auth.users
 where email = 'gracehowse@outlook.com'
on conflict (user_id) do nothing;
```

Run this once via the Supabase SQL editor against the linked project.
Re-running is safe (idempotent).

Non-admins visiting `/admin/corrections` get a 404 (`notFound()`) — the
route's existence is not revealed.

---

## Daily flow

1. Open `/admin/corrections`.
2. The page renders two sections:
   - **Pending review** — `pending` rows, oldest first.
   - **Verified but flagged** — `verified` rows with `flagged_for_admin_at` set, oldest flag first.
3. For each row:
   - Read the submitted macros + plausibility band (green `pass`, amber `warn`, red `block`).
   - If an evidence photo was uploaded, the "Evidence" tile is clickable (see Phase-5 follow-up below — signed URL fetch is the next iteration).
   - Decide one of three actions:
     - **Approve** — values look right vs the label / canonical.
     - **Reject** — values are wrong, no quick fix.
     - **Edit & approve** — values are off by a small amount; correct them inline and submit. Single combined UPDATE writes the new macros + flips status to `verified`.
4. After each action the row removes from the list. The page auto-revalidates via `revalidatePath`.

---

## What each action does

| Action | DB effect | Trigger side-effects |
|---|---|---|
| **Approve** | `update user_foods set verification_status = 'verified', verified_by = admin, verified_at = now(), flagged_for_admin_at = null` | State-machine trigger recomputes `verified_food_canonical` for the barcode. Auto-clears the flag flag per spec §7 Q1. |
| **Reject** | `update user_foods set verification_status = 'rejected', verified_by = admin, verified_at = now(), flagged_for_admin_at = null` | Trigger drops the row from `verified_food_canonical` if it was the source. |
| **Edit & approve** | Single UPDATE: changed macro columns + `verification_status = 'verified'` + admin stamping + flag clear | Macro-edit reset trigger fires only on `verified → verified` macro changes (P0 migration line 192). A combined `pending → verified` write is safe — no trigger loop. |

All actions use the service-role client server-side. The DB state-machine
trigger (P0 migration lines 126–156) gates `verification_status` changes
to `admin_users` members; the UI calls re-assert the admin gate at the
action boundary as defence-in-depth.

---

## What stays out (and why)

Per spec §5:

- **No bulk actions** — solo admin, per-row review is the point.
- **No undo** — approve/reject is one UPDATE; correct via the queue if needed.
- **No mobile admin** — laptop tool.
- **No audit log table** — `verified_by` + `verified_at` stamps + Supabase audit logs suffice for N=1 admin.
- **No moderation chat** — reject with a generic reason; two-way comms is a moderation product.

---

## Open follow-ups

1. **Signed evidence URLs** — the row currently shows "Evidence" / "No
   photo" as a placeholder tile. Phase-5 follow-up wires a short-lived
   (5-min) signed URL helper so clicking the tile opens the original
   submission photo in a new tab. Tracked in the spec §6 effort
   estimate.
2. **Reject-as-duplicate** — spec §3.4 lists this as a separate button.
   For now Reject does the same DB write, and the canonical-per-barcode
   model handles dedup implicitly. Add the explicit "duplicate" reject
   when telemetry shows admins want to distinguish rejections.
3. **Filter / sort UI** — spec §3.5 calls for plausibility-band +
   evidence-present filters. Skipped for v1; revisit if the default
   "oldest first" sort stops being enough.

---

## Troubleshooting

- **404 when visiting the route** — the caller's user id is not in
  `admin_users`. Run the seed SQL above; sign out and back in.
- **"unauthenticated" error from an action** — session cookie expired.
  Refresh the page.
- **"not_admin" error from an action** — admin row was removed.
- **"no_service_role" error** — `SUPABASE_SERVICE_ROLE_KEY` unset in
  the runtime env. Check the Vercel project's environment variables.
- **A row reappears after approve** — `flagged_for_admin_at` is being
  re-set by a new user flag arriving after the admin's action. This
  is expected behaviour; the row will sit in the flagged section until
  flag counts drop below the trigger threshold (P3 migration logic).
