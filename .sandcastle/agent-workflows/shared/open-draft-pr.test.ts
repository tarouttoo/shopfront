import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const IMPLEMENT_WORKFLOW_PATH = new URL(
  "../../../.github/workflows/agent-implement.yml",
  import.meta.url,
);
const IMPLEMENT_PR_WORKFLOW_PATH = new URL(
  "../../../.github/workflows/agent-implement-pr.yml",
  import.meta.url,
);
const REVIEW_WORKFLOW_PATH = new URL(
  "../../../.github/workflows/agent-review.yml",
  import.meta.url,
);

const OPEN_DRAFT_PR_STEP = "Open draft PR";
const PREFLIGHT_STEP = "Preflight repo settings";
const UPDATE_PR_BODY_STEP = "Update PR body";

/** The run script of a named step, exactly as GitHub Actions would execute it. */
const runScriptOf = (
  stepName: string,
  workflowPath: URL = IMPLEMENT_WORKFLOW_PATH,
): string => {
  const workflow = parse(readFileSync(workflowPath, "utf8")) as {
    jobs: Record<string, { steps: { name?: string; run?: string }[] }>;
  };
  const step = Object.values(workflow.jobs)
    .flatMap((job) => job.steps)
    .find((step) => step.name === stepName);
  if (!step?.run) throw new Error(`No run script found for step: ${stepName}`);
  return step.run;
};

interface StepResult {
  status: number;
  /** Contents of the step-outputs file (GitHub's GITHUB_OUTPUT). */
  outputs: string;
  /** The step's stdout, as GitHub would render it into the job log. */
  stdout: string;
  /** The step's stderr. */
  stderr: string;
}

/**
 * Runs a step's run script the way GitHub Actions does (bash with -e, no
 * pipefail by default), with a stub `gh` executable first on PATH.
 */
