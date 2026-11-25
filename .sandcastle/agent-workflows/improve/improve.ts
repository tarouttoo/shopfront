import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import {
  agentFromEnv,
  appendSummary,
  fail,
  required,
} from "../shared/common";
import { runWithExtraction } from "../shared/run-with-extraction";
import {
  IMPROVE_LABEL,
  MAX_CANDIDATES,
  planSchema,
  renderIssueBody,
} from "./candidates";

/**
 * Improve-architecture on demand (ADR 0019, course lessons 91–92): a
 * workflow_dispatch button with no schedule. The agent explores with the
 * vendored skill; this script owns every GitHub write: dedupe context in,
 * candidate issues out — at most MAX_CANDIDATES per run (enforced by the
 * plan validator), each created with `AGENT_PAT` and labelled
 * `improvement`. Improvements wait for a human: nothing here labels them
 * into the pipeline.
 */

const GH_REPO = required("GH_REPO");
const AGENT_PAT = process.env.AGENT_PAT ?? "";
const FOCUS = process.env.FOCUS ?? "";
const RUN_URL =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "(unknown run)";

if (!AGENT_PAT) {
  fail(
    "AGENT_PAT is required: improvement issues are created and labelled with the PAT so the label is a real factory artifact",
  );
}

const ghWith = (args: string[], token: string): string =>
  execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GH_TOKEN: token },
  });

interface ExistingIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
}

const existingImprovements = (): ExistingIssue[] => {
  const raw = JSON.parse(
    ghWith(
      [
        "issue",
        "list",
        "--state",
        "open",
        "--label",
        IMPROVE_LABEL,
        "--limit",
        "200",
        "--json",
        "number,title,body",
      ],
      AGENT_PAT,
    ),
  ) as { number: number; title: string; body: string }[];
  return raw;
};

try {
  const existing = existingImprovements();
  const existingContext = JSON.stringify(
    existing.map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body.slice(0, 1500),
    })),
    null,
    2,
  );

  const result = await runWithExtraction({
    name: "improve-architecture",
    agent: agentFromEnv(),
    sandbox: noSandbox(),
    logging: { type: "stdout" },
    promptFile: path.join(import.meta.dirname, "prompt.md"),
    promptArgs: {
      FOCUS_LINE:
        FOCUS.trim().length > 0
          ? `Focus the scan on: ${FOCUS.trim()}`
          : "No focus given — let the repo's hot spots pull your attention.",
      EXISTING_IMPROVEMENTS: existingContext,
    },
    output: sandcastle.Output.object({
      tag: "output",
      schema: planSchema,
    }),
    extractionPrompt: fs.readFileSync(
      path.join(import.meta.dirname, "extraction.md"),
      "utf8",
    ),
  });

  const candidates = result.output;
  appendSummary("### Improve-architecture run\n");
  appendSummary(
    candidates.length === 0
      ? "No candidates this run — an honest empty result."
      : `Creating ${candidates.length} improvement issue(s) (max ${MAX_CANDIDATES}).\n`,
  );

  for (const candidate of candidates) {
    const bodyFile = path.join(fs.mkdtempSync("/tmp/improve-"), "issue.md");
    fs.writeFileSync(bodyFile, renderIssueBody(candidate, RUN_URL));
    const url = ghWith(
      [
        "issue",
        "create",
        "--title",
        candidate.title,
        "--body-file",
        bodyFile,
        "--label",
        IMPROVE_LABEL,
      ],
      AGENT_PAT,
    ).trim();
    appendSummary(`- #${url.split("/").pop()} — ${candidate.title} (${candidate.strength})\n`);
  }

  if (candidates.length === 0) {
    appendSummary("Nothing filed.\n");
  }
} catch (error) {
  fail(
    `improve-architecture run failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}
