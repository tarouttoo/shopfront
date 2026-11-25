import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import {
  agentFromEnv,
  appendSummary,
  fail,
  gh,
  required,
} from "../shared/common";
import { runWithExtraction } from "../shared/run-with-extraction";
import { parseNativeIssues } from "../convert/blockers";
import {
  READY_LABEL,
  planSchema,
  renderListComment,
  renderTicketBody,
} from "./plan";

/**
 * The to-tickets runner (ADR 0019, decision 7 — full AFK): the agent plans
 * the decomposition, this script owns every GitHub write. Tickets are
 * created as native sub-issues of the Spec with native `blocked_by` edges,
 * immediately labelled `ready-for-agent` (with `AGENT_PAT`, so the
 * converter cascade starts), and the Spec gets a list comment for async
 * audit. Then the trigger label goes back on the Spec — with `AGENT_PAT`,
 * so the next `agent-implement.yml` run routes to the exploration-notes
 * runner (the issue now has tickets).
 */

const GH_REPO = required("GH_REPO");
const ISSUE_NUMBER = required("ISSUE_NUMBER");
const AGENT_PAT = process.env.AGENT_PAT ?? "";

if (!AGENT_PAT) {
  fail(
    "AGENT_PAT is required: to-tickets labels Tickets ready-for-agent and re-triggers the Spec, and GITHUB_TOKEN label events never fire workflows",
  );
}

const ghWith = (args: string[], token: string): string =>
  execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GH_TOKEN: token },
  });

// gh()/ghWith() return raw JSON stdout; parseNativeIssues eats parsed data.
const ghJsonWith = (args: string[], token: string): unknown =>
  JSON.parse(ghWith(args, token));

const issueNumber = Number(ISSUE_NUMBER);
if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
  fail(`Invalid issue number: ${ISSUE_NUMBER}`);
}

// The provider plan caps simultaneous agent runs (empirically 3: a 4th and
// 5th died at start; the key is shared with the operator's local sessions).
// A plan wider than this would launch doomed runs, so its widest wave must
// fit — the rejection feeds back to the agent for a staggered re-plan.
const agentConcurrency = Number(process.env.AGENT_CONCURRENCY ?? "3");
if (!Number.isInteger(agentConcurrency) || agentConcurrency <= 0) {
  fail(
    `AGENT_CONCURRENCY must be a positive integer, got "${String(process.env.AGENT_CONCURRENCY)}"`,
  );
}

