#!/usr/bin/env node
/**
 * Post audit + delivery comments on ENG-1233–ENG-1251 backlog tickets.
 *
 * Usage:
 *   LINEAR_API_KEY=lin_api_… node scripts/linear/update-eng-backlog-batch.mjs
 *   node scripts/linear/update-eng-backlog-batch.mjs --dry-run
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LINEAR_GQL = "https://api.linear.app/graphql";

function loadApiKey() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    const m = raw.match(/^LINEAR_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
  return process.env.LINEAR_API_KEY?.trim();
}

async function linearRequest(apiKey, query, variables) {
  const res = await fetch(LINEAR_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

const ISSUE_BY_NUMBER = `
  query IssueByNumber($n: Float!) {
    issue(id: $n) { id identifier title state { id name type } }
  }
`;

const ISSUE_SEARCH = `
  query IssueSearch($filter: IssueFilter) {
    issues(filter: $filter, first: 1) {
      nodes { id identifier title state { id name type } }
    }
  }
`;

const COMMENT_CREATE = `
  mutation CommentCreate($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
    }
  }
`;

const ISSUE_UPDATE = `
  mutation IssueUpdate($id: String!, $stateId: String) {
    issueUpdate(id: $id, input: { stateId: $stateId }) {
      success
    }
  }
`;

const STATES = `
  query WorkflowStates($teamId: String!) {
    workflowStates(filter: { team: { id: { eq: $teamId } } }) {
      nodes { id name type }
    }
  }
`;

const TEAM = `
  query Teams {
    teams { nodes { id key name } }
  }
`;

const dryRun = process.argv.includes("--dry-run");

const UPDATES = [
  {
    id: "ENG-1244",
    state: "In Review",
    body: `**Cursor delivery — recipes RLS (server-own \`is_verified\` + anon claim-column lock)**

- Migration: \`supabase/migrations/20260702120400_eng1244_recipe_is_verified_server_owned.sql\`
- Trigger blocks client \`is_verified=true\`; publish policy no longer requires client-set verification
- Anon SELECT grant excludes \`claimed_by\` / \`claimed_at\` / \`claim_verification\`
- **Needs:** Grace to run \`supabase db push --linked\` (forward fix \`20260702120300\` + this migration)`,
  },
  {
    id: "ENG-1250",
    state: "In Review",
    body: `**Cursor delivery — barcode consent withdrawal path**

- Profile columns: \`community_food_share_consent\` + \`community_food_share_consent_at\` (migration \`20260702120500\`)
- Shared helper: \`src/lib/foodCorrection/communityShareConsent.ts\`
- \`submitFoodCorrection\` gated on consent; Settings withdrawal toggle (web + mobile)
- Opt-in sets consent before community write; flag \`barcode_community_contribution\` default OFF`,
  },
  {
    id: "ENG-1251",
    state: "In Review",
    body: `**Cursor delivery — barcode community-share privacy fast-follows**

- Cherry-picked \`BarcodeShareOptIn\` (web + mobile) + privacy policy link
- Consent withdrawal in Settings; community writes blocked when consent is off
- **Ramp gate:** confirm saved-items delete path matches success-card copy before flag ON`,
  },
  {
    id: "ENG-1249",
    state: "Canceled",
    body: `**Legal gate — not shipping free-from chips**

Per \`docs/decisions/2026-06-27-recipe-detail-v3-conformance.md\`, positive Contains + gluten classifier only. Free-from absence claims need legal sign-off + absence data model — intentionally deferred, not a silent gap.`,
  },
  {
    id: "ENG-1239",
    state: "In Review",
    body: `**Cursor delivery — Following feed persists real creator follows**

- \`src/lib/discover/toggleCreatorFollow.ts\` + mobile \`FollowingFeed\` wires non-seed creators to \`follows\` table
- Seed fallback remains until \`creators\` table is populated (content ops)
- Flag: \`discover_creator_rail_v1\` (default OFF)`,
  },
  {
    id: "ENG-1236",
    state: "In Review",
    body: `**Cursor delivery — referral / invite-for-Pro loop (MVP)**

- Settings "Invite friends" share CTA behind \`referral_invite_pro_v1\` (default OFF)
- Deep link \`suppr.app/i/<code>\` + analytics events per viral plan
- **Follow-up:** RevenueCat credit grant RPC + signup attribution`,
  },
  {
    id: "ENG-1235",
    state: "In Review",
    body: `**Cursor delivery — owner Claim → Official toggle**

- SECURITY DEFINER RPC \`mark_recipe_macros_official\` + \`/api/recipes/claim-official\`
- Owner menu action on recipe detail (web + mobile) behind existing claim guards
- **Blocked on prod:** ENG-1244/870 migrations must be pushed first`,
  },
  {
    id: "ENG-1242",
    state: "In Review",
    body: `**Cursor delivery — batch cook scale + portion planner (MVP)**

- \`BatchCookSheet\` behind \`batch_cook_planner_v1\` (default OFF) from Plan tools
- Scale recipe → assign portions across plan slots using existing meal plan fields`,
  },
  {
    id: "ENG-1241",
    state: "In Review",
    body: `**Cursor delivery — onboarding optional skippable upgrade step**

- New \`upgrade\` step in onboarding funnel behind \`onboarding_conversion_funnel_v1\` (default OFF)
- Pro value + "Start trial" / "Continue free" — skippable, Today-first on skip`,
  },
  {
    id: "ENG-1240",
    state: "In Review",
    body: `**Cursor delivery — AI Coach full screen**

- \`app/coach\` (web) + mobile route behind \`coach_full_screen_v1\` (default OFF)
- Reuses \`useCoach\` / \`mealCoach\` engine + chip prompts`,
  },
  {
    id: "ENG-1238",
    state: "In Review",
    body: `**Cursor delivery — Plan per-meal action sheet parity**

- v3 Plan meal long-press sheet: swap, portion, move, remove, lock, mark cooked
- Web planner logs to plan-day \`date_key\` (not always today) when \`plan_web_parity_v1\` ON`,
  },
  {
    id: "ENG-1237",
    state: "In Review",
    body: `**Cursor delivery — Body Composition trends (Pro-gated)**

- \`body_fat_pct_by_day\` jsonb column + Pro-gated trends card behind \`body_composition_trends_v1\`
- Lean mass derived from weight × (1 − BF%) when both exist`,
  },
  {
    id: "ENG-1233",
    state: "In Review",
    body: `**Cursor delivery — onboarding conversion funnel bundle**

- Flag \`onboarding_conversion_funnel_v1\` bundles: skippable upgrade step (ENG-1241) + first-log chips step
- Projection on reveal already shipped (ENG-964); funnel steps default OFF until ramp`,
  },
];

async function resolveIssue(apiKey, identifier) {
  const n = Number(identifier.replace(/^ENG-/i, ""));
  try {
    const data = await linearRequest(apiKey, ISSUE_SEARCH, {
      filter: { number: { eq: n } },
    });
    const issue = data.issues.nodes[0];
    if (issue) return issue;
  } catch {
    /* fall through */
  }
  const data = await linearRequest(apiKey, ISSUE_BY_NUMBER, { n });
  return data.issue;
}

async function main() {
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error("LINEAR_API_KEY missing (.env.local or env)");
    process.exit(1);
  }

  const team = (await linearRequest(apiKey, TEAM)).teams.nodes.find((t) => t.key === "ENG");
  if (!team) throw new Error("ENG team not found");
  const states = (await linearRequest(apiKey, STATES, { teamId: team.id })).workflowStates.nodes;
  const stateId = (name) => states.find((s) => s.name === name)?.id;

  for (const item of UPDATES) {
    const issue = await resolveIssue(apiKey, item.id);
    if (!issue) {
      console.warn(`Skip ${item.id}: not found`);
      continue;
    }
    console.log(`${dryRun ? "[dry-run] " : ""}${item.id} → ${item.state}`);
    if (!dryRun) {
      await linearRequest(apiKey, COMMENT_CREATE, { issueId: issue.id, body: item.body });
      const sid = stateId(item.state);
      if (sid && issue.state?.name !== item.state) {
        await linearRequest(apiKey, ISSUE_UPDATE, { id: issue.id, stateId: sid });
      }
    }
  }
  console.log(dryRun ? "Dry run complete." : "Linear backlog batch updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
