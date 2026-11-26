import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = new URL(
  "../../../.github/workflows/agent-implement.yml",
  import.meta.url,
);

const OPEN_DRAFT_PR_STEP = "Open draft PR";
const PREFLIGHT_STEP = "Preflight repo settings";

/** The run script of a named step, exactly as GitHub Actions would execute it. */
const runScriptOf = (stepName: string): string => {
  const workflow = parse(readFileSync(WORKFLOW_PATH, "utf8")) as {
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
  options: { prBody?: string } = {},
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
          BRANCH: "agent/issue-11-some-issue-title",
          PR_BODY_FILE: prBodyFile,
          GITHUB_OUTPUT: githubOutput,
          GH_REPO: "octo/repo",
          // Default env every GitHub Actions step gets.
          GITHUB_SERVER_URL: "https://github.com",
          GITHUB_REPOSITORY: "octo/repo",
          GITHUB_RUN_ID: "12345",
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
      `
        if [ "$1" = pr ] && [ "$2" = create ]; then
          prev=""
          for a in "$@"; do
            if [ "$prev" = "--body-file" ]; then grep "Evidence:" "$a" >&2; fi
            prev="$a"
          done
          echo "https://github.com/octo/repo/pull/42"
          exit 0
        fi
        exit 1
      `,
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

  it("fails with the fix command when auto-merge is off (ADR 0011)", async () => {
    const result = await runStep(
      runScriptOf(PREFLIGHT_STEP),
      settingsStub(true, false),
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("allow_auto_merge=true");
  });
});
