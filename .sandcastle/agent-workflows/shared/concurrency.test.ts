import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

// ADR 0025: the provider caps concurrent agent sessions (~3), so every
// heavy LLM workflow queues in one of three repo-wide shards. GitHub
// expressions have no arithmetic, so a tiny `shard` job computes the
// unit number mod 3 in shell and the heavy job's job-level concurrency
// group reads it via needs.shard.outputs.n. Same unit, same shard, so
// same-PR mutation stays serialized; different units sharing a shard
// wait their turn instead of fanning out past the provider limit.
const SHARDED_WORKFLOWS = [
  { file: "agent-implement.yml", job: "implement" },
  { file: "agent-implement-pr.yml", job: "implement-pr" },
  { file: "agent-review.yml", job: "review" },
  { file: "agent-update-branch.yml", job: "update-branch" },
] as const;

type Workflow = {
  jobs: Record<
    string,
    {
      needs?: string | string[];
      steps?: { id?: string; run?: string }[];
      concurrency?: {
        group?: string;
        "cancel-in-progress"?: boolean;
        queue?: string;
      };
    }
  >;
};

const workflowOf = (file: string): Workflow =>
  parse(
    readFileSync(new URL(`../../../.github/workflows/${file}`, import.meta.url), "utf8"),
  ) as Workflow;

describe("agent workflow concurrency shards (ADR 0025)", () => {
  for (const { file, job } of SHARDED_WORKFLOWS) {
    it(`${file} computes its shard in a shell step (expressions have no arithmetic)`, () => {
      // The modulo lives in shell, where it is valid. GitHub expressions
      // have no `%` operator: the first cut of this pin asserted a
      // `${{ ... % 3 }}` group and GitHub silently refused to parse all
      // four workflows — the pin matched the shape and still shipped a
      // factory outage, so it pins the mechanism now.
      const mod = workflowOf(file).jobs.shard?.steps?.find((s) => s.id === "mod");
      expect(mod?.run).toContain("% 3");
      expect(mod?.run).toContain("GITHUB_OUTPUT");
      // No shard-0 default for a numberless event: a required key's
      // absence at an untyped boundary is a rejection, not a default.
      expect(mod?.run).toContain("${N:?");
    });

    it(`${file} queues its agent job in repo-wide shard agent-llm-<shard>, never cancelling`, () => {
      const heavy = workflowOf(file).jobs[job];
      expect(heavy?.needs).toContain("shard");
      const concurrency = heavy?.concurrency;
      expect(concurrency?.group).toBe("agent-llm-${{ needs.shard.outputs.n }}");
      // Queue, never cancel: a queued run is a later slot, a cancelled
      // one is a lost run. cancel-in-progress: false alone leaves the
      // default single-pending behavior (a newer queued run cancels the
      // pending one and takes its place), so queue: max is pinned too.
      expect(concurrency?.["cancel-in-progress"]).toBe(false);
      expect(concurrency?.queue).toBe("max");
    });
  }

  it("all four heavy workflows share the agent-llm- shard namespace", () => {
    for (const { file, job } of SHARDED_WORKFLOWS) {
      expect(workflowOf(file).jobs[job]?.concurrency?.group).toMatch(/^agent-llm-/);
    }
  });
});
