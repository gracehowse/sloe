# ENG-859 — DMCA designated agent filing checklist

**Owner:** Grace · **Status:** Ops / legal (not engineering) · **Blocks:** §512(c) safe harbour for the recipe-import surface.

Engineering shipped the product path (`app/dmca/page.tsx`, `app/api/dmca-takedown/route.ts`, public agent listing). **Safe harbour is not effective until the agent is registered with the U.S. Copyright Office.**

## Prerequisites

- [ ] Legal entity incorporated (Cayman / US path per `docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`)
- [ ] Registered postal address for the entity (must match `app/dmca/page.tsx` byte-for-byte)
- [ ] DMCA contact email live and monitored (`legal@` or equivalent on the public page)

## Fill-ready field sheet (copyright.gov Designated Agent Directory)

Key these straight into the copyright.gov DMCA Designated Agent registration form.
Values marked **[PENDING]** only exist once the entity is incorporated
(`docs/planning/incorporation-sequence-checklist.md`); everything else is final
and matches the live `/dmca` page today.

| Form field | Value to enter |
|---|---|
| **Service Provider — legal name** | **[PENDING — incorporated entity legal name]** (e.g. "Sloe LLC" / the Delaware LLC or UK Ltd name once formed) |
| **Alternative names** (all names the public knows the service by — file every one, or notices under an unlisted name may not count) | `Sloe`, `Suppr`, `getsloe.com`, `suppr-club.com` — include any others live at launch |
| **Physical/postal address of service provider** | **[PENDING — registered office address from incorporation]** (must match `app/dmca/page.tsx` byte-for-byte after filing) |
| **Designated Agent — name** | Grace Howse (or the entity officer title you prefer, e.g. "DMCA Agent, Sloe") |
| **Designated Agent — physical address** | same as service provider address above — **[PENDING]** |
| **Designated Agent — telephone** | **[PENDING — a monitored contact number]** |
| **Designated Agent — email** | `dmca@getsloe.com` (already live + monitored on the public page) |
| **Filing fee** | $6 (confirm current on copyright.gov) |

**After you file:** record the registration number below **and set it as
`DMCA_AGENT_REG_NUMBER` in the launch environment (Vercel production)** — that
clears the DMCA launch gate in `npm run prelaunch:checklist`, which is RED until
then (it gates the public launch flip only, never the build).

- Registration number: _______________  ·  Effective date: _______________

## Filing steps (copyright.gov)

1. Create / sign in to a copyright.gov account.
2. File **Designation of Agent to Receive Notification of Claimed Infringement** (17 U.S.C. §512(c)(2)).
3. Pay the filing fee (currently $6; confirm on copyright.gov).
4. Record the **registration number** and **effective date** in this doc and in Linear ENG-859.
5. Update `app/dmca/page.tsx` if the listed agent name, address, or email changed during incorporation.
6. Re-read the public `/dmca` page after deploy to confirm it matches the filed designation.

## Post-filing

- [ ] Add takedown runbook link to internal ops (who receives notices, 48h acknowledgement SLA)
- [ ] Close Linear **ENG-859** with filing receipt reference (not commit SHA)
- [ ] Note in launch queue that Gate 0 legal ops item is complete

## References

- `docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md`
- `docs/ux/reviews/2026-06-11-launch-readiness-audit.md` § P0-1
- Linear: ENG-859
