import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { sh } from "./common";

/**
 * Regression test for PR #12: `execSync`/`execFileSync` default to a 1 MiB
 * `maxBuffer`, and whole-PR diffs overflow it — the review run died twice
 * with `spawnSync /bin/sh ENOBUFS` on a 4 MB `git diff main...HEAD`. Both
 * capture helpers must tolerate output well past the old default.
 *
 * When a capture still overflows, Node's own error is the bare
 * `spawnSync /bin/sh ENOBUFS` — no command, no counts (issue #18: tracing
 * it cost a full session). The wrapper around the capture helpers is the
 * only forensic surface, so its shape is pinned here.
 */

describe("capture helpers tolerate output over 1 MiB", () => {
  it("sh() captures 8 MiB of stdout", () => {
    const bytes = 8 * 1024 * 1024;
    const out = sh(`head -c ${bytes} /dev/zero | tr '\\0' 'a'`);
    expect(out.length).toBe(bytes);
  });

  it("gh() sets the same maxBuffer and wraps errors like sh()", () => {
    // gh() itself needs network; assert the knobs in source instead, and
    // force a look if a new capture helper appears without a limit or
    // bypasses the forensic wrapper.
    const source = readFileSync(
      path.join(import.meta.dirname, "common.ts"),
      "utf8",
    );
    expect(source.match(/maxBuffer: MAX_CAPTURE/g)?.length).toBe(2);
    expect(source.match(/captureError\(/g)?.length).toBe(2);
  });

  it("sh() wraps an overflow with the command, the limit, and the captured bytes", () => {
    // 70 MB through the pipe overflows the 64 MiB capture.
    expect(() => sh("head -c 70000000 /dev/zero")).toThrowError(
      /^"head -c 70000000 \/dev\/zero" overflowed 64 MiB maxBuffer after \d+ bytes$/,
    );
  });
});
