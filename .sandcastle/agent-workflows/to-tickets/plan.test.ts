import { describe, expect, it } from "vitest";
import {
  READY_LABEL,
  SPEC_LABEL,
  asTicketPlan,
  planSchema,
  renderListComment,
  renderTicketBody,
} from "./plan";

const ticket = (title: string, blockedBy: readonly number[] = []) => ({
  title,
  body: `${title} acceptance criteria`,
  blockedBy,
});

describe("asTicketPlan", () => {
  it("accepts an indexed plan with honest edges", () => {
    const plan = asTicketPlan({
      tickets: [ticket("A"), ticket("B", [0]), ticket("C", [0, 1])],
    });
    expect(plan).toHaveLength(3);
    expect(plan[1]!.blockedBy).toEqual([0]);
    expect(plan[2]!.blockedBy).toEqual([0, 1]);
  });

  it("rejects a ticket whose blockedBy key is missing — silent edge loss", () => {
    expect(() =>
      asTicketPlan({
        tickets: [ticket("A"), { title: "B", body: "B acceptance criteria" }],
      }),
    ).toThrow(/blockedBy is required/);
  });

  it("rejects an empty plan — a marked Spec must decompose", () => {
    expect(() => asTicketPlan({ tickets: [] })).toThrow(/at least one Ticket/);
    expect(() => asTicketPlan({})).toThrow(/at least one Ticket/);
  });

  it("rejects out-of-range and non-integer indices", () => {
    expect(() => asTicketPlan({ tickets: [ticket("A", [1])] })).toThrow(/out of range/);
    expect(() => asTicketPlan({ tickets: [ticket("A", [0.5])] })).toThrow(/integer/);
    expect(() => asTicketPlan({ tickets: [ticket("A", ["0" as unknown as number])] })).toThrow(/integer/);
  });

  it("rejects self-references", () => {
    expect(() => asTicketPlan({ tickets: [ticket("A", [0])] })).toThrow(
      /self-reference/,
    );
  });

  it("rejects cycles so the frontier never deadlocks", () => {
    expect(() =>
      asTicketPlan({ tickets: [ticket("A", [1]), ticket("B", [0])] }),
    ).toThrow(/cycle/);
    expect(() =>
      asTicketPlan({ tickets: [ticket("A", [2]), ticket("B", [0]), ticket("C", [1])] }),
    ).toThrow(/cycle/);
  });

  it("dedupes and sorts blocking edges", () => {
    const plan = asTicketPlan({ tickets: [ticket("A"), ticket("B", [0, 0])] });
    expect(plan[1]!.blockedBy).toEqual([0]);
  });

  it("exposes the standard schema interface", () => {
    const ok = planSchema({ maxWaveSize: 3 })["~standard"].validate({
      tickets: [ticket("A")],
    });
    expect("value" in ok && ok.value).toHaveLength(1);
    const bad = planSchema({ maxWaveSize: 3 })["~standard"].validate({
      tickets: [],
    });
    expect("issues" in bad).toBe(true);
  });

  it("rejects a plan whose widest wave exceeds the agent concurrency", () => {
    expect(() =>
      asTicketPlan(
        { tickets: [ticket("A"), ticket("B"), ticket("C")] },
        { maxWaveSize: 2 },
      ),
    ).toThrow(/widest wave/);
  });

  it("accepts the same plan staggered within the concurrency", () => {
    const plan = asTicketPlan(
      { tickets: [ticket("A"), ticket("B", [0]), ticket("C", [0])] },
      { maxWaveSize: 2 },
    );
    expect(plan).toHaveLength(3);
    expect(plan[1]!.blockedBy).toEqual([0]);
    expect(plan[2]!.blockedBy).toEqual([0]);
  });
});

describe("renderTicketBody", () => {
  it("leads with the parent pointer (fallback when sub-issue edges fail)", () => {
    const body = renderTicketBody(39, ticket("A"));
    expect(body.startsWith("Part of #39\n\n")).toBe(true);
  });
});

describe("renderListComment", () => {
  it("renders the audit table with resolved ticket numbers", () => {
    const created = [
      { number: 101, title: "A", blockedBy: [] as readonly number[] },
      { number: 102, title: "B", blockedBy: [0] },
    ];
    const comment = renderListComment(39, created);
    expect(comment).toContain("| #101 | A | — |");
    expect(comment).toContain("| #102 | B | #101 |");
    expect(comment).toContain("`ready-for-agent`");
    expect(comment).toContain("brakes");
    expect(comment).toContain("Part of #39");
  });
});

describe("label vocabulary", () => {
  it("is the load-bearing strings", () => {
    expect(SPEC_LABEL).toBe("spec");
    expect(READY_LABEL).toBe("ready-for-agent");
  });
});
