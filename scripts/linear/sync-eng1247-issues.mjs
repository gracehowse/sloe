#!/usr/bin/env node
/**
 * Sync ENG-1247 conformance follow-ups into Linear (idempotent by title).
 *
 * Run: node scripts/linear/sync-eng1247-issues.mjs
 * Dry: node scripts/linear/sync-eng1247-issues.mjs --dry-run
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LINEAR_GQL = "https://api.linear.app/graphql";
const ENG_TEAM_ID = "e72181eb-19be-40ab-96e6-36230cc8352e";

const PROJECTS = {
  reskin: "00ade5a6-708a-4ef6-8701-36533f4684b7",
  recipes: "8d5b5e4d-4575-4f0f-a863-bb15ef38164a",
  plan: "aa87b2ce-9316-4d20-a2f7-201a8672d11f",
  today: "da3f347e-7528-44b3-b355-a3575511868c",
  progress: "a408e48c-df64-4679-b888-8cd27953dc94",
  planImport: "c94a5449-6a35-4665-8811-675f0e35aec9",
  onboarding: "f9e9223a-9f14-43d5-be07-330d06426590",
};

function loadApiKey() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const m = raw.match(/^LINEAR_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
  return process.env.LINEAR_API_KEY?.trim();
}

async function gql(apiKey, query, variables) {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

const ISSUE_BY_NUMBER = `
  query($n: Float!) {
    issues(filter: { number: { eq: $n }, team: { key: { eq: "ENG" } } }, first: 1) {
      nodes { id identifier title state { id name type } }
    }
  }
`;

const ISSUE_BY_TITLE = `
  query($title: String!) {
    issues(filter: { title: { eq: $title }, team: { key: { eq: "ENG" } } }, first: 1) {
      nodes { id identifier title state { id name type } }
    }
  }
`;

const ISSUE_CREATE = `
  mutation($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id identifier title url }
    }
  }
`;

const ISSUE_UPDATE = `
  mutation($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue { identifier state { name } }
    }
  }
`;

const COMMENT_CREATE = `
  mutation($input: CommentCreateInput!) {
    commentCreate(input: $input) { success }
  }
`;

const ISSUE_RELATION_CREATE = `
  mutation($input: IssueRelationCreateInput!) {
    issueRelationCreate(input: $input) { success }
  }
`;

/** @type {{ title: string; state: string; projectId: string; priority: number; description: string; parentNumber?: number }[]} */
const NEW_ISSUES = [
  {
    title: "ENG-1247 P1–P4 — WhyNumber v3, Verify flush, CookMode dark, import clear",
    state: "In Review",
    projectId: PROJECTS.reskin,
    priority: 2,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **PR:** https://github.com/gracehowse/Suppr/pull/618 (open)

Ships behind default-OFF flags:
- \`eng1247_section_a_v1\` — A6 WhyNumber (serif hero, set-ic rows, Keep this target)
- \`recipe_detail_v3_conformance\` — CookMode dark (web + mobile inline + /cook)
- \`sloe_v3_unified_import\` — B15 paste clear (×) + B16 confidence-dot / review-banner grammar

A7 Verify mobile: flush divided list + leading ver-dot (no flag — structural conform).

**Docs:** \`docs/decisions/2026-06-28-eng1247-conformance-completion-status.md\``,
  },
  {
    title: "ENG-1247 — Plan calorie-floor slider wired into mealPlanAlgo (ENG-1254)",
    state: "Done",
    projectId: PROJECTS.plan,
    priority: 3,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **PR:** https://github.com/gracehowse/Suppr/pull/617 (merged)

\`calorieFloorMin\` flows AdjustConstraintsSheet → \`generateMealPlan\` / \`mealPlanAlgo\` (web + mobile).

**Files:** \`src/lib/planning/planAdjustConstraints.ts\`, \`src/lib/nutrition/mealPlanAlgo.ts\`, \`MealPlanner.tsx\`, \`planner.tsx\``,
  },
  {
    title: "ENG-1247 — BatchCook minimal v1 (Grace B3 scope, ENG-1255)",
    state: "Done",
    projectId: PROJECTS.recipes,
    priority: 2,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **PR:** https://github.com/gracehowse/Suppr/pull/617 (merged)

Grace B3 (2026-06-28): recipe picker → batch-size stepper → scaled shopping list → Save/Cook. Web \`BatchCookSheet\` + mobile \`/batch-cook\` route.

**🔒 Out of scope:** assign-portions day×meal planner + fridge pip tracker (not minimal v1).

**Docs:** \`docs/decisions/2026-06-28-eng1247-section-b-ratified.md\` B3`,
  },
  {
    title: "ENG-1247 — Profile read showcase web parity (ENG-1256)",
    state: "Todo",
    projectId: PROJECTS.onboarding,
    priority: 2,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247

**Mobile ✅ shipped** behind \`profile_showcase_v1\` (\`ProfileShowcaseReadView\`). **Web follow-up:** mirror read showcase; legacy \`Profile.tsx\` editor remains until parity lands.

Grace B6 (2026-06-28): read showcase + Settings editor split.

**Mobile ref:** \`apps/mobile/components/profile/ProfileShowcaseReadView.tsx\``,
  },
  {
    title: "ENG-1247 — ConfirmFood 3-tile P/C/F + serif kcal (A2b mix, ENG-1257)",
    state: "Done",
    projectId: PROJECTS.today,
    priority: 3,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **PR:** https://github.com/gracehowse/Suppr/pull/617 (merged)

Grace A2b mix: prototype 3-tile P/C/F row + serif kcal line; richer micro table kept below (web + mobile FoodSearchPanel preview).`,
  },
  {
    title: "ENG-1247 — Plan import MFP reassurance strip (B18)",
    state: "Todo",
    projectId: PROJECTS.planImport,
    priority: 2,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **Ratified:** B18 (2026-06-28)

Add MFP named-tracker reassurance strip or grid on plan import (MFP-exodus moment). Web + mobile parity behind flag if visual.

**Tracker:** \`docs/planning/2026-06-24-eng1247-conformance-backlog.md\` B18`,
  },
  {
    title: "ENG-1247 — WeeklyRecap “The detail” rows + web parity (B21)",
    state: "Todo",
    projectId: PROJECTS.progress,
    priority: 3,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **Ratified:** B21 (2026-06-28)

Add WeeklyRecap "The detail" rows; lift web recap to mobile richness. Web + mobile parity.

**Ref:** \`src/app/components/suppr/weekly-recap-dialog.tsx\`, mobile WeeklyRecapCard`,
  },
  {
    title: "ENG-1247 — DeleteAccount 3-step sheet (B26)",
    state: "Todo",
    projectId: PROJECTS.onboarding,
    priority: 2,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **Ratified:** B26 (2026-06-28)

Build 3-step DeleteAccount sheet: reason + export-first + type-DELETE. Web + mobile parity; destructive flow — legal/security review on copy.`,
  },
  {
    title: "ENG-1247 — ResetPlan keep/clear confirm sheet (B28)",
    state: "Todo",
    projectId: PROJECTS.plan,
    priority: 3,
    parentNumber: 1247,
    description: `**Parent:** ENG-1247 · **Ratified:** B28 (2026-06-28)

Add ResetPlan keep/clear confirm sheet (🆕 build row — lone net-new prototype surface in scope). Web + mobile parity.`,
  },
];

const ENG1247_COMMENT = `## ENG-1247 sync — 2026-06-28

### Shipped on \`main\`
- **PR #617** (merged): B1 AdjustConstraints, B3 BatchCook minimal v1, A2b ConfirmFood, mobile Profile showcase (B6), §A batch (CompleteDay, MealDetail, MealEdit, PlanImport, Barcode), RecipeDetail v3 partial
- **Flags (default OFF):** \`today_hero_decard_v3\`, \`today_quickadd_recents_v3\`, \`loghub_quick_actions_v1\`, \`recipe_detail_v3_conformance\`, \`profile_showcase_v1\`, \`sloe_v3_plan\`, \`eng1247_section_a_v1\`

### In review
- **PR #618:** A6 WhyNumber, A7 Verify flush, CookMode dark, B15–B16 import clear/confidence grammar → child **ENG-1253** (when filed)

### Follow-ups filed (child issues)
| ID | Item | State |
|----|------|-------|
| ENG-1254 | Calorie-floor → mealPlanAlgo | Done |
| ENG-1255 | BatchCook minimal v1 | Done |
| ENG-1256 | Profile web read showcase | Todo |
| ENG-1257 | ConfirmFood A2b mix | Done |
| ENG-1258 | B18 MFP reassurance strip | Todo |
| ENG-1259 | B21 WeeklyRecap detail rows | Todo |
| ENG-1260 | B26 DeleteAccount sheet | Todo |
| ENG-1261 | B28 ResetPlan confirm sheet | Todo |

### §B ratified
All 29 structural calls resolved — \`docs/decisions/2026-06-28-eng1247-section-b-ratified.md\`. Registry 🔒 rows in \`docs/ux/redesign/v3/conformance-backlog.md\`.

### PostHog ramp
Hold flags at 0% for two weeks after merge; then ramp via dashboard (not agent-automated).

### L3 audit tally
21 ✅ · 33 🔒 · 21 ⬜ · 3 🔄 · 1 🆕`;

async function stateIdByName(apiKey, name) {
  const data = await gql(
    apiKey,
    `query($t: ID!) { workflowStates(filter: { team: { id: { eq: $t } } }) { nodes { id name } } }`,
    { t: ENG_TEAM_ID },
  );
  const s = data.workflowStates.nodes.find((n) => n.name === name);
  if (!s) throw new Error(`State not found: ${name}`);
  return s.id;
}

async function getIssueByNumber(apiKey, n) {
  const data = await gql(apiKey, ISSUE_BY_NUMBER, { n });
  return data.issues.nodes[0] ?? null;
}

async function ensureIssue(apiKey, spec, stateIds, parentId, dryRun) {
  const existing = (await gql(apiKey, ISSUE_BY_TITLE, { title: spec.title })).issues.nodes[0];
  if (existing) {
    const targetStateId = stateIds[spec.state];
    if (existing.state.name !== spec.state && targetStateId) {
      if (dryRun) {
        console.log(`  Would update ${existing.identifier} → ${spec.state}`);
      } else {
        await gql(apiKey, ISSUE_UPDATE, {
          id: existing.id,
          input: { stateId: targetStateId },
        });
        console.log(`  Updated ${existing.identifier} → ${spec.state}`);
      }
    } else {
      console.log(`  Skip (exists): ${existing.identifier} (${existing.state.name})`);
    }
    return existing;
  }

  const input = {
    teamId: ENG_TEAM_ID,
    title: spec.title,
    description: spec.description,
    projectId: spec.projectId,
    priority: spec.priority,
    stateId: stateIds[spec.state],
    ...(parentId ? { parentId } : {}),
  };

  if (dryRun) {
    console.log(`  Would create: ${spec.title} [${spec.state}]`);
    return null;
  }

  const data = await gql(apiKey, ISSUE_CREATE, { input });
  const created = data.issueCreate.issue;
  console.log(`  Created: ${created.identifier} → ${created.url}`);
  return created;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error("Missing LINEAR_API_KEY");
    process.exit(1);
  }

  const stateNames = [
    ...new Set([...NEW_ISSUES.map((i) => i.state), "Duplicate", "In Progress"]),
  ];
  const stateIds = {};
  for (const name of stateNames) {
    stateIds[name] = await stateIdByName(apiKey, name);
  }

  const parent = await getIssueByNumber(apiKey, 1247);
  if (!parent) throw new Error("ENG-1247 not found");
  console.log(`Parent: ${parent.identifier} (${parent.state.name})`);

  console.log("\n=== Create / update follow-up issues ===");
  for (const spec of NEW_ISSUES) {
    await ensureIssue(apiKey, spec, stateIds, parent.id, dryRun);
  }

  // ENG-1242 duplicates ENG-1255 scope — mark Duplicate when 1255 exists
  const batch1255 = (await gql(apiKey, ISSUE_BY_NUMBER, { n: 1255 })).issues.nodes[0];
  const eng1242 = await getIssueByNumber(apiKey, 1242);
  if (batch1255 && eng1242 && eng1242.state.name !== "Duplicate" && eng1242.state.name !== "Done") {
    if (dryRun) {
      console.log(`  Would mark ENG-1242 Duplicate (superseded by ${batch1255.identifier})`);
    } else {
      await gql(apiKey, ISSUE_RELATION_CREATE, {
        input: {
          issueId: eng1242.id,
          relatedIssueId: batch1255.id,
          type: "duplicate",
        },
      });
      await gql(apiKey, ISSUE_UPDATE, {
        id: eng1242.id,
        input: { stateId: stateIds.Duplicate },
      });
      await gql(apiKey, COMMENT_CREATE, {
        input: {
          issueId: eng1242.id,
          body: `Superseded by ${batch1255.identifier} (BatchCook minimal v1, Grace B3 — shipped PR #617). Full assign-portions planner remains out of scope.`,
        },
      });
      console.log(`  Marked ENG-1242 Duplicate → ${batch1255.identifier}`);
    }
  }

  // ENG-1246 editorial profile — link to ENG-1256
  const eng1256 = (await gql(apiKey, ISSUE_BY_NUMBER, { n: 1256 })).issues.nodes[0];
  const eng1246 = await getIssueByNumber(apiKey, 1246);
  if (eng1256 && eng1246 && eng1246.state.name === "Backlog") {
    if (dryRun) {
      console.log(`  Would move ENG-1246 → In Progress (mobile done; web tracked in ${eng1256.identifier})`);
    } else {
      await gql(apiKey, ISSUE_UPDATE, {
        id: eng1246.id,
        input: { stateId: stateIds["In Progress"] },
      });
      await gql(apiKey, COMMENT_CREATE, {
        input: {
          issueId: eng1246.id,
          body: `Mobile read showcase shipped behind \`profile_showcase_v1\` (PR #617). Web parity tracked in ${eng1256.identifier} (${eng1256.url}).`,
        },
      });
      console.log(`  Updated ENG-1246 → In Progress (linked ${eng1256.identifier})`);
    }
  }

  console.log("\n=== ENG-1247 status comment ===");
  if (dryRun) {
    console.log("  Would post rollup comment on ENG-1247");
  } else {
    await gql(apiKey, COMMENT_CREATE, {
      input: { issueId: parent.id, body: ENG1247_COMMENT },
    });
    console.log("  Posted ENG-1247 rollup comment");
  }

  console.log(dryRun ? "\nDry run complete." : "\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
