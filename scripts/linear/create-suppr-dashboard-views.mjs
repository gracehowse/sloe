#!/usr/bin/env node
/**
 * Creates Suppr Linear *saved issue views* via the public GraphQL API (`customViewCreate`).
 *
 * Setup:
 *   1. Linear → Settings → Account → Security & Access → Personal API keys → Create key
 *   2. Export it (no "Bearer" prefix):  export LINEAR_API_KEY='lin_api_...'
 *
 * Run:
 *   node scripts/linear/create-suppr-dashboard-views.mjs
 *   node scripts/linear/create-suppr-dashboard-views.mjs --dry-run
 *   node scripts/linear/create-suppr-dashboard-views.mjs --teams=ENG,GROW
 *   node scripts/linear/create-suppr-dashboard-views.mjs --teams=all
 *
 * Docs: https://developers.linear.app/docs/graphql/graphql
 *       https://developers.linear.app/docs/graphql/authentication
 */

const LINEAR_GQL = "https://api.linear.app/graphql";

const VIEW_NAME_PREFIX = "Suppr — ";

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
    const msg = body.errors.map((e) => e.message).join("; ");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body.data;
}

const ACTIVE = { type: { nin: ["completed", "canceled"] } };

const QUERIES = {
  teams: `query Teams { teams(first: 50) { nodes { id name key } } }`,
  initiatives: `query Initiatives { initiatives(first: 50) { nodes { id name } } }`,
  projects: `query Projects { projects(first: 250) { nodes { id name } } }`,
  existingViews: `query Views { customViews(first: 250) { nodes { id name } } }`,
};

const MUTATION = `
  mutation CreateView($input: CustomViewCreateInput!) {
    customViewCreate(input: $input) {
      success
      customView { id name }
    }
  }
`;

function findByName(nodes, name) {
  return nodes.find((n) => n.name === name);
}

function initiativeByIssueProject(initiativeNodes, initiativeName) {
  const ini = findByName(initiativeNodes, initiativeName);
  if (!ini) throw new Error(`Initiative not found: "${initiativeName}"`);
  return ini.id;
}

function projectId(projectNodes, title) {
  const p = findByName(projectNodes, title);
  if (!p) throw new Error(`Project not found: "${title}"`);
  return p.id;
}

function teamId(teamNodes, key) {
  const t = teamNodes.find((n) => n.key === key);
  if (!t) throw new Error(`Team not found with key: "${key}"`);
  return t.id;
}

/**
 * @param {object} ctx
 * @param {{ id: string, name: string }[]} ctx.initiatives
 * @param {{ id: string, name: string }[]} ctx.projects
 * @param {{ id: string, key: string }[]} ctx.teams
 * @param {string} teamKey e.g. ENG | GROW
 * @param {{ suffix: string }} opts suffix appended to view names when not primary team (avoids workspace name collisions)
 */
