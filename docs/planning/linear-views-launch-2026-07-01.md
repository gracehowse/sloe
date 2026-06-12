# Linear views — launch 2026-07-01

Create these **custom views** in Linear (Team ENG). Filters use labels added 2026-06-12.

## 1. Launch — Gate A

**Purpose:** What blocks the first comped user.

- **Filter:** Label `launch-blocker` OR identifiers ENG-874, ENG-670, ENG-772, ENG-1059
- **State:** Todo, In Progress, In Review, Blocked
- **Sort:** Priority (Urgent first), then manual order per `launch-queue-2026-07-01.md`

## 2. Paid GA — Gate B

**Purpose:** What blocks the first paid transaction (not July 1 free cohort).

- **Filter:** Label `paid-ga-blocker`
- **State:** not Done / not Canceled
- **Sort:** Priority

## 3. Launch Todo queue

**Purpose:** Single WIP queue (≤12).

- **Filter:** State = Todo, Team = ENG
- **Sort:** Manual — drag to match launch-queue doc § Gate A Todo
- **Hide:** paid-ga-only items unless actively working Gate B

## 4. Hygiene — Duplicate

- **Filter:** State = Duplicate
- **Action:** Bulk close or merge quarterly

## 5. WIP alarm

- **Filter:** State = In Progress, Team = ENG
- **Alert:** If count > 4, something is wrong

## Label definitions

| Label | Meaning |
|-------|---------|
| `launch-blocker` | Blocks onboarding first **free/comped** user (Gate A) |
| `paid-ga-blocker` | Blocks first **paid** transaction (Gate B) |

Do not put billing issues on `launch-blocker` unless they also block a comped cohort (they shouldn't).
