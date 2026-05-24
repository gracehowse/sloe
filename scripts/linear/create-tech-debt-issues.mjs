#!/usr/bin/env node
/**
 * Creates / updates tech-debt Linear issues (idempotent by title).
 *
 * Prerequisites:
 *   export LINEAR_API_KEY='lin_api_...'   # or .env.local
 *
 * Run:
 *   node scripts/linear/create-tech-debt-issues.mjs
 *   node scripts/linear/create-tech-debt-issues.mjs --dry-run
 */

const LINEAR_GQL = "https://api.linear.app/graphql";
const ENG_TEAM_KEY = "ENG";

const P5_PROJECT = "Premium P5 — Architecture enablers";
const PLAN_TAB = "Plan tab";
const RECIPES_TAB = "Recipes tab";
const ONBOARDING_PROJECT = "Onboarding + Auth";
const PROGRESS_TAB = "Progress tab";
const PHASE0_PROJECT = "Phase 0 — Viral push prep";

/** @param {string} apiKey */
async function linearRequest(apiKey, query, variables) {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body.data;
}

function findByName(nodes, name) {
  return nodes.find((n) => n.name === name);
}

const QUERIES = {
  teams: `query { teams(first: 20) { nodes { id key name } } }`,
  projects: `query { projects(first: 250) { nodes { id name } } }`,
  issueByNumber: `
    query IssueByNumber($n: Float!) {
      issues(filter: { number: { eq: $n }, team: { key: { eq: "ENG" } } }, first: 1) {
        nodes { id identifier title priority }
      }
    }
  `,
};

const ISSUE_CREATE = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id identifier title url priority }
    }
  }
`;

const ISSUE_UPDATE = `
  mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue { id identifier priority }
    }
  }
`;

const COMMENT_CREATE = `
  mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
    }
  }
`;

function newIssues(teamId, projectIds) {
  const p5 = projectIds[P5_PROJECT];
  const plan = projectIds[PLAN_TAB];
  const recipes = projectIds[RECIPES_TAB];
  const onb = projectIds[ONBOARDING_PROJECT];

  return [
    {
      title: "Tech debt: OFF ODbL — cache-only (Option A)",
      priority: 2,
      projectId: p5,
      description: `**Source:** TODO OFF-1 · \`docs/decisions/2026-04-19-off-odbl-architecture.md\`

## Problem
OFF data is persisted into commingled \`foods\` / \`user_foods\`, creating ODbL share-alike risk as scan volume grows.

## Scope (Option A — preferred)
- Treat OFF as **pass-through**: edge cache (Upstash Redis, short TTL)
- On log: snapshot macros to private meal/journal row; store barcode ref for re-fetch
- **Do not** write OFF rows into \`foods\` / \`user_foods\`
- Prune / stop new writes from migration paths

## Touch points
- \`src/lib/openFoodFacts/fetchProductByBarcode.ts\`
- \`src/lib/openFoodFacts/searchProducts.ts\`
- \`src/context/AppDataContext.tsx\`
- \`supabase/migrations/20260408170000_food_db_unification.sql\` (audit write paths)

## Estimate
1–3 eng-days + data-integrity + legal sign-off

## Priority stack
P5 / platform — before \`foods\` table growth argues "substantial part" of OFF.`,
    },
    {
      title: "Tech debt: saveVerifiedIngredients atomic RPC",
      priority: 3,
      projectId: recipes,
      description: `**Source:** TODO.md · \`docs/planning/archive/ongoing-backlog.md\`

## Problem
\`apps/mobile/lib/verifyRecipe.ts\` (~line 1005) writes recipe totals (\`is_verified: true\`) then loops per-ingredient updates. If one ingredient update fails, totals are verified against an inconsistent ingredient set.

## Fix
Supabase RPC wrapping totals + all ingredient writes in a **single transaction**.

## Review
- \`data-integrity\` — RPC signature + rollback behaviour
- \`security-reviewer\` — RLS on RPC

## Related
Route residual \`catch {}\` at verifyRecipe.ts:843 to Sentry (separate small follow-up).`,
    },
    {
      title: "Tech debt: Onboarding web/mobile flow parity",
      priority: 3,
      projectId: onb,
      description: `**Source:** TODO.md · ongoing-backlog

## Problem
Web onboarding is **4 steps** (\`app/onboarding/page.tsx\`) vs mobile **11 steps** (\`apps/mobile/app/onboarding.tsx\`). Violates web/mobile parity rule — accidental divergence in goals, copy, and completion criteria.

## Approach
1. **Spec first** (\`ui-product-designer\` + \`sync-enforcer\`) — one canonical step map; note intentional platform-native UI only where required
2. Converge step count + data collected (targets, permissions, first plan)
3. Shared analytics events for funnel comparison

## Out of scope
Pixel-perfect UI clone — behaviour and data parity only.

## Related
ENG-125 (post-onboarding edit affordance) — keep separate.`,
    },
    {
      title: "Tech debt: Planner web day-refit after meal swap",
      priority: 3,
      projectId: plan,
      description: `**Source:** Tech-debt review May 2026 (mobile shipped, web gap)

## Problem
Mobile \`planner.tsx\` swap path calls \`refitDayMealsToTargets\` to re-scale **all meals on the day** after a single swap (ENG-647+ joint-fit parity).

Web \`MealPlanner.tsx\` swap likely still adjusts one slot only → day totals drift (C/F/Fi chips off) after manual swap.

## Fix
- Import \`refitDayMealsToTargets\` from \`generateMealPlan.ts\` / \`mealPlanAlgo.ts\`
- After swap: build base macros per slot from recipe pool, refit, apply scaled macros to all day meals
- Match mobile behaviour in \`apps/mobile/app/(tabs)/planner.tsx\` swap handler

## Test
Extend \`mealPlanWebMobileParity\` or planner unit test for swap+refit if feasible.`,
    },
    {
      title: "Tech debt program — Q3 2026 priority stack",
      priority: 3,
      projectId: p5,
      description: `Coordination issue for tech debt ordering (May 2026). Not implementation work — track sequencing.

## Priority order
1. **ENG-533** — Premium capture debt CF-3–CF-8 (unblocks audit sign-off)
2. **ENG-619 → ENG-622** — Architecture enablers (\`useToday\`, nutrition-core, App Router)
3. **ENG-620** — After 619 or parallel with clear package boundaries
4. **This issue's children / linked issues** — OFF ODbL, verifyRecipe RPC, onboarding parity, planner web refit
5. **ENG-376 / ENG-62 / ENG-28** — During Recipes/Progress cycles when P5 underway

**Repo doc:** \`docs/planning/tech-debt-linear-program.md\`

## Done when
Stack is reflected in Linear priorities; TODO.md items have ENG links; P5 cycle plan updated.`,
    },
  ].map((i) => ({ ...i, teamId }));
}

