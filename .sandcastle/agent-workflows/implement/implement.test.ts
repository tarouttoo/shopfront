import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract tests over the implement workflow's production artifacts. The
 * preflight lives in `agent-implement.yml` (bash) and reaches the agent
 * through `implement.ts` + `prompt.md`; these tests pin the wiring the
 * child-of-spec behavior depends on.
 */

const workflow = readFileSync(
  path.join(import.meta.dirname, "../../../.github/workflows/agent-implement.yml"),
  "utf8",
);
const script = readFileSync(path.join(import.meta.dirname, "implement.ts"), "utf8");
const prompt = readFileSync(path.join(import.meta.dirname, "prompt.md"), "utf8");
const specPrompt = readFileSync(path.join(import.meta.dirname, "prompt-spec.md"), "utf8");

describe("implement preflight (Detect issue shape)", () => {
  it("routes by issue shape instead of refusing PRD-shaped issues (ADR 0019, delta №1)", () => {
    expect(workflow).not.toContain("Refuse PRD-shaped issue");
    const shapeStep = workflow.slice(
      workflow.indexOf("Detect issue shape"),
      workflow.indexOf("Preflight existing PR"),
    );
    expect(shapeStep).toContain('route="spec-explore"');
    expect(shapeStep).toContain('route="implement"');
    expect(shapeStep).toContain('== "spec"');
  });

  it("runs a Spec marked agent:implement as one implement pass (ADR 0028)", () => {
    const shapeStep = workflow.slice(
      workflow.indexOf("Detect issue shape"),
      workflow.indexOf("Preflight existing PR"),
    );
    // The spec check wins over sub_count: a re-run spec with Tickets still
    // implements — the Tickets are the record, not separate work orders.
    const firstBranch = shapeStep.slice(
      shapeStep.indexOf('if [ "$has_spec_label"'),
      shapeStep.indexOf("elif"),
    );
    expect(firstBranch).toContain('route="implement"');
    expect(firstBranch).toContain("spec_run=true");
    const runStep = workflow.slice(workflow.indexOf("Run implementation agent"));
    const stepBody = runStep.slice(0, runStep.indexOf("- name:", 1));
    expect(stepBody).toContain("SPEC_RUN: ${{ steps.shape.outputs.spec_run }}");
    expect(script).toContain("prompt-spec.md");
    expect(script).toContain("SPEC_RUN");
  });

  it("the spec-run prompt records the plan as Tickets and closes them as scope lands", () => {
    expect(specPrompt).toContain("--parent {{ISSUE_NUMBER}}");
    expect(specPrompt).toContain("gh issue close");
    expect(specPrompt).toContain("Closes #{{ISSUE_NUMBER}}");
    expect(specPrompt).toContain("Tickets carry no labels");
  });

  it("keeps the spec-explore route out of the implement pass", () => {
    const runStep = workflow.slice(workflow.indexOf("Run implementation agent"));
    const stepBody = runStep.slice(0, runStep.indexOf("- name:", 1));
    expect(stepBody).toContain("steps.shape.outputs.route == 'implement'");
  });

  it("retires the to-tickets route: the spec run decomposes itself (ADR 0028)", () => {
    expect(workflow).not.toContain("to-tickets/to-tickets.ts");
    expect(workflow).not.toContain("route == 'to-tickets'");
  });

  it("keeps the exploration-notes route for a non-Spec issue with sub-issues", () => {
    expect(workflow).toContain("spec-explore/spec-explore.ts");
    const specExplore = workflow.slice(workflow.indexOf("Run spec-explore runner"));
    const stepBody = specExplore.slice(0, specExplore.indexOf("- name:", 1));
    expect(stepBody).toContain("steps.shape.outputs.route == 'spec-explore'");
  });

  it("posts the exploration comment with the marker implement runners look up", () => {
    expect(workflow).toContain("exploration-notes:");
    expect(workflow).toContain("agent/spec-${ISSUE_NUMBER}-notes");
  });

  it("emits the parent_number output the implement step consumes", () => {
    // Without this line PARENT_NUMBER is always empty and every
    // child-of-spec Ticket silently runs without its parent spec.
    const shapeStep = workflow.slice(
      workflow.indexOf("Detect issue shape"),
      workflow.indexOf("Preflight existing PR"),
    );
    expect(shapeStep).toContain(
      'echo "parent_number=$parent_number" >> "$GITHUB_OUTPUT"',
    );
  });

  it("exports the parent pointer to the implement script", () => {
    const runStep = workflow.slice(workflow.indexOf("Run implementation agent"));
    const stepBody = runStep.slice(0, runStep.indexOf("- name:", 1));
    expect(stepBody).toContain(
      "PARENT_NUMBER: ${{ steps.shape.outputs.parent_number }}",
    );
  });

  it("keeps the classic refusal of an open collaborator PR (implement route only)", () => {
    expect(workflow).toContain("Refuse existing PR");
    const preflight = workflow.slice(
      workflow.indexOf("Preflight existing PR"),
      workflow.indexOf("Transition labels"),
    );
    expect(preflight).toContain("steps.shape.outputs.route == 'implement'");
  });
});

describe("implement pass parent context", () => {
  it("renders the parent context in the script and hands it to the prompt", () => {
    expect(script).toContain("renderParentContext");
    expect(script).toContain("PARENT_CONTEXT:");
  });

  it("renders {{PARENT_CONTEXT}} into the prompt", () => {
    expect(prompt).toContain("{{PARENT_CONTEXT}}");
  });

  it("hands the exploration-notes branch to the prompt", () => {
    expect(script).toContain("exploration-notes:");
    expect(prompt).toContain("{{NOTES}}");
  });

  it("ships Spec Tickets without a PR in the v2 flow (ADR 0019): no PR steps, no PR section", () => {
    const prStep = workflow.slice(workflow.indexOf("Open draft PR"));
    expect(prStep).toContain("steps.shape.outputs.parent_number == ''");
    const reviewStep = workflow.slice(workflow.indexOf("Request automated review"));
    expect(reviewStep).toContain("steps.shape.outputs.parent_number == ''");
    expect(script).toContain("prompt-spec-ticket.md");
    expect(script).toContain("isSpecTicket");
  });
});
