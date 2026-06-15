# ENG-859 — DMCA designated agent filing checklist

**Owner:** Grace · **Status:** Ops / legal (not engineering) · **Blocks:** §512(c) safe harbour for the recipe-import surface.

Engineering shipped the product path (`app/dmca/page.tsx`, `app/api/dmca-takedown/route.ts`, public agent listing). **Safe harbour is not effective until the agent is registered with the U.S. Copyright Office.**

## Prerequisites

- [ ] Legal entity incorporated (Cayman / US path per `docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`)
- [ ] Registered postal address for the entity (must match `app/dmca/page.tsx` byte-for-byte)
- [ ] DMCA contact email live and monitored (`legal@` or equivalent on the public page)

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
