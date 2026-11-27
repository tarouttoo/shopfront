import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { agentFromEnv, fail, outputDir, required, safeSh, sh } from "../shared/common";
import { parseParentNumber, renderParentContext } from "./parent-context";

const ISSUE_NUMBER = required("ISSUE_NUMBER");
const ISSUE_TITLE = required("ISSUE_TITLE");
const BRANCH = required("BRANCH");
// Empty unless the shape step exported a parent issue (child-of-spec Ticket).
const PARENT_NUMBER = process.env.PARENT_NUMBER;
// True when the labeled issue is itself a Spec: the run implements the whole
// Spec — Tickets are the record it creates, not separate work orders (ADR 0028).
const SPEC_RUN = process.env.SPEC_RUN === "true";
const PR_BODY_PATH = path.join(outputDir(), "pr-body.md");

try {
  // Issue bodies come through `--json body --jq .body`: the `--comments`
  // form fails with the "Projects (classic) deprecated" GraphQL error and
  // never returned the body anyway — only the comments (same fix as
  // shared/review-context.ts for the review's spec file).
  const issueContext =
    safeSh(`gh issue view ${ISSUE_NUMBER} --json body --jq .body`) ||
    `Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}`;

  const parentContext = renderParentContext(
    parseParentNumber(PARENT_NUMBER),
    (number) => safeSh(`gh issue view ${number} --json body --jq .body`),
  );

  /**
   * The parent Spec's exploration-notes branch, taken from the Spec's
   * latest exploration comment (posted by the spec-explore runner — ADR
   * 0019). Empty when the parent has none: notes are optional context,
   * never a prerequisite (the converter may start a ticket before its
   * Spec's exploration has run).
   */
  const notesBranch = (): string => {
    const parent = parseParentNumber(PARENT_NUMBER);
    if (!parent) return "";
    const marker = `exploration-notes: agent/spec-${parent}-notes`;
    const comments = safeSh(
      `gh api repos/{owner}/{repo}/issues/${parent}/comments --paginate --jq .[].body`,
    );
    const lines = comments
      .split("\n")
      .filter((line) => line.includes(marker))
      .map((line) => line.trim());
    return lines.at(-1) ?? "";
  };
  const NOTES = notesBranch();

  // Spec Tickets ship without a PR in the v2 flow (ADR 0019): their work
  // lands on the branch and the merger integrates the wave. Standalone
  // issues keep the classic per-issue PR chain.
  const isSpecTicket = parseParentNumber(PARENT_NUMBER) !== null;
  const promptArgs: Record<string, string> = {
    ISSUE_NUMBER,
    ISSUE_TITLE,
    BRANCH,
    ISSUE_CONTEXT: issueContext,
    PARENT_CONTEXT: parentContext,
    NOTES,
  };
  if (!isSpecTicket) {
    promptArgs.PR_BODY_PATH = PR_BODY_PATH;
  }

  const result = await sandcastle.run({
    name: `implement-#${ISSUE_NUMBER}`,
    agent: agentFromEnv(),
    sandbox: noSandbox(),
    logging: { type: "stdout" },
    promptFile: path.join(
      import.meta.dirname,
      SPEC_RUN
        ? "prompt-spec.md"
        : isSpecTicket
          ? "prompt-spec-ticket.md"
          : "prompt.md",
    ),
    promptArgs,
  });

  const commitsAhead = Number(sh("git rev-list --count main..HEAD").trim());
  if (!Number.isFinite(commitsAhead) || commitsAhead === 0) {
    fail("Agent finished but no commits were made on the branch.");
  }

  console.log(`Implementation produced ${commitsAhead} commit(s).`);
  console.log(`Commits this run: ${result.commits.length}.`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
