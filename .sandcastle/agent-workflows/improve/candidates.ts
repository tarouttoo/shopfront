import { asArray, asRecord, asString, standardSchema } from "../shared/common";

/**
 * Pure model of an improve-architecture run: the candidate shape the agent
 * proposes, the whole-plan validation rules, and the issue body a valid
 * candidate turns into. No I/O — `improve.ts` owns that.
 */

export const IMPROVE_LABEL = "improvement";

/** The course's brake (lessons 91–92): at most 5 issues per run, enforced here. */
export const MAX_CANDIDATES = 5;

export const STRENGTHS = [
  "strong",
  "worth-exploring",
  "speculative",
] as const;
export type Strength = (typeof STRENGTHS)[number];

export interface Candidate {
  readonly title: string;
  readonly problem: string;
  readonly solution: string;
  readonly benefits: string;
  readonly files: readonly string[];
  readonly strength: Strength;
  /** ADR number the candidate reopens, or null. */
  readonly contradictsAdr: string | null;
}

const asStrength = (value: unknown, label: string): Strength => {
  if (!STRENGTHS.includes(value as Strength)) {
    throw new Error(`${label} must be one of ${STRENGTHS.join(" | ")}`);
  }
  return value as Strength;
};

const asOptionalString = (value: unknown, label: string): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value;
};

const asCandidate = (value: unknown, label: string): Candidate => {
  const record = asRecord(value, label);
  return {
    title: asString(record.title, `${label}.title`),
    problem: asString(record.problem, `${label}.problem`),
    solution: asString(record.solution, `${label}.solution`),
    benefits: asString(record.benefits, `${label}.benefits`),
    files: asArray(record.files, `${label}.files`).map((file, index) =>
      asString(file, `${label}.files[${index}]`),
    ),
    strength: asStrength(record.strength, `${label}.strength`),
    contradictsAdr: asOptionalString(
      record.contradictsAdr,
      `${label}.contradictsAdr`,
    ),
  };
};

/**
 * Validate the agent's plan — the object emitted inside the output tag
 * (`{"candidates": [...]}`). Zero candidates is valid (an honest "nothing
 * worth deepening this run"); more than MAX_CANDIDATES throws so the
 * caller can retry the extraction rather than silently truncating.
 */
export const asPlan = (value: unknown): readonly Candidate[] => {
  const raw = asArray(asRecord(value, "output").candidates ?? [], "candidates");
  const candidates = raw.map((entry, index) => asCandidate(entry, `candidates[${index}]`));
  if (candidates.length > MAX_CANDIDATES) {
    throw new Error(
      `Plan proposes ${candidates.length} candidates; at most ${MAX_CANDIDATES} per run`,
    );
  }
  return candidates;
};

export const planSchema = standardSchema<readonly Candidate[]>(asPlan);

const strengthHeader: Record<Strength, string> = {
  strong: "Strong",
  "worth-exploring": "Worth exploring",
  speculative: "Speculative",
};

/** The improvement issue body for a candidate, footer included. */
export const renderIssueBody = (
  candidate: Candidate,
  runUrl: string,
): string => {
  const sections = [
    `## Problem\n\n${candidate.problem}`,
    `## Solution\n\n${candidate.solution}`,
    `## Benefits\n\n${candidate.benefits}`,
  ];
  if (candidate.files.length > 0) {
    sections.splice(
      1,
      0,
      `## Files\n\n${candidate.files.map((file) => `- \`${file}\``).join("\n")}`,
    );
  }
  if (candidate.contradictsAdr !== null) {
    sections.push(
      `## ADR conflict\n\nThis candidate contradicts ${candidate.contradictsAdr} — surfaced because the friction looked real enough to reopen it.`,
    );
  }
  sections.push(
    `---\n\n**Recommendation strength:** ${strengthHeader[candidate.strength]}\n\nFiled by the improve-architecture run ([run](${runUrl})); awaiting human review — nothing enters the pipeline until you act on this issue.`,
  );
  return sections.join("\n\n");
};