const SCHEDULE_COMMENT = `**Tech-debt scheduling (May 2026):** Address during **Cycle 3–4** (Recipes / Progress tab workstreams) while **ENG-619–622** (P5) is underway. See \`docs/planning/tech-debt-linear-program.md\` and parent **Tech debt program — Q3 2026 priority stack\`.`;

const SCHEDULE_ISSUE_NUMBERS = [376, 62, 28];

async function ensureIssue(apiKey, issue, existingTitles, dryRun) {
  if (existingTitles.has(issue.title)) {
    console.log(`  Skip (exists): ${issue.title}`);
    return null;
  }
  const input = {
    teamId: issue.teamId,
    title: issue.title,
    description: issue.description,
    projectId: issue.projectId,
    priority: issue.priority ?? 3,
  };
  if (dryRun) {
    console.log(`  Would create: ${issue.title} (P${issue.priority})`);
    return null;
  }
  const data = await linearRequest(apiKey, ISSUE_CREATE, { input });
  const created = data.issueCreate.issue;
  existingTitles.add(issue.title);
  console.log(`  Created: ${created.identifier} → ${created.url}`);
  return created;
}

async function bumpPriority(apiKey, issueNumber, priority, dryRun) {
  const data = await linearRequest(apiKey, QUERIES.issueByNumber, { n: issueNumber });
  const issue = data.issues.nodes[0];
  if (!issue) {
    console.warn(`  Warn: ENG-${issueNumber} not found`);
    return;
  }
  if (issue.priority === priority) {
    console.log(`  ENG-${issueNumber} already priority ${priority}`);
    return;
  }
  if (dryRun) {
    console.log(`  Would set ENG-${issueNumber} priority → ${priority}`);
    return;
  }
  await linearRequest(apiKey, ISSUE_UPDATE, {
    id: issue.id,
    input: { priority },
  });
  console.log(`  Updated ENG-${issueNumber} priority → ${priority}`);
}

async function addScheduleComment(apiKey, issueNumber, dryRun) {
  const data = await linearRequest(apiKey, QUERIES.issueByNumber, { n: issueNumber });
  const issue = data.issues.nodes[0];
  if (!issue) return;
  if (dryRun) {
    console.log(`  Would comment on ENG-${issueNumber}`);
    return;
  }
  await linearRequest(apiKey, COMMENT_CREATE, {
    input: { issueId: issue.id, body: SCHEDULE_COMMENT },
  });
  console.log(`  Commented ENG-${issueNumber}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing LINEAR_API_KEY");
    process.exit(1);
  }

  const teams = (await linearRequest(apiKey, QUERIES.teams, undefined)).teams.nodes;
  const eng = teams.find((t) => t.key === ENG_TEAM_KEY);
  if (!eng) throw new Error(`Team ${ENG_TEAM_KEY} not found`);

  const projects = (await linearRequest(apiKey, QUERIES.projects, undefined)).projects.nodes;
  const projectIds = {};
  for (const name of [
    P5_PROJECT,
    PLAN_TAB,
    RECIPES_TAB,
    ONBOARDING_PROJECT,
    PROGRESS_TAB,
    PHASE0_PROJECT,
  ]) {
    const p = findByName(projects, name);
    if (!p) console.warn(`Warn: project "${name}" not found`);
    else projectIds[name] = p.id;
  }

  console.log("\n=== Priority bumps ===");
  await bumpPriority(apiKey, 533, 1, dryRun); // Urgent — capture debt unblocks sign-off

  console.log("\n=== New tech-debt issues ===");
  const allTeamIssues = await linearRequest(
    apiKey,
    `query { team(id: "${eng.id}") { issues(first: 250) { nodes { title } } } }`,
    undefined,
  );
  const existingTitles = new Set(
    allTeamIssues.team?.issues?.nodes?.map((i) => i.title) ?? [],
  );

  for (const issue of newIssues(eng.id, projectIds)) {
    if (!issue.projectId) {
      console.warn(`  Skip (no project): ${issue.title}`);
      continue;
    }
    await ensureIssue(apiKey, issue, existingTitles, dryRun);
  }

  console.log("\n=== Schedule comments (ENG-376, 62, 28) ===");
  for (const n of SCHEDULE_ISSUE_NUMBERS) {
    await addScheduleComment(apiKey, n, dryRun);
  }

  console.log(
    dryRun
      ? "\nDry run complete."
      : "\nDone. Update docs/planning/tech-debt-linear-program.md with ENG-### links.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
