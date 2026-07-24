import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs ratchet script, no types
import { scanText } from "../../scripts/check-agent-drift.mjs";

/**
 * The agent-drift gate (2026-07-24 agent fleet audit). Guards the failure
 * class that let 37 agent prompts drift silently: they transcribed values
 * that lived in code, and nothing checked them.
 *
 * `scanText` is the pure detector — `pathExists` is injected so these run
 * without touching the filesystem.
 */

const FRESH = "2026-07-24";
const NOW = Date.parse("2026-07-24");

/** Minimal valid agent frontmatter so staleness doesn't fire incidentally. */
const fm = (extra = "") =>
  `---\nname: probe\ndescription: probe\ntools: Read\nmodel: sonnet\nlast-reviewed: ${FRESH}\n---\n${extra}`;

const scan = (text: string, opts: Record<string, unknown> = {}) =>
  scanText({ text, today: NOW, ...opts });

const kinds = (findings: { kind: string }[]) => findings.map((f) => f.kind);

describe("check:agent-drift — absolute paths", () => {
  it("flags the /Users/... path that broke every agent's STEP ZERO", () => {
    const out = scan(fm("Read `/Users/graceturner/Suppr-1/.claude/agents/_project-context.md`."));
    expect(kinds(out)).toContain("absolute-path");
  });

  it("accepts the repo-relative form of the same reference", () => {
    const out = scan(fm("Read `.claude/agents/_project-context.md`."), {
      pathExists: () => true,
    });
    expect(out).toHaveLength(0);
  });
});

describe("check:agent-drift — dead references", () => {
  it("flags an npm script that does not exist", () => {
    const out = scan(fm("Run `npm run check:nope`."), { scriptNames: new Set(["ci"]) });
    expect(kinds(out)).toContain("dead-script");
  });

  it("accepts a script that exists in either package.json", () => {
    const out = scan(fm("Run `npm run test:screens:tour`."), {
      scriptNames: new Set(["test:screens:tour"]),
    });
    expect(out).toHaveLength(0);
  });

  it("flags a repo path that does not resolve", () => {
    const out = scan(fm("See `docs/gone.md`."), { pathExists: () => false });
    expect(kinds(out)).toContain("dead-path");
  });

  it("treats a gitignored runtime path as valid, not dead", () => {
    // Capture dirs and auth fixtures exist locally and never in a fresh CI
    // checkout. Flagging them made the gate green on a dev machine and red
    // in CI — caught by running it in a clean worktree. `pathExists` folds
    // the gitignore check in, so a "missing but ignored" path passes.
    const out = scan(fm("Captures land in `apps/mobile/screenshots/agent/`."), {
      pathExists: (p: string) => p === "apps/mobile/screenshots/agent/",
    });
    expect(out).toHaveLength(0);
  });

  it("does not flag globs or date templates, which cannot be resolved", () => {
    const out = scan(
      fm("Decisions live in `docs/decisions/YYYY-MM-DD-<slug>.md` and `src/lib/**`."),
      { pathExists: () => false },
    );
    expect(out).toHaveLength(0);
  });
});

describe("check:agent-drift — transcribed scales", () => {
  it("flags a spacing ladder copied out of the theme", () => {
    const out = scan(fm("Spacing scale is 4 / 8 / 16 / 20 / 24."));
    expect(kinds(out)).toContain("transcribed-scale");
  });

  it("flags a braced radius set — the exact shape three agents disagreed on", () => {
    const out = scan(fm("Legal borderRadius values: 4, 6, 8, 12, 9999."));
    expect(kinds(out)).toContain("transcribed-scale");
  });

  it("accepts citing the token and its source instead of the values", () => {
    const out = scan(fm("Read the radius scale from `apps/mobile/constants/theme.ts`."));
    expect(out).toHaveLength(0);
  });

  it("does not flag numbers unrelated to a design scale", () => {
    const out = scan(fm("The cap is 8 open PRs, rebased against main."));
    expect(kinds(out)).not.toContain("transcribed-scale");
  });
});

describe("check:agent-drift — dead agent references", () => {
  it("flags a retired agent by name", () => {
    const out = scan(fm("Hand off to `qa-lead` for testing review."));
    expect(kinds(out)).toContain("dead-agent");
  });

  it("accepts a surviving agent", () => {
    const out = scan(fm("Hand off to `executor` for implementation."), {
      validAgents: new Set(["executor"]),
    });
    expect(out).toHaveLength(0);
  });

  it("flags a routing line naming something that is not an agent", () => {
    const out = scan(fm("Owner: `some-made-up-lens`."), {
      validAgents: new Set(["executor"]),
    });
    expect(kinds(out)).toContain("dead-agent");
  });

  it("does not mistake hyphenated domain terms for agent names", () => {
    const out = scan(fm("Owner honours `prefers-reduced-motion` and `focus-visible`."), {
      validAgents: new Set(["design"]),
    });
    expect(out).toHaveLength(0);
  });
});

describe("check:agent-drift — staleness", () => {
  it("flags an agent with no last-reviewed date", () => {
    const text = `---\nname: probe\ndescription: p\ntools: Read\nmodel: sonnet\n---\nBody.`;
    const out = scan(text);
    expect(kinds(out)).toContain("staleness");
  });

  it("flags an agent past the max age", () => {
    const stale = `---\nname: probe\ndescription: p\ntools: Read\nmodel: sonnet\nlast-reviewed: 2026-01-01\n---\nBody.`;
    const out = scan(stale);
    expect(kinds(out)).toContain("staleness");
  });

  it("accepts a freshly reviewed agent", () => {
    expect(scan(fm("Body."))).toHaveLength(0);
  });

  it("exempts skills from staleness but still checks their paths", () => {
    const skill = "---\nname: s\ndescription: d\n---\nSee `docs/gone.md`.";
    const out = scan(skill, {
      rel: ".claude/skills/s/SKILL.md",
      pathExists: () => false,
    });
    expect(kinds(out)).not.toContain("staleness");
    expect(kinds(out)).toContain("dead-path");
  });

  it("reads the shared context file's inline bold last-reviewed line", () => {
    const ctx = "# Context\n\n**last-reviewed:** 2026-07-24\n\nBody.";
    const out = scan(ctx, { rel: ".claude/agents/_project-context.md" });
    expect(kinds(out)).not.toContain("staleness");
  });
});
