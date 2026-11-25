import { describe, expect, it } from "vitest";
import {
  decideWave,
  integrationBranch,
  notesBranch,
  type WaveTicket,
} from "./wave";

const ticket = (overrides: Partial<WaveTicket> & { number: number }): WaveTicket => ({
  open: true,
  openBlockers: 0,
  labels: [],
  branch: `agent/issue-${overrides.number}-slug`,
  ...overrides,
});

describe("decideWave", () => {
  it("merges the whole frontier when every ticket has its branch", () => {
    const decision = decideWave([
      ticket({ number: 41 }),
      ticket({ number: 42 }),
    ]);
    expect(decision.action).toBe("merge");
    if (decision.action === "merge") {
      expect(decision.tickets.map((t) => t.number)).toEqual([41, 42]);
    }
  });

  it("is a wave barrier: blocked frontier tickets hold the merge", () => {
    const decision = decideWave([
      ticket({ number: 41 }),
      ticket({ number: 42, labels: ["agent:blocked"] }),
    ]);
    expect(decision.action).toBe("wait");
    if (decision.action === "wait") expect(decision.reason).toContain("#42");
  });

  it("holds while a frontier ticket is mid-flight", () => {
    const decision = decideWave([
      ticket({ number: 41, labels: ["agent:in-progress"] }),
    ]);
    expect(decision.action).toBe("wait");
  });

  it("holds while a frontier ticket has not pushed its branch", () => {
    const decision = decideWave([ticket({ number: 41, branch: null })]);
    expect(decision.action).toBe("wait");
    if (decision.action === "wait") expect(decision.reason).toContain("#41");
  });

  it("ignores blocked tickets behind open blockers (not the frontier)", () => {
    const decision = decideWave([
      ticket({ number: 41 }),
      ticket({ number: 43, openBlockers: 2, labels: ["agent:blocked"] }),
    ]);
    expect(decision.action).toBe("merge");
  });

  it("waits when every open ticket is blocked", () => {
    const decision = decideWave([
      ticket({ number: 43, openBlockers: 1 }),
      ticket({ number: 44, openBlockers: 1 }),
    ]);
    expect(decision.action).toBe("wait");
  });

  it("completes the spec when no tickets remain open", () => {
    const decision = decideWave([
      ticket({ number: 41, open: false }),
      ticket({ number: 42, open: false }),
    ]);
    expect(decision).toEqual({ action: "complete" });
  });

  it("completes an empty spec", () => {
    expect(decideWave([])).toEqual({ action: "complete" });
  });
});

describe("branch names", () => {
  it("follows the ADR 0019 conventions", () => {
    expect(integrationBranch(39)).toBe("agent/spec-39-integration");
    expect(notesBranch(39)).toBe("agent/spec-39-notes");
  });
});
