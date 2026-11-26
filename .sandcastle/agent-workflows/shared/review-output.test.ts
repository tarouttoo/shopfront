import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { reviewOutputSchema } from "./review-output";

/**
 * Contract over the review verdict (ADR 0023): the verdict carries a
 * `holds_merge` flag, and an unfixed factory-breaking finding rides the
 * flag — not the inline-comment count. PR #13 proved the count is not
 * enough: its review verified live that the new preflight 403s for
 * GITHUB_TOKEN («as merged, every implement run fails at minute 0»),
 * could not fix it (`.github/` is off-limits to review edits), and the
 * auto-merge gate merged the PR ~80 s later because the flag-and-merge
 * contract only counts inline comments.
 */

const validate = (value: unknown) => {
  // Our schemas are synchronous (batch.ts's validate makes the same
  // promise); discard the interface's async branch so tests can read
  // `value` / `issues` directly.
  const result = reviewOutputSchema["~standard"].validate(value);
  if (result instanceof Promise) {
    throw new Error("Schema validation must be synchronous");
  }
  return result;
};

const baseVerdict = {
  summary: "One paragraph of review summary.",
  inlineComments: [],
  replies: [],
};

describe("reviewOutputSchema holds_merge", () => {
  const expectValue = (result: ReturnType<typeof validate>) => {
    if (!("value" in result)) throw new Error("expected a valid verdict");
    return result.value;
  };

  it("parses holds_merge: true into holdsMerge", () => {
    expect(expectValue(validate({ ...baseVerdict, holds_merge: true })).holdsMerge).toBe(true);
  });

  it("parses holds_merge: false (the product-findings verdict)", () => {
    expect(expectValue(validate({ ...baseVerdict, holds_merge: false })).holdsMerge).toBe(false);
  });

  it("rejects a verdict without holds_merge", () => {
    // CODING_STANDARDS: at the agent-JSON boundary a required key's
    // absence is a rejection, not a default — a drifted key must not
    // silently disarm the hold.
    const result = validate(baseVerdict);
    if (!("issues" in result)) throw new Error("expected a rejection");
    expect(result.issues).toBeDefined();
  });

  it("rejects a non-boolean holds_merge", () => {
    const result = validate({ ...baseVerdict, holds_merge: "yes" });
    if (!("issues" in result)) throw new Error("expected a rejection");
    expect(result.issues).toBeDefined();
  });

  it("the PR #13 shape: an unfixed .github/ break holds with zero inline comments", () => {
    // The break rides the summary prose, not a diff-line comment, so the
    // hold must ride the flag: exactly the verdict that merged PR #13.
    expect(expectValue(validate({
      summary:
        "The new preflight 403s for GITHUB_TOKEN — as merged, every implement run fails at minute 0. `.github/` is off-limits to review edits, so I cannot fix this in scope.",
      inlineComments: [],
      replies: [],
      holds_merge: true,
    })).holdsMerge).toBe(true);
  });
});

describe("review.ts → merge gate verdict chain", () => {
  // The flag has three hops: the schema parses it (above), review.ts
  // writes it as the gate's verdict.json, and the gate reads it. Only
  // the middle hop is pinned here in source: review.ts's success path
  // needs a live agent run, so a rename on that side would break the
  // chain silently. The gate's read side is behavior-tested against its
  // real bash in open-draft-pr.test.ts (the same filename injected on
  // both sides); the review.ts → workflow HOLD filename handshake stays
  // prose-pinned (ADR 0023), and drift there defaults to always-hold —
  // the conservative side.
  it("review.ts writes verdict.json with holds_merge from the output", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "../review/review.ts"),
      "utf8",
    );
    expect(source).toContain('writeJson("verdict.json"');
    expect(source).toMatch(/holds_merge:\s*result\.output\.holdsMerge/);
  });
});
