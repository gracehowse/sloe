/**
 * ENG-1166 — tracked agent docs: CLAUDE.md canonical, AGENTS.md mirrored (Option C).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const ROOT_CLAUDE = readFileSync(resolve(ROOT, ".claude/CLAUDE.md"), "utf8");
const ROOT_AGENTS = readFileSync(resolve(ROOT, "AGENTS.md"), "utf8");
const MOBILE_CLAUDE = readFileSync(resolve(ROOT, "apps/mobile/CLAUDE.md"), "utf8");

/** Strip generated mirror header from AGENTS.md before comparing body. */
function agentsBody(raw: string): string {
  return raw.replace(/^<!--[\s\S]*?-->\n\n/, "");
}

describe("ENG-1166 — agent docs canonical paths (Option C)", () => {
  it(".claude/CLAUDE.md points mobile work at apps/mobile/CLAUDE.md", () => {
    expect(ROOT_CLAUDE).toMatch(/apps\/mobile\/CLAUDE\.md/);
    expect(ROOT_CLAUDE).not.toMatch(/apps\/mobile\/AGENTS\.md/);
  });

  it("apps/mobile/CLAUDE.md exists and defers global rules to .claude/CLAUDE.md", () => {
    expect(MOBILE_CLAUDE.length).toBeGreaterThan(100);
    expect(MOBILE_CLAUDE).toMatch(/\.claude\/CLAUDE\.md/);
  });

  it("root AGENTS.md mirrors .claude/CLAUDE.md (run npm run sync:agent-docs if this fails)", () => {
    expect(agentsBody(ROOT_AGENTS)).toBe(ROOT_CLAUDE);
  });

  it("AGENTS.md documents cross-tool layout for Codex/Cursor", () => {
    expect(ROOT_CLAUDE).toMatch(/sync:agent-docs/);
    expect(ROOT_CLAUDE).toMatch(/Codex/);
  });
});
