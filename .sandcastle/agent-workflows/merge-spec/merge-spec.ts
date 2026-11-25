import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import {
  agentFromEnv,
  appendSummary,
  fail,
  gh,
  required,
  sh,
} from "../shared/common";
import { parseNativeIssues } from "../convert/blockers";
import {
  decideWave,
  integrationBranch,
  type WaveDecision,
  type WaveTicket,
} from "./wave";

/**
 * The merger runner (ADR 0019, course lesson 102 design two): one agent
 * run per wave merges the completed Ticket branches into the Spec's
 * Integration Branch and settles conflicts there; this script owns every
 * GitHub write and every push. Closing Tickets is deterministic here, not
 * agent work (delta №2), and their close events re-fire the converter —
 * the next wave's frontier (the close rides AGENT_PAT: GitHub never fires
 * workflows for events created by GITHUB_TOKEN). When no Tickets remain
 * open (delta №4), the
 * script opens ONE draft PR Spec → main from the Integration Branch and
 * labels it `agent:review`, so the existing review + auto-merge chain
 * (ADR 0011 + 0014) takes over.
 */

const GH_REPO = required("GH_REPO");
const SPEC_NUMBER = required("SPEC_NUMBER");
const AGENT_PAT = process.env.AGENT_PAT ?? "";

if (!AGENT_PAT) {
  fail(
    "AGENT_PAT is required: the integration PR is labelled agent:review with the PAT so the review chain fires",
  );
}

const specNumber = Number(SPEC_NUMBER);
if (!Number.isInteger(specNumber) || specNumber <= 0) {
  fail(`Invalid spec number: ${SPEC_NUMBER}`);
}
const integration = integrationBranch(specNumber);

const ghWith = (args: string[], token: string): string =>
  execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GH_TOKEN: token },
  });

const truncate = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit)}\n… (truncated)`;

const remoteBranches = (): string[] =>
  sh("git ls-remote --heads origin")
    .split("\n")
    .map((line) => line.split("\t")[1]?.replace("refs/heads/", "").trim() ?? "")
    .filter((name) => name.length > 0);

const fetchTickets = (): WaveTicket[] => {
  // gh() returns raw JSON stdout; parseNativeIssues eats parsed data.
  const subs = parseNativeIssues(
    JSON.parse(gh([
      "api",
      `repos/${GH_REPO}/issues/${SPEC_NUMBER}/sub_issues`,
    ])),
  );
  const branches = remoteBranches();
  return subs.map((sub) => {
    const raw = JSON.parse(
      gh([
        "api",
        `repos/${GH_REPO}/issues/${String(sub.number)}`,
        "--jq",
        "{state: .state, labels: [.labels[].name]}",
      ]),
    ) as { state: string; labels: string[] };
    let openBlockers = 0;
    try {
      openBlockers = Number(
        gh([
          "api",
          `repos/${GH_REPO}/issues/${String(sub.number)}`,
          "--jq",
          ".issue_dependencies_summary.blocked_by",
        ]).trim(),
      );
    } catch {
      openBlockers = 1; // unreadable → treat as blocked: the barrier holds
    }
    const branch =
      branches.find((name) => name.startsWith(`agent/issue-${sub.number}-`)) ??
      null;
    return {
      number: sub.number,
      open: raw.state === "open",
      openBlockers: Number.isFinite(openBlockers) ? openBlockers : 1,
      labels: Array.isArray(raw.labels) ? raw.labels : [],
      branch,
    };
  });
};

const ticketContext = (tickets: readonly { number: number; branch: string }[]): string =>
  tickets
    .map((ticket) => {
      const body = JSON.parse(
        gh(["issue", "view", String(ticket.number), "--json", "body"]),
      ) as { body?: string | null };
      return [
        `## Ticket #${ticket.number} — branch \`${ticket.branch}\``,
        "",
        truncate(body.body ?? "(empty body)", 4000),
      ].join("\n");
    })
    .join("\n\n");

const runAgent = async (
    mode: "merge" | "pr-body",
    extraArgs: Record<string, string>,
  ): Promise<void> => {
    await sandcastle.run({
      name: `merge-spec-${specNumber}-${mode}`,
      agent: agentFromEnv(),
      sandbox: noSandbox(),
      logging: { type: "stdout" },
      promptFile: path.join(
        import.meta.dirname,
        mode === "merge" ? "prompt.md" : "prompt-pr.md",
      ),
      promptArgs: extraArgs,
    });
  };

