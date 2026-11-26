import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { sh } from "./common";

/**
 * Regression test for PR #12: `execSync`/`execFileSync` default to a 1 MiB
 * `maxBuffer`, and whole-PR diffs overflow it — the review run died twice
 * with `spawnSync /bin/sh ENOBUFS` on a 4 MB `git diff main...HEAD`. Both
 * capture helpers must tolerate output well past the old default.
 */

describe("capture helpers tolerate output over 1 MiB", () => {
  it("sh() captures 8 MiB of stdout", () => {
    const bytes = 8 * 1024 * 1024;
    const out = sh(`head -c ${bytes} /dev/zero | tr '\\0' 'a'`);
    expect(out.length).toBe(bytes);
  });

  it("gh() sets the same maxBuffer", () => {
    // gh() itself needs network; assert the knob in source instead, and
    // force a look if a new capture helper appears without a limit.
    const source = readFileSync(
      path.join(import.meta.dirname, "common.ts"),
      "utf8",
    );
    expect(source.match(/maxBuffer: MAX_CAPTURE/g)?.length).toBe(2);
  });
});
