import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const workflow = parse(
  readFileSync(
    new URL("../../../.github/workflows/agent-improve.yml", import.meta.url),
    "utf8",
  ),
) as {
  name: string;
  on: { workflow_dispatch?: { inputs?: Record<string, { required?: boolean; default?: string }> } };
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: Record<
    string,
    {
      permissions: Record<string, string>;
      steps: { name?: string; run?: string; env?: Record<string, string> }[];
    }
  >;
};

const job = workflow.jobs.improve;

describe("agent-improve.yml", () => {
  it("is a manual button: dispatch only, optional focus, no schedule", () => {
    expect(workflow.on.workflow_dispatch?.inputs?.focus?.required).toBe(false);
    expect(JSON.stringify(workflow.on)).not.toContain("schedule");
    expect(JSON.stringify(workflow.on)).not.toContain("push");
  });

  it("writes issues only, reads contents", () => {
    expect(job?.permissions).toMatchObject({ contents: "read", issues: "write" });
  });

  it("runs the improve runner with AGENT_PAT (issues are factory artifacts)", () => {
    const step = Object.values(job?.steps ?? []).find((candidate) =>
      candidate.run?.includes("improve/improve.ts"),
    );
    expect(step?.env?.AGENT_PAT).toBe("${{ secrets.AGENT_PAT }}");
    expect(step?.env?.ZAI_API_KEY).toBe("${{ secrets.ZAI_API_KEY }}");
  });

  it("runs the vendored skill from the repo", () => {
    expect(
      existsSync(
        new URL("../../../.agents/skills/improve-codebase-architecture/SKILL.md", import.meta.url),
      ),
    ).toBe(true);
  });
});
