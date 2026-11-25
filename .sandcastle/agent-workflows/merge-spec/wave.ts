/**
 * Pure model of the merger's wave barrier (ADR 0019, delta №3): given the
 * live state of a Spec's Tickets — open, blockers, run-state labels, and
 * whether a pushed branch exists — decide what the merger does this pass.
 * No I/O — `merge-spec.ts` owns that.
 */

export const FRONTIER_BLOCK_LABELS = ["agent:blocked", "agent:in-progress"] as const;

export interface WaveTicket {
  readonly number: number;
  readonly open: boolean;
  /** Count of OPEN blockers (the frontier is the zero set). */
  readonly openBlockers: number;
  readonly labels: readonly string[];
  /** The pushed head branch (`agent/issue-<n>-<slug>`), or null. */
  readonly branch: string | null;
}

export type WaveDecision =
  | {
      readonly action: "merge";
      readonly tickets: readonly {
        readonly number: number;
        readonly branch: string;
      }[];
    }
  | { readonly action: "wait"; readonly reason: string }
  | { readonly action: "complete" };

/**
 * The wave barrier: merge the frontier only when every frontier Ticket
 * has finished its run (a pushed branch, no in-flight/blocked label);
 * close nothing here — closing is the merger workflow's job (delta №2).
 * No open tickets means the Spec is complete and the integration PR is
 * due (delta №4).
 */
export const decideWave = (tickets: readonly WaveTicket[]): WaveDecision => {
  const open = tickets.filter((ticket) => ticket.open);
  if (open.length === 0) return { action: "complete" };

  const frontier = open.filter((ticket) => ticket.openBlockers === 0);
  if (frontier.length === 0) {
    return {
      action: "wait",
      reason:
        "no unblocked Tickets — everything is waiting on blockers (or none are open)",
    };
  }

  const inFlight = frontier.filter((ticket) =>
    FRONTIER_BLOCK_LABELS.some((label) => ticket.labels.includes(label)),
  );
  if (inFlight.length > 0) {
    return {
      action: "wait",
      reason: `frontier Tickets mid-flight or failed: ${inFlight
        .map((ticket) => `#${ticket.number}`)
        .join(", ")}`,
    };
  }

  const branchless = frontier.filter((ticket) => ticket.branch === null);
  if (branchless.length > 0) {
    return {
      action: "wait",
      reason: `frontier Tickets without a pushed branch: ${branchless
        .map((ticket) => `#${ticket.number}`)
        .join(", ")}`,
    };
  }

  return {
    action: "merge",
    tickets: frontier.map((ticket) => ({
      number: ticket.number,
      branch: ticket.branch!,
    })),
  };
};

/** The integration branch name for a Spec. */
export const integrationBranch = (specNumber: number): string =>
  `agent/spec-${specNumber}-integration`;

/** The exploration-notes branch name for a Spec. */
export const notesBranch = (specNumber: number): string =>
  `agent/spec-${specNumber}-notes`;
