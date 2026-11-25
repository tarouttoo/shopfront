import { asArray, asRecord, asString, standardSchema } from "../shared/common";

/**
 * Pure model of a to-tickets plan: the ticket shape the agent proposes,
 * the whole-plan validation rules (index range, no self-reference, acyclic
 * blocking graph), and the tracker texts a valid plan turns into. No I/O —
 * `to-tickets.ts` owns that.
 */

export const SPEC_LABEL = "spec";
export const READY_LABEL = "ready-for-agent";

export interface PlanTicket {
  readonly title: string;
  readonly body: string;
  /** 0-based indices into the plan: tickets that must close first. */
  readonly blockedBy: readonly number[];
}

/** Constraints the plan must respect beyond well-formedness. */
export interface PlanLimits {
  /** How many Tickets may start as one wave (the agent concurrency). */
  readonly maxWaveSize: number;
}

const asIndex = (value: unknown, label: string, size: number): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer index`);
  }
  if (value < 0 || value >= size) {
    throw new Error(`${label} is out of range (0..${size - 1})`);
  }
  return value;
};

const asPlanTicket = (value: unknown, label: string, size: number): PlanTicket => {
  const record = asRecord(value, label);
  // The key is required even when empty: defaulting a missing key to []
  // silently drops the Spec's blocking edges (an extraction key drift like
  // `blocked_by` would pass validation and decompose into one all-parallel
  // wave). The rejection feeds back to the agent, which re-emits the tag.
  if (!("blockedBy" in record)) {
    throw new Error(
      `${label}.blockedBy is required — echo the key explicitly, [] when the ticket has no blockers`,
    );
  }
  const blockedBy = asArray(record.blockedBy, `${label}.blockedBy`).map(
    (entry, index) => asIndex(entry, `${label}.blockedBy[${index}]`, size),
  );
  return {
    title: asString(record.title, `${label}.title`),
    body: asString(record.body, `${label}.body`),
    blockedBy: [...new Set(blockedBy)].sort((a, b) => a - b),
  };
};

/**
 * Validate the agent's plan — the object emitted inside the output tag
 * (`{"tickets": [...]}`). A plan with zero tickets throws: a Spec marked
 * for decomposition must decompose (the caller turns that into a blocked
 * run instead of looping). Self-references and cycles are rejected so the
 * frontier machinery never deadlocks. The widest wave must fit the agent
 * concurrency: a wider plan launches doomed parallel runs.
 */
export const asTicketPlan = (
  value: unknown,
  limits: PlanLimits = { maxWaveSize: Number.POSITIVE_INFINITY },
): readonly PlanTicket[] => {
  const raw = asArray(asRecord(value, "output").tickets ?? [], "tickets");
  if (raw.length === 0) {
    throw new Error("plan must decompose the Spec into at least one Ticket");
  }
  const tickets = raw.map((entry, index) =>
    asPlanTicket(entry, `tickets[${index}]`, raw.length),
  );
  for (let index = 0; index < tickets.length; index += 1) {
    if (tickets[index]!.blockedBy.includes(index)) {
      throw new Error(`tickets[${index}].blockedBy must not self-reference`);
    }
  }
  assertAcyclic(tickets);
  assertWavesWithin(tickets, limits.maxWaveSize);
  return tickets;
};

export const planSchema = (limits: PlanLimits) =>
  standardSchema<readonly PlanTicket[]>((value) => asTicketPlan(value, limits));

/** DFS cycle check over the blocking edges. */
const assertAcyclic = (tickets: readonly PlanTicket[]): void => {
  const state = new Array<number>(tickets.length).fill(0); // 0 new, 1 visiting, 2 done
  const visit = (index: number): void => {
    if (state[index] === 1) {
      throw new Error("plan has a cycle in blockedBy edges");
    }
    if (state[index] === 2) return;
    state[index] = 1;
    for (const blocker of tickets[index]!.blockedBy) visit(blocker);
    state[index] = 2;
  };
  for (let index = 0; index < tickets.length; index += 1) visit(index);
};

/**
 * The widest frontier layer must fit the agent concurrency: a wider wave
 * launches doomed parallel agent runs (the provider plan caps those).
 */
const assertWavesWithin = (
  tickets: readonly PlanTicket[],
  maxWaveSize: number,
): void => {
  const depth = new Array<number>(tickets.length).fill(-1);
  const depthOf = (index: number): number => {
    if (depth[index] === -1) {
      depth[index] = tickets[index]!.blockedBy.reduce(
        (max, blocker) => Math.max(max, depthOf(blocker) + 1),
        0,
      );
    }
    return depth[index]!;
  };
  const counts = new Map<number, number>();
  for (let index = 0; index < tickets.length; index += 1) {
    const level = depthOf(index);
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  const widest = Math.max(...counts.values());
  if (widest > maxWaveSize) {
    throw new Error(
      `the plan's widest wave is ${widest} Tickets but the agent concurrency is ${maxWaveSize} — stagger Tickets with blockedBy edges so at most ${maxWaveSize} start at once`,
    );
  }
};

/** The ticket issue body: parent pointer first, then the agent's text. */
export const renderTicketBody = (specNumber: number, ticket: PlanTicket): string =>
  `Part of #${specNumber}\n\n${ticket.body}`;

/**
 * The list comment posted on the Spec: the full AFK audit trail — what was
 * created, what blocks what, and where the brakes are.
 */
export const renderListComment = (
  specNumber: number,
  created: readonly { readonly number: number; readonly title: string; readonly blockedBy: readonly number[] }[],
): string => {
  const rows = created
    .map((ticket) => {
      const blockers =
        ticket.blockedBy.length > 0
          ? ticket.blockedBy.map((i) => `#${created[i]!.number}`).join(", ")
          : "—";
      return `| #${ticket.number} | ${ticket.title} | ${blockers} |`;
    })
    .join("\n");
  return [
    `To-tickets run: decomposed this Spec into ${created.length} Ticket(s).`,
    "",
    "| Ticket | Title | Blocked by |",
    "|---|---|---|",
    rows,
    "",
    "Every Ticket got `ready-for-agent` — the converter cascade starts immediately (`agent-convert.yml`): Tickets become `agent:implement` as their blockers close.",
    "Audit here at your leisure; the brakes are the tracker's own: close a Ticket, or remove its `ready-for-agent` label to stop it.",
    `Exploration notes and frontier waves follow on the next \`agent:implement\` event for this Spec (ADR 0019). Part of #${specNumber}.`,
  ].join("\n");
};