function buildViewDefinitions(ctx, teamKey, opts = { suffix: "" }) {
  const launchId = initiativeByIssueProject(ctx.initiatives, "Launch 2026-07-01");
  const surfaceId = initiativeByIssueProject(ctx.initiatives, "Surface polish");
  const platformId = initiativeByIssueProject(ctx.initiatives, "Platform foundations");
  const team = teamId(ctx.teams, teamKey);

  const today = projectId(ctx.projects, "Today tab");
  const onboarding = projectId(ctx.projects, "Onboarding + Auth");

  const suffix = opts.suffix ?? "";

  return [
    {
      name: `${VIEW_NAME_PREFIX}Launch command centre${suffix}`,
      description: "Launch initiative, active issues, Urgent + High priority.",
      teamId: team,
      shared: true,
      filterData: {
        and: [
          { project: { initiatives: { some: { id: { eq: launchId } } } } },
          { state: { type: ACTIVE.type } },
          { priority: { in: [1, 2] } },
        ],
      },
    },
    {
      name: `${VIEW_NAME_PREFIX}Today tab${suffix}`,
      description: "Active issues in the Today tab project.",
      teamId: team,
      shared: true,
      filterData: {
        and: [{ project: { id: { eq: today } } }, { state: { type: ACTIVE.type } }],
      },
    },
    {
      name: `${VIEW_NAME_PREFIX}Onboarding + Auth${suffix}`,
      description: "Active issues in Onboarding + Auth.",
      teamId: team,
      shared: true,
      filterData: {
        and: [{ project: { id: { eq: onboarding } } }, { state: { type: ACTIVE.type } }],
      },
    },
    {
      name: `${VIEW_NAME_PREFIX}Surface polish${suffix}`,
      description: "All active issues whose project is under Surface polish initiative.",
      teamId: team,
      shared: true,
      filterData: {
        and: [
          { project: { initiatives: { some: { id: { eq: surfaceId } } } } },
          { state: { type: ACTIVE.type } },
        ],
      },
    },
    {
      name: `${VIEW_NAME_PREFIX}Platform foundations${suffix}`,
      description: "All active issues whose project is under Platform foundations initiative.",
      teamId: team,
      shared: true,
      filterData: {
        and: [
          { project: { initiatives: { some: { id: { eq: platformId } } } } },
          { state: { type: ACTIVE.type } },
        ],
      },
    },
    {
      name: `${VIEW_NAME_PREFIX}Blocked${suffix}`,
      description: "Issues in Blocked workflow state.",
      teamId: team,
      shared: true,
      filterData: {
        state: { name: { eq: "Blocked" } },
      },
    },
    {
      name: `${VIEW_NAME_PREFIX}Hygiene${suffix}`,
      description: "Active issues with no priority set OR not attached to a project.",
      teamId: team,
      shared: true,
      filterData: {
        and: [
          { state: { type: ACTIVE.type } },
          { or: [{ priority: { null: true } }, { project: { null: true } }] },
        ],
      },
    },
  ];
}

function parseTeamsArg(argv) {
  const raw = argv.find((a) => a.startsWith("--teams="));
  if (!raw) return ["ENG"];
  const v = raw.slice("--teams=".length).trim();
  if (v === "all" || v === "*") {
    return ["ENG", "GROW"];
  }
  return v
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const teamKeys = parseTeamsArg(process.argv);
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "Missing LINEAR_API_KEY. Create a personal API key in Linear (Settings → API) and export it:\n" +
        "  export LINEAR_API_KEY='lin_api_...'\n" +
        "Then run:\n" +
        "  node scripts/linear/create-suppr-dashboard-views.mjs\n" +
        "  node scripts/linear/create-suppr-dashboard-views.mjs --teams=ENG,GROW",
    );
    process.exit(1);
  }

  const teams = (await linearRequest(apiKey, QUERIES.teams, undefined)).teams.nodes;
  const initiatives = (await linearRequest(apiKey, QUERIES.initiatives, undefined)).initiatives.nodes;
  const projects = (await linearRequest(apiKey, QUERIES.projects, undefined)).projects.nodes;
  const existing = (await linearRequest(apiKey, QUERIES.existingViews, undefined)).customViews.nodes;

  const existingNames = new Set(existing.map((v) => v.name));
  const ctx = { teams, initiatives, projects };

  let definitions = [];
  for (const key of teamKeys) {
    const suffix = key === "ENG" ? "" : " [GROW]";
    definitions = definitions.concat(buildViewDefinitions(ctx, key, { suffix }));
  }

  console.log(
    dryRun ? "Dry run — no mutations.\n" : `Creating views for teams: ${teamKeys.join(", ")}…\n`,
  );

  for (const def of definitions) {
    if (existingNames.has(def.name)) {
      console.log(`Skip (exists): ${def.name}`);
      continue;
    }
    const input = {
      name: def.name,
      description: def.description,
      teamId: def.teamId,
      shared: def.shared,
      filterData: def.filterData,
    };
    if (dryRun) {
      console.log(`Would create: ${def.name}`);
      console.log(JSON.stringify(input, null, 2));
      continue;
    }
    const data = await linearRequest(apiKey, MUTATION, { input });
    const cv = data.customViewCreate.customView;
    existingNames.add(cv.name);
    console.log(`Created: ${cv.name} (${cv.id})`);
  }

  console.log(
    "\nDone. Open Linear → each team → Views. Growth copies use the [GROW] name suffix when ENG views already exist.",
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
