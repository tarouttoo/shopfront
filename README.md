# shopfront

A B2B shopfront — public catalog, cart, order request — built and evolved
by the agent factory ported from `robostudio`, for ООО ИТЦ «Альтер
Энерго». The client's identity is public and the deployed site is
indexable (ADR `0022`, amending the codename rule of ADR `0020`);
product shape is settled in ADR `0021`.

Stack: Astro + React islands + Tailwind CSS, fully static, deployed to
GitHub Pages (ADR `0021`). UI text is Russian per `GLOSSARY.md`; code
and docs are English.

## Development

```sh
npm ci
npm run dev       # Astro dev server
npm run build     # static build into dist/
npm test          # vitest: factory tests (.sandcastle) + product tests (src)
npm run typecheck # astro sync && tsc --noEmit && astro check
npm run lint      # oxlint
```

Pages deploys on every merge to `main` (`.github/workflows/deploy.yml`).

## Agent factory

The factory is a verbatim port of
[`robostudio`](https://github.com/tarouttoo/robostudio)'s label-driven
agent pipeline (ADR `0020`), which itself grew out of
[`agent-pipeline-template`](https://github.com/tarouttoo/agent-pipeline-template)
— a port of [mattpocock/sandcastle](https://github.com/mattpocock/sandcastle)
running the pi CLI as the coding agent. Pipeline files are ours to change
(ADR `0019`, `0020`); the course and upstream sandcastle are references,
not authorities.

| Label | Workflow | What happens |
|---|---|---|
| `agent:implement` (issue) | `agent-implement.yml` | Routes by issue shape (ADR 0019): Spec with tickets → exploration-notes runner; `spec`-marked ticketless issue → to-tickets runner (AFK decomposition); child-of-spec Ticket → v2 implement runner (branch only — the merger takes it); standalone issue → draft PR + `agent:review`. The classic preflights (open collaborator PR refusal) apply to the standalone route. |
| `agent:implement` (PR) | `agent-implement-pr.yml` | Processes review feedback on an existing PR: replies to threads, addresses inline comments, pushes with a lease. |
| `agent:review` | `agent-review.yml` | Reviews the PR, self-fixes findings on the branch, posts a PR review, replies to threads, marks the PR ready, then requests a squash auto-merge on a clean review with green CI (ADR 0011). Held for the operator when the verdict flags an unfixed factory-breaking finding (ADR 0023). The single review pass for a Spec runs on its integration PR. |
| `agent:update-branch` | `agent-update-branch.yml` | Resolves merge conflicts with `main` (always resolve, never abort) and pushes. |
| — (merge + nightly cron) | `agent-rebase-janitor.yml` | The Auto-Rebase janitor (ADR 0019): after any PR merges (and nightly), sweeps open `agent/issue-*` PRs that turned conflicting and labels them `agent:update-branch` via `AGENT_PAT`; exits silently unless the factory is Agent-quiet. |
| — (manual button) | `agent-improve.yml` | Improve-architecture on demand (ADR 0019): `gh workflow run agent-improve.yml` scans the repo with the vendored skill and files ≤ 5 `improvement` issues, deduped, always waiting for human review. |
| — (push / dispatch) | `agent-merge.yml` | The merger (ADR 0019): when a Spec's wave of Tickets has all pushed branches, merges them into the Spec's integration branch, closes the Tickets (driving the next wave), and — when the Spec is complete — opens one draft PR Spec → main labelled `agent:review`. Retry a failed run with `gh workflow run agent-merge.yml -f spec=<n>`. |
| `agent:explore` | `agent-explore.yml` | Batch triage: one agent run plans effects for every open `agent:explore` issue; a separate apply job validates the plan and applies it. Supports `workflow_dispatch` dry-run. |
| `ready-for-agent` (issue) | `agent-convert.yml` | The ready-for-agent converter: a Ticket labelled `ready-for-agent` is evaluated on labelling and re-scanned whenever another issue closes; when the last blocker closes, the label is swapped for `agent:implement` (added with `AGENT_PAT` so the cascade fires), otherwise a comment names the open blockers. In the v2 flow it is also the frontier computer for a Spec's waves. |

Every agent run posts a failure comment with a reason and the workflow-run
link, and relabels the subject `agent:blocked`. Retrying means re-adding the
trigger label named in that comment. For a converted Ticket — one that was
waiting on `ready-for-agent` — retry it by removing and re-adding
`ready-for-agent`. A failed merger labels the Spec `agent:blocked`; retry
with `gh workflow run agent-merge.yml -f spec=<n>`.

Agent draft PRs are authored by `github-actions[bot]`, so GitHub's
workflow-approval gate can nondeterministically hold that PR's initial
`pull_request` CI run as "awaiting approval". It never blocks the
pipeline: the `agent-review` self-fix push rides `AGENT_PAT`, its CI run
is never gated, and that is the check the auto-merge gate (ADR 0011)
waits on. To approve a gated run manually: `gh api -X POST
repos/tarouttoo/shopfront/actions/runs/<run-id>/approve`.

## History

- Factory ported verbatim from robostudio — ported ADRs keep their
  original numbers (`0001`, `0002`, `0010`, `0011`, `0014`, `0019`);
  the numbering gaps are robostudio's product ADRs, which did not
  transfer. The port, the codename rule, and the fresh-setup surface
  are ADR `0020`.
- The `ready-for-agent` converter (ADR `0010`) came with the port: it
  is the bridge between the triage skills' vocabulary and the trigger
  labels, with no upstream counterpart.
- The B2B shape and the static Astro stack are ADR `0021`; CMS and
  Order Request intake are deliberate non-decisions, wayfinder territory.
- ADR `0022` lifts the codename rule and the until-approval gates
  (noindex, placeholder products): the Client is named and the site is
  public and indexable.

## Status

Live preview on GitHub Pages; content integration of the approved
landing and catalog is tracked in the issue tracker.
