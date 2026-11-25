import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const workflow = parse(
  readFileSync(
    new URL("../../../.github/workflows/agent-merge.yml", import.meta.url),
    "utf8",
  ),
) as {
  name: string;
  on: {
    push?: { branches?: string[] };
    workflow_dispatch?: { inputs?: Record<string, { required?: boolean }> };
  };
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: Record<
    string,
    {
      permissions: Record<string, string>;
      steps: { name?: string; run?: string; if?: string; env?: Record<string, string> }[];
    }
  >;
};

const job = workflow.jobs.merge;
const step = (name: string) =>
  Object.values(job?.steps ?? []).find((candidate) => candidate.name === name);

describe("agent-merge.yml", () => {
  it("fires on pushes to agent ticket branches and a manual dispatch — no schedule", () => {
    expect(workflow.on.push?.branches).toEqual(["agent/issue-*"]);
    expect(workflow.on.workflow_dispatch?.inputs?.spec?.required).toBe(true);
    expect(JSON.stringify(workflow.on)).not.toContain("schedule");
  });

  it("serializes all merger runs repo-wide (the barrier is per-Spec, groups would race)", () => {
    expect(workflow.concurrency.group).toBe("agent-merge");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("writes contents, issues, and pull requests", () => {
    expect(job?.permissions).toMatchObject({
      contents: "write",
      issues: "write",
      "pull-requests": "write",
    });
  });

  it("resolves the Spec from the pushed branch's parent and skips standalone branches", () => {
    const resolve = step("Resolve spec");
    expect(resolve?.run).toContain("parent { number }");
    expect(step("Skip non-Spec branches")?.if).toBe(
      "steps.spec.outputs.spec == ''",
    );
    expect(step("Run merger")?.if).toBe("steps.spec.outputs.spec != ''");
  });

  it("runs the merger script with AGENT_PAT and the spec number", () => {
    const runStep = step("Run merger");
    expect(runStep?.run).toContain("merge-spec/merge-spec.ts");
    expect(runStep?.env?.AGENT_PAT).toBe("${{ secrets.AGENT_PAT }}");
    expect(runStep?.env?.SPEC_NUMBER).toBe("${{ steps.spec.outputs.spec }}");
  });

  it("marks the Spec blocked on failure with a retry hint", () => {
    const blocked = step("Mark blocked on failure");
    expect(blocked?.if).toContain("failure()");
    expect(blocked?.if).toContain("steps.spec.outputs.spec != ''");
    expect(blocked?.run).toContain("gh workflow run agent-merge.yml -f spec=");
    expect(blocked?.run).toContain("agent:blocked");
  });
});

/**
 * Contract test over the merger script's ticket closes (the source-level
 * analogue of shared/push-permissions.test.ts): GitHub never fires
 * workflows for events created by GITHUB_TOKEN, so a bare-`gh` close
 * would silently wedge every ticket waiting on the closed one — the
 * converter's only pulse for dependents is the `closed` event.
 */
const script = readFileSync(
  new URL("./merge-spec.ts", import.meta.url),
  "utf8",
);
const closeTickets = script.slice(
  script.indexOf("const closeTickets"),
  script.indexOf("try {", script.indexOf("const closeTickets")),
);

describe("closeTickets", () => {
  it("closes tickets through AGENT_PAT so the closed event re-fires agent-convert", () => {
    expect(closeTickets).toContain(
      'ghWith(["issue", "close", String(ticket.number)], AGENT_PAT)',
    );
  });

  it("never closes with the ambient GITHUB_TOKEN", () => {
    expect(closeTickets).not.toContain('gh(["issue", "close"');
  });
});
