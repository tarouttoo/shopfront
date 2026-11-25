import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import {
  agentFromEnv,
  appendSummary,
  fail,
  gh,
  required,
  safeSh,
  sh,
} from "../shared/common";
import { parseNativeIssues } from "../convert/blockers";
import { run } from "@ai-hero/sandcastle";

/**
 * The exploration-notes runner (ADR 0019, course lesson 102): one agent
 * run explores the Spec, its Tickets and the repo, and saves markdown
 * notes on a remote branch — no PR, no tickets touched. The exploration
 * comment on the Spec (posted by the workflow) is how every implement
 * runner finds the notes; the frontier itself stays with the converter
 * (`agent-convert.yml`).
 */

const GH_REPO = required("GH_REPO");
const ISSUE_NUMBER = required("ISSUE_NUMBER");

const issueNumber = Number(ISSUE_NUMBER);
if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
  fail(`Invalid issue number: ${ISSUE_NUMBER}`);
}
const NOTES_BRANCH = `agent/spec-${issueNumber}-notes`;

const truncate = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit)}\n… (truncated)`;

try {
  const hadNotes = safeSh(`git rev-parse --verify origin/${NOTES_BRANCH}`).trim().length > 0;

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
    truncate(specRaw.body ?? "(empty body)", 8000),
    "",
    ...(specRaw.comments ?? []).map(
      (comment) =>
        `---\n(comment by ${comment.author?.login ?? "unknown"}):\n${truncate(comment.body, 2000)}`,
    ),
  ].join("\n");

  // gh() returns raw JSON stdout; parseNativeIssues eats parsed data.
  const tickets = parseNativeIssues(
    JSON.parse(gh([
      "api",
      `repos/${GH_REPO}/issues/${ISSUE_NUMBER}/sub_issues`,
    ])),
  );
  const ticketSections: string[] = [];
  for (const ticket of tickets) {
    const raw = JSON.parse(
      gh(["issue", "view", String(ticket.number), "--json", "title,body,labels"]),
    ) as { title: string; body?: string | null; labels: { name: string }[] };
    ticketSections.push(
      [
        `## Ticket #${ticket.number}: ${raw.title}`,
        `Labels: ${raw.labels.map((label) => `\`${label.name}\``).join(", ") || "(none)"}`,
        "",
        truncate(raw.body ?? "(empty body)", 6000),
      ].join("\n"),
    );
  }

  appendSummary(
    `### Exploration notes for Spec #${issueNumber}\n\nBranch: \`${NOTES_BRANCH}\` (${hadNotes ? "updating existing notes" : "first run"}).\n`,
  );

  // The agent commits the notes on the notes branch; give it the identity
  // the other runners get from the workflow's git config step.
  sh("git config user.name \"sandcastle-agent[bot]\"");
  sh("git config user.email \"sandcastle-agent[bot]@users.noreply.github.com\"");

  await run({
    name: `spec-explore-${issueNumber}`,
    agent: agentFromEnv(),
    sandbox: noSandbox(),
    logging: { type: "stdout" },
    promptFile: path.join(import.meta.dirname, "prompt.md"),
    promptArgs: {
      ISSUE_NUMBER,
      NOTES_BRANCH,
      HAD_NOTES_LINE: hadNotes
        ? "The branch already exists and is fetched — update the existing `notes/` in place rather than rewriting from scratch."
        : "The branch does not exist yet — write the notes fresh.",
      SPEC_CONTEXT: specContext,
      TICKETS_CONTEXT: ticketSections.join("\n\n") || "(no Tickets yet)",
    },
  });
} catch (error) {
  fail(
    `spec-explore run failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}
