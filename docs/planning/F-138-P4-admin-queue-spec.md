# F-138 Phase 4 — Admin Queue Spec

**Status:** Ready for executor pickup
**Owner (build):** TBD; **owner (consumer):** Grace, solo admin
**Effort:** 1 PR (~1.5 days focused work, including tests)
**Decision doc:** `docs/decisions/2026-05-08-food-correction-verification-pipeline.md` (Phase 4 entry, lines 136–140)
**Schema dependencies:** all P0–P3 migrations already in prod (see §2)

---

## 1. The job-to-be-done

**Once a day (or every other day), Grace opens the queue and clears it.**

Concretely: open `/admin/corrections`, see the list of `pending` rows + any `verified` rows that have been flagged by users, scan each one against its label photo (when present) and its plausibility verdict, and resolve it in under 30 seconds with one of four actions:

1. **Approve** — flip `verification_status` to `verified`. Triggers already recompute `verified_food_canonical` automatically (`20260512100000_user_foods_p0_hardening.sql:332-356`).
2. **Reject** — flip to `rejected`. Done.
3. **Edit-and-approve** — fix one or two macro fields against the label photo, then approve. The macro-edit reset trigger fires only on transitions between `verified` states (lines 192–196 of the same file), so an admin updating a `pending` row and approving in the same write does not loop.
4. **Merge into existing** — when a new pending row duplicates an already-verified row for the same barcode, reject the new one. (No "merge" UI needed — the canonical is per-barcode and `verified_food_canonical` already chooses the best one. See §5.)

Target: clear a queue of 20 rows in under 10 minutes. Anything slower means the surface is overbuilt.

---

## 2. What's already in the database (do not re-spec)

Everything the queue reads from is in prod. The migration files:

**`supabase/migrations/20260414180000_create_user_foods_table.sql`** (base table)
- `user_foods.id, barcode, name, calories, protein, carbs, fat, fiber_g, serving_size_g, submitted_by, created_at, updated_at` (lines 6–19)

**`supabase/migrations/20260414200001_user_foods_verification.sql`** (verification + votes)
- `user_foods.verification_status` (`'pending' | 'verified' | 'rejected'`), `verified_by`, `verified_at`, `upvotes`, `downvotes`, `source`, `brand`, `category`, `image_url` (lines 6–19)
- `user_food_votes` table with full RLS (lines 31–56)
- Unique `(barcode, submitted_by)` constraint (lines 23–24)

**`supabase/migrations/20260430100000_user_foods_micros.sql`** (micros)
- `user_foods.sugar_g, sodium_mg, saturated_fat_g` (lines 20–23)

**`supabase/migrations/20260512100000_user_foods_p0_hardening.sql`** (Phase 1 — load-bearing)
- `admin_users` table with PK = `user_id` (lines 109–114). RLS: a user can read their own row (lines 121–124). **The admin gate already exists.**
- State-machine trigger that blocks non-admins from changing `verification_status` (lines 126–156). **Approve/reject is one UPDATE; the gate is in the database.**
- Macro-edit reset trigger (lines 168–208) — admin edit-and-approve in a single write works because the reset only fires on `verified → verified` macro changes.
- `verified_food_canonical` table + `recompute_verified_food_canonical(barcode)` function (lines 221–327). **Auto-fires on status-change trigger (lines 332–356) — admin queue does not need to call this.**

**`supabase/migrations/20260513100000_user_foods_phase3_votes_flags_evidence.sql`** (Phase 3 — load-bearing)
- Vote-count aggregation trigger keeping `upvotes` / `downvotes` accurate (lines 42–96). **Queue can trust these counts.**
- `user_food_flags` table (lines 129–138) with reason enum `'wrong_data' | 'misleading' | 'duplicate' | 'spam' | 'other'`.
- `user_foods.flagged_for_admin_at` column (line 171) — set by the flag trigger when a `verified` row hits 3 flags. **This is the second queue source.**
- `user_foods.evidence_url` (relative path into private `food-evidence` bucket; lines 237–249). 6 MB ceiling, image MIME types only.
- Storage RLS scoped to `auth.uid()` prefix (lines 270–295) — **the admin queue must use the service-role client to read evidence URLs, since admins are not the submitter.**

**Not in the schema (and intentionally not added):**
- No `submission_method` column (deferred to Phase 5 per decision doc lines 142–144).
- No `plausibility_verdict` column — the gate runs in `apps/mobile/lib/verifyRecipe.ts:1651-1669` at submit time and returns `block` to the user; `pass` / `warn` rows just get inserted. Verdict is not persisted. **The admin queue re-runs the same `checkSubmissionPlausibility(...)` pure helper at read time** so it can show a band without a schema add.
- No `food_corrections_log` audit table. Deferred — see §5.

---

## 3. The queue UI (web only)

### 3.1 Route + auth

