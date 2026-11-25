import { describe, expect, it } from "vitest";
import {
  IMPROVE_LABEL,
  MAX_CANDIDATES,
  asPlan,
  planSchema,
  renderIssueBody,
} from "./candidates";

const candidate = {
  title: "Deepen the Generation module's outcome interface",
  problem: "Friction.",
  solution: "Restructure.",
  benefits: "Locality.",
  files: ["src/ui/generation.ts"],
  strength: "strong",
  contradictsAdr: null,
} as const;

describe("asPlan", () => {
  it("accepts an honest empty plan", () => {
    expect(asPlan({ candidates: [] })).toEqual([]);
  });

  it("accepts candidates up to the cap", () => {
    const plan = Array.from({ length: MAX_CANDIDATES }, (_, i) => ({
      ...candidate,
      title: `c${i}`,
    }));
    expect(asPlan({ candidates: plan })).toHaveLength(MAX_CANDIDATES);
  });

  it("rejects plans beyond the cap — no silent truncation", () => {
    const plan = Array.from({ length: MAX_CANDIDATES + 1 }, (_, i) => ({
      ...candidate,
      title: `c${i}`,
    }));
    expect(() => asPlan({ candidates: plan })).toThrow(/at most 5/);
  });

  it("rejects unknown strengths and non-file paths garbage", () => {
    expect(() => asPlan({ candidates: [{ ...candidate, strength: "meh" }] })).toThrow(/strength/);
    expect(() => asPlan({ candidates: [{ ...candidate, files: ["a", 3] }] })).toThrow(/files\[1\]/);
    expect(() => asPlan({ candidates: [{ ...candidate, title: "" }] })).toThrow(/title/);
  });

  it("rejects a bare array — the output tag carries an object", () => {
    expect(() => asPlan([candidate])).toThrow(/must be an object/);
  });

  it("treats null/empty contradictsAdr as no conflict", () => {
    const contradictions = asPlan({
      candidates: [
        { ...candidate, contradictsAdr: null },
        { ...candidate, contradictsAdr: "" },
      ],
    }).map((entry) => entry.contradictsAdr);
    expect(contradictions).toEqual([null, null]);
  });

  it("exposes the standard schema interface", () => {
    const ok = planSchema["~standard"].validate({ candidates: [candidate] });
    expect("value" in ok && ok.value).toHaveLength(1);
    const empty = planSchema["~standard"].validate({ candidates: [] });
    expect("value" in empty).toBe(true);
    const bad = planSchema["~standard"].validate({ candidates: [{ ...candidate, strength: "x" }] });
    expect("issues" in bad).toBe(true);
  });
});

describe("renderIssueBody", () => {
  it("renders the sections and the human-review footer", () => {
    const body = renderIssueBody(candidate, "https://example.run/1");
    expect(body).toContain("## Problem");
    expect(body).toContain("## Solution");
    expect(body).toContain("## Benefits");
    expect(body).toContain("`src/ui/generation.ts`");
    expect(body).toContain("**Recommendation strength:** Strong");
    expect(body).toContain("awaiting human review");
    expect(body).toContain("https://example.run/1");
  });

  it("lists files and ADR conflicts when present", () => {
    const body = renderIssueBody(
      {
        ...candidate,
        files: ["a.ts", "b.ts"],
        strength: "speculative",
        contradictsAdr: "ADR 0007",
      },
      "https://example.run/1",
    );
    expect(body).toContain("- `a.ts`");
    expect(body).toContain("## ADR conflict");
    expect(body).toContain("ADR 0007");
    expect(body).toContain("Speculative");
  });

  it("carries the improvement label constant", () => {
    expect(IMPROVE_LABEL).toBe("improvement");
  });
});