const closeTickets = (tickets: readonly { number: number; branch: string }[]): void => {
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : "(unknown run)";
  for (const ticket of tickets) {
    gh([
      "issue",
      "comment",
      String(ticket.number),
      "--body",
      `Merged into \`${integration}\` by the merger run ([run](${runUrl})). Closing — the converter picks up the next wave.`,
    ]);
    // The close rides AGENT_PAT: the `closed` event must re-fire
    // agent-convert (the waiting tickets' frontier), and GitHub never
    // fires workflows for events created by GITHUB_TOKEN. The comment
    // above fires nothing and stays on the ambient token.
    ghWith(["issue", "close", String(ticket.number)], AGENT_PAT);
  }
};

try {
  sh("git config user.name \"sandcastle-agent[bot]\"");
  sh("git config user.email \"sandcastle-agent[bot]@users.noreply.github.com\"");

  appendSummary(`### Merger run for Spec #${specNumber}\n`);

  for (let wave = 1; wave <= 10; wave += 1) {
    const decision: WaveDecision = decideWave(fetchTickets());

    if (decision.action === "wait") {
      appendSummary(`Wave ${wave}: waiting — ${decision.reason}\n`);
      break;
    }

    if (decision.action === "complete") {
      const existingPr = gh([
        "pr",
        "list",
        "--head",
        integration,
        "--state",
        "open",
        "--json",
        "number",
        "--jq",
        "length",
      ]).trim();
      if (existingPr !== "0") {
        appendSummary(
          `Spec complete; the integration PR already exists (#${existingPr}) — nothing to do.\n`,
        );
        break;
      }
      const specRaw = JSON.parse(
        gh(["issue", "view", SPEC_NUMBER, "--json", "title,body"]),
      ) as { title: string; body?: string | null };
      const commitLog = sh(
        `git log origin/main..${integration} --oneline --no-decorate`,
      );
      const bodyPath = path.join(fs.mkdtempSync("/tmp/mergespec-"), "pr-body.md");
      await runAgent("pr-body", {
        SPEC_NUMBER: String(specNumber),
        INTEGRATION_BRANCH: integration,
        SPEC_CONTEXT: `${specRaw.title}\n\n${truncate(specRaw.body ?? "", 8000)}`,
        COMMIT_LOG: commitLog || "(no commits beyond main)",
        PR_BODY_PATH: bodyPath,
      });
      const title = `Spec #${specNumber}: ${specRaw.title}`.slice(0, 256);
      const prUrl = gh([
        "pr",
        "create",
        "--draft",
        "--base",
        "main",
        "--head",
        integration,
        "--title",
        title,
        "--body-file",
        bodyPath,
      ]).trim();
      ghWith(["pr", "edit", String(prUrl.split("/").pop()), "--add-label", "agent:review"], AGENT_PAT);
      appendSummary(
        `Spec complete: opened the integration PR ${prUrl} and labelled it \`agent:review\` — the single review pass runs there (ADR 0019, delta №4).\n`,
      );
      break;
    }

    // merge
    appendSummary(
      `Wave ${wave}: merging ${decision.tickets.map((t) => `#${t.number}`).join(", ")} into \`${integration}\`.\n`,
    );
    const stateLine = remoteBranches().includes(integration)
      ? "The branch exists on the remote — update it."
      : "The branch does not exist yet — create it from origin/main.";
    await runAgent("merge", {
      SPEC_NUMBER: String(specNumber),
      INTEGRATION_BRANCH: integration,
      INTEGRATION_STATE_LINE: stateLine,
      TICKETS_CONTEXT: ticketContext(decision.tickets),
    });
    sh(`git push origin ${integration}`);
    appendSummary(
      `Pushed \`${integration}\`; closing ${decision.tickets.map((t) => `#${t.number}`).join(", ")}.\n`,
    );
    closeTickets(decision.tickets);
    // Loop: the next wave may already be fully pushed (or none is — the
    // next run waits for the converter's cascade).
  }
} catch (error) {
  fail(
    `merge-spec run failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}
