#!/usr/bin/env node
/**
 * Mark Gate 1 shipped issues Done + comment with commit SHA.
 * Usage: node scripts/linear/mark-gate1-done.mjs 97983c0a [sha2...]
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

const ISSUES = [
  { n: 1162, note: "Library deep-link keep=1" },
  { n: 1161, note: "Paywall sticky CTA only" },
  { n: 1163, note: "LogSheet Go-tos scroll inset" },
  { n: 1167, note: "Dual-host E2E auth (127.0.0.1 + localhost)" },
  { n: 1178, note: "SSRF mock in recipeImportDescriptionNull test" },
  { n: 805, note: "Weekly check-in never cold-opens (web)" },
  { n: 1171, note: "Check-in + consent overlay sequencing (web/mobile)" },
  { n: 1073, note: "adherence_over_display flag removed from render paths" },
  { n: 931, note: "Search row + quick-log (web + mobile)" },
];

const sha = process.argv[2] ?? "97983c0a";
const sha2 = process.argv[3];

const apiKey = loadApiKey();
if (!apiKey) {
  console.error("LINEAR_API_KEY missing — skip Linear sync");
  process.exit(0);
}

const ISSUE_BY_NUMBER = `
  query($n: Float!) {
    issue(id: null) { id }
    issues(filter: { number: { eq: $n } }, first: 1) {
      nodes { id identifier title state { id name } }
    }
  }
`;

const ISSUE_UPDATE = `
  mutation($id: String!, $stateId: String!) {
    issueUpdate(id: $id, input: { stateId: $stateId }) {
      success
      issue { identifier state { name } }
    }
  }
`;

const COMMENT_CREATE = `
  mutation($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
    }
  }
`;

const STATES = `
  query {
    workflowStates(filter: { name: { eq: "Done" } }, first: 5) {
      nodes { id name team { key } }
    }
  }
`;

const data = await linearRequest(apiKey, STATES, undefined);
const doneState = data.workflowStates.nodes.find((s) => s.team?.key === "ENG") ?? data.workflowStates.nodes[0];
if (!doneState) throw new Error("Done state not found");

for (const { n, note } of ISSUES) {
  const q = await linearRequest(apiKey, ISSUE_BY_NUMBER, { n });
  const issue = q.issues.nodes[0];
  if (!issue) {
    console.warn(`ENG-${n} not found`);
    continue;
  }
  const body = [
    `Gate 1 shipped on \`claude/eng-1099-tracker-tier\`.`,
    ``,
    `- **Commit:** \`${sha}\`${sha2 ? ` (+ \`${sha2}\` web 931 / ENG-1109 tests)` : ""}`,
    `- **Note:** ${note}`,
  ].join("\n");

  if (issue.state.name !== "Done") {
    await linearRequest(apiKey, ISSUE_UPDATE, { id: issue.id, stateId: doneState.id });
    console.log(`${issue.identifier} → Done`);
  } else {
    console.log(`${issue.identifier} already Done`);
  }
  await linearRequest(apiKey, COMMENT_CREATE, { issueId: issue.id, body });
}

console.log("Linear Gate 1 sync complete.");
