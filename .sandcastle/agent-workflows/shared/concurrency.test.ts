import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

// ADR 0025: the provider caps concurrent agent sessions (~3), so every
// heavy LLM workflow queues in one of three repo-wide shards keyed by the
// unit number mod 3. Same-unit runs land in the same shard, so same-PR
// mutation stays serialized; different units sharing a shard wait their
// turn instead of fanning out past the provider limit.
const SHARDED_WORKFLOWS = [
  {
    file: "agent-implement.yml",
    job: "implement",
    unit: "issue",
  },
  {
    file: "agent-implement-pr.yml",
    job: "implement-pr",
    unit: "pull_request",
  },
  {
    file: "agent-review.yml",
    job: "review",
    unit: "pull_request",
  },
  {
    file: "agent-update-branch.yml",
    job: "update-branch",
    unit: "pull_request",
  },
] as const;

const workflowOf = (file: string) =>
  parse(
    readFileSync(new URL(`../../../.github/workflows/${file}`, import.meta.url), "utf8"),
  ) as {
    jobs: Record<
      string,
      { concurrency?: { group?: string; "cancel-in-progress"?: boolean } }
    >;
  };

describe("agent workflow concurrency shards (ADR 0025)", () => {
  for (const { file, job, unit } of SHARDED_WORKFLOWS) {
    it(`${file} queues its agent run in repo-wide shard agent-llm-<${unit} % 3>, never cancelling`, () => {
      const concurrency = workflowOf(file).jobs[job]?.concurrency;
      expect(concurrency?.group).toBe(
        "agent-llm-${{ github.event." + unit + ".number % 3 }}",
      );
      // Queue, never cancel: a queued run is a later slot, a cancelled
      // one is a lost run.
      expect(concurrency?.["cancel-in-progress"]).toBe(false);
    });
  }

  it("all four heavy workflows share the agent-llm- shard namespace", () => {
    for (const { file, job } of SHARDED_WORKFLOWS) {
      expect(workflowOf(file).jobs[job]?.concurrency?.group).toMatch(/^agent-llm-/);
    }
  });
});