- **Route:** `/admin/corrections` (Next.js app router, lives at `app/admin/corrections/page.tsx`).
- **Runtime:** `nodejs` + `dynamic = "force-dynamic"` (matches the `app/account/billing/page.tsx` pattern).
- **Auth:** server-side check in the page itself. Read the Supabase session, then `select 1 from admin_users where user_id = auth.uid()`. If the row is missing → `notFound()` (don't even reveal the route exists).
- **No feature flag.** The route is gated by table membership; flag is redundant complexity.
- See §4 for the recommended seed path.

### 3.2 Default view — one screen, one list

A single full-width table. No tabs, no sub-pages. Two segments stacked:

**Section A — "Pending review" (oldest first)**
SQL: `select * from user_foods where verification_status = 'pending' order by created_at asc`.

**Section B — "Verified but flagged" (oldest flag first)**
SQL: `select * from user_foods where verification_status = 'verified' and flagged_for_admin_at is not null order by flagged_for_admin_at asc`.

Both sections share the same row component.

### 3.3 What each row shows

One row per `user_foods` record. Columns (left to right):

| Column | Source | Notes |
|---|---|---|
| **Submitted name + brand** | `name`, `brand` | Bold name, dim brand under it. |
| **Barcode** | `barcode` | Mono. Click to copy. |
| **Submitted macros** | `calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, saturated_fat_g, serving_size_g` | Per-100g block. Tight. |
| **Canonical (if any)** | `verified_food_canonical` joined on `barcode` | Renders only if a canonical row exists. Shows current verified values for diff context. |
| **Plausibility band** | computed at read time via `checkSubmissionPlausibility(...)` from `src/lib/foodCorrection/plausibility.ts` | Pill: green `pass`, amber `warn`, red `block` (block rows shouldn't exist post-Phase-2 but a stale row pre-Phase-2 might — show it). Show top reason on hover. |
| **Evidence** | `evidence_url` | Thumbnail. Click → opens full-size signed URL in a new tab. Service-role client generates a 5-min signed URL on render. **If null, show "No photo" pill** — that's a strong signal to reject for `submit_to_database` rows once Phase 5 ships `submission_method`; for now it's informational. |
| **Vote tallies** | `upvotes`, `downvotes` | "+12 / -1" format. |
| **Flag count + reasons** | `count(*)` + `reason` from `user_food_flags` joined on `user_food_id` | Show only if non-zero. Reasons as small chips. |
| **Submitter** | `submitted_by` joined to `auth.users.email` (or "anon" if null) | Service-role read. Email truncated to 24 chars. |
| **Submitted** | `created_at` | Relative ("3 days ago"); absolute on hover. |

### 3.4 Actions per row

Four buttons trailing the row, in this order:

1. **Approve** — `update user_foods set verification_status = 'verified' where id = $1`. Trigger handles `verified_at` / `verified_by` stamping (lines 144–147 of P0 migration) and canonical recompute. Done.
2. **Reject** — `update user_foods set verification_status = 'rejected' where id = $1`. Trigger drops it from canonical if it was the source.
3. **Edit & approve** — opens an inline editor (not a modal; expand the row). Same fields as the submitted-macros block, pre-filled. On save: single UPDATE of the changed columns + `verification_status = 'verified'`. **Important:** the macro-reset trigger only fires on `verified → verified` macro changes (line 192 of P0 migration), so a single combined UPDATE on a `pending` row does the right thing.
4. **Reject as duplicate** — same as Reject but writes `verification_status = 'rejected'`. The dedupe is implicit in the canonical-per-barcode model — no merge surface needed (see §5).

All four actions use the service-role client server-side (Server Action). On success, the row removes from the list with a brief toast ("Approved" / "Rejected" / "Updated and approved" / "Marked duplicate"). No undo (see §5).

### 3.5 Filtering / sorting

**Default:** oldest pending first, then verified-but-flagged below.

**Two filters above the table:**
1. **Plausibility band** — All / Pass only / Warn or Block only. (Computed client-side; default All.)
2. **Has evidence photo** — All / With photo / Without photo. (Default All.)

**Sort toggle:** oldest-first (default) or newest-first.

That's it. No search box. No date pickers. No status filter (the section split already does that). If Grace ever sees more than 50 rows in one sitting, add a hard `limit 100` cap and a "Load more" button — until then, render the lot.

---

## 4. Auth

**Recommendation: use the existing `admin_users` table. No hardcoded email check. No new code.**

**Reasoning:**
- The table exists (`20260512100000_user_foods_p0_hardening.sql:109-114`) and the state-machine trigger already gates DB writes against it (lines 137–138). Skipping it for the UI gate would create two sources of truth for "who is an admin."
- An email-string check in the route handler would have to be kept in sync with the DB row anyway — the DB row is the floor, so the UI gate should hit the same row.
- N=1 today. Seeding the row is one SQL statement Grace runs once.

**Seed (one-time, run by Grace):**

```sql
insert into public.admin_users (user_id, note)
select id, 'Grace — F-138 Phase 4 seed (2026-05-10)'
  from auth.users
 where email = 'gracehowse@outlook.com';
```

**Route gate (server-side, in `page.tsx`):**

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) notFound();
const { data: adminRow } = await supabase
  .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
if (!adminRow) notFound();
```

Use `notFound()`, not `redirect('/login')` — non-admins should not learn the route exists.

**No middleware needed.** A single `notFound()` in the page is enough; there are no admin sub-routes to protect.

---

## 5. What stays out (explicit)

Each rejected on the same principle: solo admin, low volume, schema can grow when it has to.

| Out of scope | Why |
|---|---|
| **Bulk actions (multi-select)** | Solo admin, low row count. Per-row review is the point — bulk is how bad approvals slip through. |
| **Mobile admin app / mobile route** | Over-engineering for one user with a laptop. |
| **Undo** | Approve / reject is one UPDATE. If Grace fat-fingers, she opens the row by barcode in `/admin/corrections` and corrects. No `/admin/recently-actioned` view. |
| **Audit log table (`food_corrections_log`)** | Phase 4 of the decision doc lists this as an item, but for N=1 admin the `verified_by` + `verified_at` stamps + Supabase's own audit logs cover the rollback need. Add when admin count > 1. |
| **Contributor reputation system / trust score** | Phase 5 in the decision doc. Don't pre-build the column or the view. |
| **AI auto-approve at high consensus** | Phase 5. Same. |
| **Daily email digest of queue size** | Mentioned in the decision doc (line 138). Skip — Grace will check the queue manually until it's a habit; only build the digest if she stops checking. |
| **In-queue chat with submitter / "request more info"** | Two-way comms is a moderation product. Reject with a generic reason is the lighter call. |
| **Per-flag detail surface** | Show count + reason chips inline. No "view all flaggers" sub-page. |
| **Verified-canonical override UI** | The trigger picks the best `verified` row automatically. If Grace ever needs to override, she edits the chosen row in the queue. No separate canonical editor. |
| **Image moderation / NSFW check on evidence photos** | Photos are private to the bucket; only the admin sees them. Add when the bucket goes public. |
| **Stats dashboard (queue depth over time, approval rate, etc.)** | If she wants this, PostHog event on each action is enough. No in-app dashboard. |
| **Reject reason taxonomy on the admin side** | The flag table already has reasons from users. Admin reject is binary (it's wrong) — don't overload with a reason picker that no one reads. |

---

## 6. Effort estimate

**1 PR. ~1.5 days focused work.**

Breakdown:
- `app/admin/corrections/page.tsx` — server component, two queries + auth gate. ~0.25 day.
- `app/admin/corrections/QueueRow.tsx` + inline-editor sub-component (client component). ~0.5 day.
- Server actions for the four buttons. ~0.25 day.
- Signed-URL helper for evidence images (service-role client, 5-min signed URL). ~0.1 day.
- Plausibility-band computation at read time (pure helper already exists at `src/lib/foodCorrection/plausibility.ts`). ~0.05 day.
- Tests: server-action permission tests (admin-only writes succeed, non-admin returns notFound), plausibility-band rendering snapshot, evidence-URL signing test. ~0.25 day.
- Docs: short runbook at `docs/runbooks/admin-corrections-queue.md` with the seed SQL + how to read the queue. ~0.1 day.

**Mobile parity:** none. Web-only is the call (per task brief).

**No new migration.** If a new column or table sneaks into the implementation, that's a sign the spec was wrong — push back and revisit.

---

## 7. Open questions for Grace

1. **Auto-clear `flagged_for_admin_at` on admin re-approve?** — Right now the column is set by the flag trigger when a `verified` row hits 3 flags, and cleared only when all flags are withdrawn (P3 migration lines 206–211). If Grace reviews a flagged-verified row and re-approves it (the flags were wrong), should the queue UI clear `flagged_for_admin_at` so it doesn't re-appear? **Recommendation: yes — the admin "reviewed and re-approved" action should set `flagged_for_admin_at = null` even if user flags remain.** Worth a one-line confirmation.

2. **What happens to the `evidence_url` after a row is rejected?** — The storage object stays in the bucket forever otherwise. **Recommendation: leave it in place for now (cheap; useful if Grace wants to re-review).** Add a sweep job in Phase 5 once `submission_method` lets us distinguish rejected-DB-submissions (worth keeping) from rejected-own-foods (delete).

3. **Should the queue render `pending` rows that have `evidence_url IS NULL`?** — Pre-Phase-5, mobile lets users submit without a photo (the `submit_to_database` UI requires it but the schema doesn't enforce it). **Recommendation: render them, with the "No photo" pill as a strong reject signal.** Filtering them out hides drift from the queue.

---

## Mirror / handoff

- File this spec at `docs/planning/F-138-P4-admin-queue-spec.md`.
- On ship: add a Roadmap row "F-138 Phase 4 — admin queue" → Shipped; close any matching Tasks DB row; add a Decisions log entry pointing to this spec.
- Runbook to follow at `docs/runbooks/admin-corrections-queue.md` (seed SQL + day-to-day usage).
