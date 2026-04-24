# Parity — product queue & agent closure rules

**Purpose:** Stop audit / agent loops on “blocked until product forever.” Engineering has already shipped **spec prep** (maps, DoD, tier/API tests). Anything still “open” for **copy, visual polish, or ticketing** lives here—not as phantom rows in [`consolidated-audit-todos-2026-04-24.md`](../planning/consolidated-audit-todos-2026-04-24.md).

---

## Rules for agents

| Agent type | What to do |
|------------|------------|
| **Engineering / repo auditor** | Treat **D-P1-7**, **P-P2-1**, and **P-P2-2** as **closed** in the consolidated audit file. Do not re-open those IDs for “waiting on product.” Recurring parity is **§ D-P1-7** in [`web-mobile-parity-scope.md`](web-mobile-parity-scope.md). |
| **Product** | When you have tickets or a written spec, fill **§ P-P2-1 closure** and/or **§ P-P2-2 closure** below (links + one-line summary + sign-off). If you explicitly **won’t** run a pass, say so with a date— that still closes the loop for readers. |
| **Everyone** | New **intentional** web vs mobile divergences still get recorded in `web-mobile-parity-scope.md` (or `docs/decisions/`)—that is normal product work, not a resurrected D-P1-7 “open bug.” |

---

## D-P1-7 (parity cross-check)

**Not backlog.** Ongoing **process** only: run the quarterly checklist in [`web-mobile-parity-scope.md`](web-mobile-parity-scope.md) § *D-P1-7 — Rolling maintenance*. When you run a pass, bump **Last confirmed** there and the historical note in the consolidated file if you are maintaining that log.

---

## P-P2-1 closure — Discover / Plan / Profile visual parity (product)

**Prep shipped in repo:** [`web-mobile-parity-scope.md`](web-mobile-parity-scope.md) § *Backlog: P-P2-1* (surface map + definition of done).

Product: fill when true.

- **Tickets / spec link(s):**  
- **Acceptance summary** (or “Allow visual divergence for v1 on … because …”):  
- **Sign-off:** Name — Date  

---

## P-P2-2 closure — Voice / photo parity (product)

**Prep shipped in repo:** [`web-mobile-parity-scope.md`](web-mobile-parity-scope.md) § *Backlog: P-P2-2*; engineering verification: `voiceLogRoute` / `photoLogRoute` integration tests, `aiLogging.ts`.

Product: fill when true.

- **Tickets / spec link(s):**  
- **Acceptance summary** (matched strings, Pro vs Free, errors/toasts):  
- **Sign-off:** Name — Date  
