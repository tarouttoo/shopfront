import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureDiff } from "./review-context";

/**
 * captureDiff picks the review's diff surface (`main...HEAD`, merge-base)
 * with a `main..HEAD` fallback. When both captures fail, the FIRST error's
 * message must propagate — its wrapped shape (command, capture limit,
 * captured bytes) is the forensic surface for a maxBuffer overflow, and
 * rethrowing the fallback's instead buries which capture actually died
 * (issue #18: the exact "no silent fallbacks" shape the standards ban).
 */

const repoRoot = process.cwd();
const tempDirs: string[] = [];

/** A throwaway git repo built from shell steps, one line each. */
const initRepo = (steps: string[], initialBranch = "main"): string => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "review-diff-"));
  tempDirs.push(dir);
  execSync(
    [
      `git init -q -b ${initialBranch}`,
      "git config user.email test@example.com",
      "git config user.name test",
      ...steps,
    ].join(" && "),
    { cwd: dir, stdio: "ignore" },
  );
  return dir;
};

afterEach(() => {
  process.chdir(repoRoot);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("captureDiff", () => {
  it("returns the three-dot merge-base diff", () => {
    const dir = initRepo([
      "echo a > f.txt",
      "git add .",
      "git commit -qm one",
      "git checkout -qb topic",
      "echo b >> f.txt",
      "git add .",
      "git commit -qm two",
    ]);
    process.chdir(dir);
    expect(captureDiff()).toContain("+b");
  });

  it("propagates the first error's message when both captures fail", () => {
    // A repo without `main` fails both the three-dot and the two-dot
    // capture. The first error names its command (`main...HEAD`, three
    // dots); the fallback's would read `main..HEAD` — asserting on the
    // three-dot form proves the first error won, not the fallback's.
    const dir = initRepo(
      [
        "git commit -qm root --allow-empty",
      ],
      // `trunk`: no `main` ref, so both captures must fail.
      "trunk",
    );
    process.chdir(dir);
    expect(() => captureDiff()).toThrowError(/git diff main\.\.\.HEAD/);
  });
});