const runStep = async (
  script: string,
  ghStub: string,
  options: {
    prBody?: string;
    /** Extra files written into the step's working directory. */
    files?: Record<string, string>;
    /** Extra step env, mirroring the workflow's `env:` block. */
    env?: Record<string, string>;
  } = {},
): Promise<StepResult> => {
  const dir = await mkdtemp(join(tmpdir(), "open-draft-pr-"));
  try {
    const stubBin = join(dir, "bin");
    const stub = join(stubBin, "gh");
    await mkdir(stubBin, { recursive: true });
    await writeFile(stub, `#!/usr/bin/env bash\n${ghStub}\n`, { mode: 0o755 });
    chmodSync(stub, 0o755);
    const scriptPath = join(dir, "step.sh");
    await writeFile(scriptPath, script);
    const githubOutput = join(dir, "github-output.txt");
    const prBodyFile = join(dir, "pr-body.md");
    await writeFile(prBodyFile, options.prBody ?? "Closes #11\n");
    for (const [name, content] of Object.entries(options.files ?? {})) {
      await writeFile(join(dir, name), content);
    }
    const { status, stdout, stderr } = spawnSync(
      "bash",
      ["--noprofile", "--norc", "-e", scriptPath],
      {
        cwd: dir,
        env: {
          ...process.env,
          PATH: `${stubBin}:${process.env.PATH}`,
          ISSUE_NUMBER: "11",
          ISSUE_TITLE: "Some issue title",
          // Used by agent-implement-pr.yml steps ("Update PR body").
          PR_NUMBER: "42",
          BRANCH: "agent/issue-11-some-issue-title",
          PR_BODY_FILE: prBodyFile,
          GITHUB_OUTPUT: githubOutput,
          GH_REPO: "octo/repo",
          // Default env every GitHub Actions step gets.
          GITHUB_SERVER_URL: "https://github.com",
          GITHUB_REPOSITORY: "octo/repo",
          GITHUB_RUN_ID: "12345",
          ...options.env,
        },
      },
    );
    const outputs = await readFile(githubOutput, "utf8").catch(() => "");
    return {
      status: status ?? -1,
      outputs,
      stdout: stdout ? String(stdout) : "",
      stderr: stderr ? String(stderr) : "",
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/**
 * A `gh` stub for `pr create`/`pr edit` that echoes the Evidence line of the
 * --body-file it receives to stderr, so a test can assert what reached gh.
 * `create` additionally prints the PR URL the step parses into pr_number.
 */
const stubEchoingBodyFile = (subcommand: "create" | "edit"): string => `
  if [ "$1" = pr ] && [ "$2" = ${subcommand} ]; then
    prev=""
    for a in "$@"; do
      if [ "$prev" = "--body-file" ]; then grep "Evidence:" "$a" >&2; fi
      prev="$a"
    done
    if [ "${subcommand}" = create ]; then
      echo "https://github.com/octo/repo/pull/42"
    fi
    exit 0
  fi
  exit 1
`;

describe("Open draft PR step", () => {
  it("fails when gh pr create fails", async () => {
    const result = await runStep(runScriptOf(OPEN_DRAFT_PR_STEP), `
      echo "could not create PR: branch is protected" >&2
      exit 1
    `);
    expect(result.status).not.toBe(0);
    expect(result.outputs).not.toContain("pr_number=");
  });

  it("does not publish a pr_number when gh fails after printing stdout", async () => {
    const result = await runStep(runScriptOf(OPEN_DRAFT_PR_STEP), `
      echo "Creating draft pull request for agent/issue-11-some-issue-title..."
      echo "GraphQL: Could not resolve to a PullRequest" >&2
      exit 1
    `);
    expect(result.status).not.toBe(0);
    expect(result.outputs).not.toContain("pr_number=");
  });

  it("extracts pr_number from the URL gh prints on success", async () => {
    const result = await runStep(runScriptOf(OPEN_DRAFT_PR_STEP), `
      echo "Creating draft pull request for agent/issue-11-some-issue-title..."
      echo "https://github.com/octo/repo/pull/42"
      exit 0
    `);
    expect(result.status).toBe(0);
    expect(result.outputs).toContain("pr_number=42");
  });

  it("substitutes GitHub template variables in the agent-drafted body", async () => {
    // The agent drafts evidence links with $GITHUB_* variables it cannot
    // resolve; PR #2 shipped a dead one. The step must publish real values.
    const result = await runStep(
      runScriptOf(OPEN_DRAFT_PR_STEP),
      stubEchoingBodyFile("create"),
      {
        prBody:
          "Evidence: [workflow run]($GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID)",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      "https://github.com/octo/repo/actions/runs/12345",
    );
    expect(result.stderr).not.toContain("$GITHUB_SERVER_URL");
  });
});

describe("Preflight repo settings step", () => {
  // gh is called twice with --jq: the workflow-permissions GET, then the
  // repo GET. Like the real gh, the stub prints the jq result only.
  const settingsStub = (canApprove: boolean, allowAutoMerge: boolean) => `
    case "$*" in
      *permissions/workflow*) echo ${canApprove}; exit 0;;
      *) echo ${allowAutoMerge}; exit 0;;
    esac
  `;

  it("passes when Actions can create PRs and auto-merge is on", async () => {
    const result = await runStep(
      runScriptOf(PREFLIGHT_STEP),
      settingsStub(true, true),
    );
    expect(result.status).toBe(0);
  });

  it("fails with the fix command when Actions cannot create pull requests", async () => {
    const result = await runStep(
      runScriptOf(PREFLIGHT_STEP),
      settingsStub(false, true),
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("can_approve_pull_request_reviews=true");
  });

  it("fails with the fix command when Actions cannot create pull requests", async () => {
    const result = await runStep(
      runScriptOf(PREFLIGHT_STEP),
      settingsStub(false, true),
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("can_approve_pull_request_reviews=true");
    // The PUT silently resets default_workflow_permissions; the fix
    // command the log hands the debugging agent must set it explicitly.
    expect(result.stdout).toContain("default_workflow_permissions=read");
  });

  it("warns but passes when auto-merge is off (ADR 0011 kill switch)", async () => {
    // Auto-merge is the human's kill switch, and v2-chain Ticket runs ship
    // no PR and never request it — a warning, not a blocker.
    const result = await runStep(
      runScriptOf(PREFLIGHT_STEP),
      settingsStub(true, false),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("allow_auto_merge is off");
  });

  it("warns but passes when the settings endpoints are unreadable (GITHUB_TOKEN 403)", async () => {
    // /actions/permissions/workflow needs Administration:read, which
    // GITHUB_TOKEN never holds — verified live by the PR #13 review. A
    // setting that cannot be verified must not block the run.
    const result = await runStep(
      runScriptOf(PREFLIGHT_STEP),
      `
        case "$*" in
          *permissions/workflow*) echo "gh: Resource not accessible by integration" >&2; exit 1;;
          *) echo true; exit 0;;
        esac
      `,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skipping the can-approve check");
  });
});

describe("Update PR body step (agent-implement-pr.yml)", () => {
  it("substitutes GitHub template variables in the agent-drafted body", async () => {
    // Same contract as Open draft PR: both body-posting steps must publish
    // the run's real values (PR #2 shipped a dead template link).
    const result = await runStep(
      runScriptOf(UPDATE_PR_BODY_STEP, IMPLEMENT_PR_WORKFLOW_PATH),
      stubEchoingBodyFile("edit"),
      {
        prBody:
          "Evidence: [workflow run]($GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID)",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      "https://github.com/octo/repo/actions/runs/12345",
    );
    expect(result.stderr).not.toContain("$GITHUB_SERVER_URL");
  });

  it("does not call gh when the agent wrote no body", async () => {
    // The -s guard keeps an absent body from reaching gh pr edit; the stub
    // exits 1 on any call, so a nonzero status would mean the call happened.
    const result = await runStep(
      runScriptOf(UPDATE_PR_BODY_STEP, IMPLEMENT_PR_WORKFLOW_PATH),
      "exit 1\n",
      { prBody: "" },
    );
    expect(result.status).toBe(0);
  });
});

describe("Request auto-merge on clean review step", () => {
  const GATE_STEP = "Request auto-merge on clean review";

  /** A gh stub covering the gate's full happy path, marking each
   *  decisive call on stderr so tests can assert what the step did:
   *  `auto-merge requested` only when gh pr merge ran, `hold comment:`
   *  carrying every comment body it posted. */
  const mergeGateStub = `
    prev=""
    for a in "$@"; do
      if [ "$prev" = "--body" ]; then echo "hold comment: $a" >&2; fi
      prev="$a"
    done
    case "$*" in
      *"pr merge"*) echo "auto-merge requested" >&2; exit 0;;
      *"pr comment"*) exit 0;;
      *"--json body"*) cat "$PR_BODY_FILE";;
      *"--json headRefOid"*) echo "headsha123";;
      *"check-runs"*) echo '[{"name":"ci","status":"completed","conclusion":"success"}]';;
      *) echo "unexpected gh call: $*" >&2; exit 1;;
    esac
  `;

  const gateOptions = (verdictJson?: string) => ({
    prBody: "## Merge Danger\n\n**Door:** two-way\n",
    files: {
      "review_payload.json": '{"inlineComments":[]}',
      ...(verdictJson === undefined ? {} : { "verdict.json": verdictJson }),
    },
    env: {
      PAYLOAD: "review_payload.json",
      HOLD: "verdict.json",
      AGENT_PAT: "agent-pat",
      GITHUB_TOKEN_FALLBACK: "github-token",
    },
  });

  it("does not auto-merge a verdict with an unfixed .github/ breaking finding (ADR 0023)", async () => {
    // PR #13: the review verified live that the new preflight 403s for
    // GITHUB_TOKEN — as merged, every implement run fails at minute 0 —
    // and could not fix it (.github/ is off-limits to review edits); the
    // gate merged the PR ~80 s after that verdict. The verdict's
    // holds_merge flag must hold the merge for the operator instead.
    const result = await runStep(
      runScriptOf(GATE_STEP, REVIEW_WORKFLOW_PATH),
      mergeGateStub,
      gateOptions('{"holds_merge":true}'),
    );
    expect(result.status).toBe(0); // a hold is a legitimate outcome
    expect(result.stderr).not.toContain("auto-merge requested");
    expect(result.stderr).toContain("hold comment:");
    expect(result.stderr).toContain("ADR 0023");
  });

  it("still auto-merges a product-side verdict (holds_merge false)", async () => {
    // Product findings keep today's flag-and-merge behavior: with zero
    // inline comments, a two-way door and green CI, the merge requests.
    const result = await runStep(
      runScriptOf(GATE_STEP, REVIEW_WORKFLOW_PATH),
      mergeGateStub,
      gateOptions('{"holds_merge":false}'),
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("auto-merge requested");
  });

  it("holds when the verdict file is missing or unreadable (the barrier holds)", async () => {
    // Same rule as the merger's unreadable blocker count: a safety
    // signal that cannot be read defaults to the conservative outcome —
    // the gate must not merge past a verdict it could not check.
    const result = await runStep(
      runScriptOf(GATE_STEP, REVIEW_WORKFLOW_PATH),
      mergeGateStub,
      gateOptions(),
    );
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("auto-merge requested");
    expect(result.stderr).toContain("verdict");
  });

  it("holds product findings with today's fix-loop comment, not the operator hold", async () => {
    const result = await runStep(
      runScriptOf(GATE_STEP, REVIEW_WORKFLOW_PATH),
      mergeGateStub,
      {
        ...gateOptions('{"holds_merge":false}'),
        files: {
          "review_payload.json":
          '{"inlineComments":[{"path":"src/a.ts","line":1,"body":"fix"}]}',
          "verdict.json": '{"holds_merge":false}',
        },
      },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("auto-merge requested");
    expect(result.stderr).toContain("agent:implement-pr");
    expect(result.stderr).not.toContain("ADR 0023");
  });
});

describe("Post PR review step", () => {
  it("substitutes GitHub template variables in the review payload", async () => {
    // The review prompts dictate $GITHUB_* template links; PR #14's verdict
    // shipped a dead one. The step must publish the run's real values.
    const result = await runStep(
      runScriptOf("Post PR review", REVIEW_WORKFLOW_PATH),
      `
        prev=""
        for a in "$@"; do
          if [ "$prev" = "--input" ]; then cat "$a" >&2; fi
          prev="$a"
        done
        exit 0
      `,
      {
        files: {
          "review_payload.json":
            '{"body":"run page: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID","inlineComments":[]}',
        },
        env: { PAYLOAD: "review_payload.json" },
      },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      "https://github.com/octo/repo/actions/runs/12345",
    );
    expect(result.stderr).not.toContain("$GITHUB_SERVER_URL");
  });
});
