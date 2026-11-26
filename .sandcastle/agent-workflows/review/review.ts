import * as fs from "node:fs";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import {
  agentFromEnv,
  fail,
  required,
  safeSh,
  sh,
  writeJson,
  writeText,
} from "../shared/common";
import { fetchPullRequestContext } from "../shared/review-context";
import {
  filterInlineComments,
  filterReplies,
  reviewOutputSchema,
} from "../shared/review-output";
import { runWithExtraction } from "../shared/run-with-extraction";

const PR_NUMBER = required("PR_NUMBER");
const BRANCH = required("BRANCH");
// The review's fixed point (course contract: `origin/{{BASE_REF}}`).
const BASE_REF = process.env.BASE_REF ?? "main";

// Forensics for the failure path below, measured before the diff attempt in
// fetchPullRequestContext (which uses the same refs): if that capture
// overflows or dies, the «Reason:» comment still says how big the diff
// actually was — the number a stranger needs to diagnose an ENOBUFS.
// `wc -c` pipes the diff through and emits a few bytes, so this capture
// cannot overflow itself.
const measured = safeSh("git diff main...HEAD | wc -c").trim();
const parsedDiffBytes = measured === "" ? Number.NaN : Number(measured);
const diffByteSize = Number.isFinite(parsedDiffBytes) ? parsedDiffBytes : null;

try {
  const context = fetchPullRequestContext(PR_NUMBER);

  // The code-review skill invocation names this path as the spec; write it
  // even when no issue is linked, so the path always exists.
  fs.writeFileSync("/tmp/review-spec.md", context.linkedIssue);

  const result = await runWithExtraction({
    name: `review-pr-${PR_NUMBER}`,
    agent: agentFromEnv(),
    sandbox: noSandbox(),
    logging: { type: "stdout" },
    promptFile: path.join(import.meta.dirname, "prompt.md"),
    promptArgs: {
      PR_NUMBER,
      BRANCH,
      BASE_REF,
      PR_TITLE: context.prTitle,
      ISSUE_NUMBER: context.issueNumber || "(none)",
      ISSUE_TITLE: context.issueTitle || "(no linked issue)",
      PR_COMMENTS_JSON: context.prCommentsJson,
    },
    output: sandcastle.Output.object({
      tag: "output",
      schema: reviewOutputSchema,
    }),
    extractionPrompt: fs.readFileSync(
      path.join(import.meta.dirname, "extraction.md"),
      "utf8",
    ),
  });

  const validInlineComments = filterInlineComments(
    result.output.inlineComments,
    context.diffLines,
  );
  const validReplies = filterReplies(
    result.output.replies,
    context.validReplyIds,
  );
  const headSha = sh("git rev-parse HEAD").trim();

  writeJson("review_payload.json", {
    commit_id: headSha,
    event: "COMMENT",
    body: result.output.summary,
    comments: validInlineComments.map((comment) => ({
      path: comment.path,
      line: comment.line,
      side: "RIGHT",
      body: comment.body,
    })),
  });
  writeJson("replies.json", validReplies);
  writeText("summary.md", result.output.summary);
  writeText("verdict.txt", result.commits.length > 0 ? "improved" : "clean");

  console.log("Review complete.");
  console.log(`Commits: ${result.commits.length}.`);
  console.log(`Inline comments: ${validInlineComments.length}.`);
  console.log(`Replies: ${validReplies.length}.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const sizeNote =
    diffByteSize === null
      ? "(diff main...HEAD: size unavailable)"
      : `(diff main...HEAD: ${diffByteSize} bytes)`;
  fail(`${message}\n\n${sizeNote}`);
}