try {
  // Race guard: between routing and here the Spec may have grown tickets
  // (a parallel event). Sub-issue count > 0 means the exploration-notes
  // route owns this Spec now.
  const subCount = parseNativeIssues(
    JSON.parse(gh([
      "api",
      `repos/${GH_REPO}/issues/${ISSUE_NUMBER}/sub_issues`,
    ])),
  ).length;
  if (subCount > 0) {
    appendSummary(
      `Spec #${ISSUE_NUMBER} already has ${subCount} ticket(s) — nothing to decompose; handing back to the pipeline so the exploration route runs.\n`,
    );
    ghWith(
      ["issue", "edit", ISSUE_NUMBER, "--add-label", "agent:implement"],
      AGENT_PAT,
    );
    process.exit(0);
  }

  const specRaw = JSON.parse(
    gh(["issue", "view", ISSUE_NUMBER, "--json", "title,body,comments"]),
  ) as {
    title: string;
    body?: string | null;
    comments: { author?: { login?: string | null } | null; body: string }[];
  };
  const specContext = [
    `Title: ${specRaw.title}`,
    "",
    specRaw.body ?? "(empty body)",
    "",
    ...(specRaw.comments ?? []).map(
      (comment) =>
        `---\n(comment by ${comment.author?.login ?? "unknown"}):\n${comment.body}`,
    ),
  ].join("\n");

  const result = await runWithExtraction({
    name: `to-tickets-${ISSUE_NUMBER}`,
    agent: agentFromEnv(),
    sandbox: noSandbox(),
    logging: { type: "stdout" },
    promptFile: path.join(import.meta.dirname, "prompt.md"),
    promptArgs: {
      ISSUE_NUMBER,
      SPEC_CONTEXT: specContext,
    },
    output: sandcastle.Output.object({
      tag: "output",
      schema: planSchema({ maxWaveSize: agentConcurrency }),
    }),
    extractionPrompt: fs.readFileSync(
      path.join(import.meta.dirname, "extraction.md"),
      "utf8",
    ),
  });

  const plan = result.output;
  appendSummary(`### To-tickets run for #${ISSUE_NUMBER}\n`);
  appendSummary(`Applying a plan of ${plan.length} ticket(s).\n`);

  // Create every ticket first (all db ids must exist before edges), then
  // wire the graph: sub-issue edges, blocking edges, the cascade label.
  const dbIds: number[] = [];
  const numbers: number[] = [];
  for (const ticket of plan) {
    const bodyFile = path.join(fs.mkdtempSync("/tmp/totickets-"), "ticket.md");
    fs.writeFileSync(bodyFile, renderTicketBody(issueNumber, ticket));
    const url = ghWith(
      [
        "issue",
        "create",
        "--title",
        ticket.title,
        "--body-file",
        bodyFile,
        "--label",
        READY_LABEL,
      ],
      AGENT_PAT,
    ).trim();
    const number = Number(url.split("/").pop());
    const dbId = Number(
      ghWith(["api", `repos/${GH_REPO}/issues/${String(number)}`, "--jq", ".id"], AGENT_PAT).trim(),
    );
    if (!Number.isInteger(number) || !Number.isInteger(dbId)) {
      fail(`Could not resolve created ticket "${ticket.title}" (${url})`);
    }
    numbers.push(number);
    dbIds.push(dbId);
    appendSummary(`- #${number} — ${ticket.title}\n`);
  }

  for (const dbId of dbIds) {
    ghWith(
      [
        "api",
        "--method",
        "POST",
        `repos/${GH_REPO}/issues/${ISSUE_NUMBER}/sub_issues`,
        "-F",
        `sub_issue_id=${String(dbId)}`,
      ],
      AGENT_PAT,
    );
  }
  for (let index = 0; index < plan.length; index += 1) {
    for (const blocker of plan[index]!.blockedBy) {
      ghWith(
        [
          "api",
          "--method",
          "POST",
          `repos/${GH_REPO}/issues/${String(numbers[index]!)}/dependencies/blocked_by`,
          "-F",
          `issue_id=${String(dbIds[blocker]!)}`,
        ],
        AGENT_PAT,
      );
    }
  }

  // Verify the graph landed before handing control to the cascade — a
  // missing parent edge would silently demote the Ticket to standalone.
  const subIssues = parseNativeIssues(
    ghJsonWith(
      ["api", "--paginate", `repos/${GH_REPO}/issues/${ISSUE_NUMBER}/sub_issues`],
      AGENT_PAT,
    ),
  );
  for (const number of numbers) {
    if (!subIssues.some((issue) => issue.number === number)) {
      fail(
        `Ticket #${String(number)} did not land as a sub-issue of #${ISSUE_NUMBER} — refusing to hand off (it would run standalone without its Spec)`,
      );
    }
  }
  for (let index = 0; index < plan.length; index += 1) {
    const expected = plan[index]!.blockedBy.map((blocker) => numbers[blocker]!);
    const actual = parseNativeIssues(
      ghJsonWith(
        [
          "api",
          "--paginate",
          `repos/${GH_REPO}/issues/${String(numbers[index]!)}/dependencies/blocked_by`,
        ],
        AGENT_PAT,
      ),
    )
      .map((issue) => issue.number)
      .filter((number) => expected.includes(number));
    if (actual.length !== expected.length) {
      fail(
        `Ticket #${String(numbers[index]!)} is missing blocking edges (expected ${expected.join(", ")}, saw ${actual.join(", ") || "none"}) — refusing to hand off`,
      );
    }
  }

  const created = plan.map((ticket, index) => ({
    number: numbers[index]!,
    title: ticket.title,
    blockedBy: ticket.blockedBy,
  }));
  const commentFile = path.join(fs.mkdtempSync("/tmp/totickets-"), "list.md");
  fs.writeFileSync(commentFile, renderListComment(issueNumber, created));
  gh(["issue", "comment", ISSUE_NUMBER, "--body-file", commentFile]);

  // Hand the Spec back to the pipeline: with tickets in place the next
  // run routes to the exploration-notes runner. PAT, always — the cascade.
  ghWith(
    ["issue", "edit", ISSUE_NUMBER, "--add-label", "agent:implement"],
    AGENT_PAT,
  );
  appendSummary(
    `Re-added \`agent:implement\` on #${ISSUE_NUMBER} — the next run routes to the exploration-notes runner.\n`,
  );
} catch (error) {
  fail(
    `to-tickets run failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}
