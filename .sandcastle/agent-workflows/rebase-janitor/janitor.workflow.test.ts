import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const workflow = parse(
  readFileSync(
    new URL("../../../.github/workflows/agent-rebase-janitor.yml", import.meta.url),
    "utf8",
  ),
) as {
  name: string;
  on: {
    pull_request?: { types?: string[] };
    schedule?: { cron: string }[];
    workflow_dispatch?: unknown;
  };
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: Record<
    string,
    {
      if?: string;
      permissions: Record<string, string>;
      steps: { name?: string; run?: string; if?: string; env?: Record<string, string> }[];
    }
  >;
};

const job = workflow.jobs.sweep;
const step = (name: string) =>
  Object.values(job?.steps ?? []).find((step) => step.name === name);

describe("agent-rebase-janitor.yml", () => {
  it("fires on a PR merging and a nightly cron — nothing else", () => {
    expect(workflow.on.pull_request?.types).toEqual(["closed"]);
    expect(workflow.on.schedule).toHaveLength(1);
    expect(workflow.on.schedule?.[0]?.cron).toMatch(/^\d+ \d+ \* \* \*$/);
    expect(workflow.on.workflow_dispatch).toBeUndefined();
  });

  it("gates the sweep on merged or schedule", () => {
    expect(job?.if).toContain("schedule");
    expect(job?.if).toContain("merged == true");
  });

  it("serializes sweeps repo-wide", () => {
    expect(workflow.concurrency.group).toBe("agent-rebase-janitor");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("writes only to pull requests", () => {
    expect(job?.permissions).toEqual({ "pull-requests": "write" });
  });

  it("gates on Agent-quiet: every mutating workflow, in progress and queued", () => {
    const gate = step("Agent-quiet gate")?.run ?? "";
    for (const wf of [
      "agent-implement.yml",
      "agent-review.yml",
      "agent-update-branch.yml",
      "agent-convert.yml",
    ]) {
      expect(gate).toContain(wf);
    }
    expect(gate).toContain("in_progress");
    expect(gate).toContain("queued");
    expect(step("Find conflicting agent PRs")?.if).toContain(
      "steps.quiet.outputs.quiet == 'true'",
    );
  });

  it("matches only agent PR head branches in conflict", () => {
    const find = step("Find conflicting agent PRs")?.run ?? "";
    expect(find).toContain("test(\"^agent/issue-[0-9]+-\")");
    expect(find).toContain("CONFLICTING");
    expect(find).toContain("UNKNOWN");
  });

  it("labels via AGENT_PAT so the label event fires agent-update-branch.yml", () => {
    const labelStep = step("Label for update-branch");
    expect(labelStep?.env?.AGENT_PAT).toBe("${{ secrets.AGENT_PAT }}");
    expect(labelStep?.run).toContain("agent:update-branch");
    expect(labelStep?.if).toContain("steps.find.outputs.numbers != ''");
  });

  it("is a deterministic sweep: no checkout, no agent run", () => {
    const runs = Object.values(job?.steps ?? []).map((step) => step.run ?? "");
    expect(runs.join("\n")).not.toContain("actions/checkout");
    expect(runs.join("\n")).not.toContain(".sandcastle");
  });
});
