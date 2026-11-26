import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract test over review.ts's failure path: a forced review failure
 * must leave a failure_reason.txt the workflow's «Reason:» comment posts
 * verbatim, and a stranger must be able to diagnose it without reading
 * the workflow (issue #18). The reason therefore carries the real error
 * AND the diff byte size, measured before the diff attempt — the forensics
 * an ENOBUFS-sized failure needs, since Node's own spawn error for an
 * overflow carries no child output.
 */

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
const reviewTs = path.join(import.meta.dirname, "review.ts");

const initRepo = (dir: string): number => {
  execSync(
    [
      "git init -q -b main",
      "git config user.email test@example.com",
      "git config user.name test",
      "echo a > f.txt",
      "git add .",
      "git commit -qm one",
      "git checkout -qb topic",
      "echo b >> f.txt",
      "git add .",
      "git commit -qm two",
    ].join(" && "),
    { cwd: dir, stdio: "ignore" },
  );
  return Number(
    execSync("git diff main...HEAD | wc -c", {
      cwd: dir,
      encoding: "utf8",
    }).trim(),
  );
};

describe("review.ts failure path", () => {
  it("records the real error and the diff byte size in the failure reason", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "review-fail-"));
    const out = mkdtempSync(path.join(os.tmpdir(), "review-out-"));
    const stubBin = path.join(out, "bin");
    try {
      const diffBytes = initRepo(dir);
      expect(diffBytes).toBeGreaterThan(0);

      // A stub `gh` first on PATH forces the review failure deterministically
      // (the context fetch is the first gh call) with a recognizable error.
      execSync(`mkdir -p ${JSON.stringify(stubBin)}`);
      const ghStub = path.join(stubBin, "gh");
      execSync(
        `printf '#!/usr/bin/env bash\\necho "stub gh: review context unavailable" >&2\\nexit 1\\n' > ${JSON.stringify(ghStub)} && chmod +x ${JSON.stringify(ghStub)}`,
      );

      let status = 0;
      try {
        execSync(`${JSON.stringify(tsxBin)} ${JSON.stringify(reviewTs)}`, {
          cwd: dir,
          encoding: "utf8",
          stdio: "pipe",
          env: {
            ...process.env,
            PATH: `${stubBin}:${process.env.PATH}`,
            PR_NUMBER: "1",
            BRANCH: "topic",
            OUTPUT_DIR: out,
          },
        });
      } catch (error) {
        status = (error as { status?: number }).status ?? -1;
      }
      expect(status).toBe(1);

      const reason = readFileSync(path.join(out, "failure_reason.txt"), "utf8");
      // The real error survives into the reason...
      expect(reason).toContain("stub gh: review context unavailable");
      // ...next to the diff forensics, with the exact measured size.
      expect(reason).toContain(`(diff main...HEAD: ${diffBytes} bytes)`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});
