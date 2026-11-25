# Labels

The pipeline is driven entirely by labels. There are two kinds, matching the
glossary in [GLOSSARY.md](../GLOSSARY.md):

- **Trigger labels** — you add these to drive the pipeline. Adding one starts
  the matching workflow; the workflow removes the label when the run begins.
- **Lifecycle labels** — the workflows add and remove these themselves.
- **Triage label** — `ready-for-agent`: the approval the converter consumes
  (see below).

What each triggered workflow does in detail: the
[Workflows table in the README](../README.md#workflows). How a human drives
the loop day to day — writing triageable issues, reviewing draft PRs,
acting on verdicts: [docs/triage.md](triage.md). The canonical triage roles
mattpocock/skills speaks in (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`) map onto the labels below in
[docs/agents/triage-labels.md](agents/triage-labels.md).

## Trigger labels

| Label | Add it to | Starts | Notes |
|---|---|---|---|
| `agent:implement` | issues | `agent-implement.yml` | Routes by issue shape (ADR 0019): a Spec with tickets → the exploration-notes runner (markdown notes on `agent/spec-<n>-notes` + an exploration comment); a `spec`-marked issue without tickets → the to-tickets runner (AFK decomposition, tickets get `ready-for-agent` immediately); a child-of-spec Ticket → the v2 implement runner (branch only, no PR — the merger integrates waves and closes tickets); a standalone issue → the classic chain (draft PR + review + auto-merge). |
| `agent:implement` | PRs | `agent-implement-pr.yml` | Processes review feedback: replies to threads, addresses inline comments, pushes with a lease. |
| `agent:review` | PRs | `agent-review.yml` | On success marks the PR ready and requests a squash auto-merge (ADR 0011) — held with a comment when the review posted inline comments or CI is not green. |
| `agent:update-branch` | PRs | `agent-update-branch.yml` | Always resolves merge conflicts with `main`, never aborts. |
| `agent:explore` | issues | `agent-explore.yml` | Batch triage. See the exception below. |
| `improvement` | issues | — (marker) | Filed by the improve-architecture button (`agent-improve.yml`, ADR 0019) — the factory's recommendation issues about the codebase itself, at most 5 per run, deduped against open `improvement` issues. Always wait for a human: drive them into the pipeline yourself (`agent:implement`, or `spec` + `agent:implement` to have to-tickets decompose). The button itself is manual: `gh workflow run agent-improve.yml`. |
| `spec` | issues | — (marker) | Marks an issue as a Spec while it has no sub-issues yet — the shape the preflight can't see. With the marker plus `agent:implement`, the to-tickets runner decomposes it AFK (ADR 0019); once tickets exist, the marker is redundant (sub-issues are the shape) but harmless to keep. |

A failed run labels the subject `agent:blocked` and posts a failure comment
naming the trigger label to re-add — **retrying means re-adding that label**.

The exception is `agent:explore`: the label stays on the issue across runs
(the apply job swaps it for a verdict label or removes it when closing a
duplicate), and each run ignores the triggering event and explores every open
`agent:explore` issue together. It can also be run via `workflow_dispatch`,
which is a dry-run by default — set the `dry_run` input to `false` to apply
the plan for real.

## Lifecycle labels

| Label | Meaning |
|---|---|
| `agent:in-progress` | Added when a run begins (alongside removing the trigger label and any `agent:blocked`); removed when the run ends, success or failure. |
| `agent:blocked` | Added when a run fails, together with the failure comment naming the trigger label to re-add; removed by the next run's start. The explore batch does not use it — a failed batch leaves every `agent:explore` label in place for the next run. |
| `ready-for-human` | The explore `needs-a-human` verdict, applied to a surviving issue that needs a human decision. Must exist or the apply job's label swap fails. |

The other two explore verdicts reuse labels above: an `easy-call` survivor is
handed `agent:implement` (added with `AGENT_PAT` so the label event actually
starts the implement workflow), and a `blocked` survivor gets
`agent:blocked`.

## Triage label

| Label | Put it on | What happens |
|---|---|---|
| `ready-for-agent` | Ticket issues | The converter's approval (`agent-convert.yml`, no upstream counterpart). The Ticket is evaluated when it is labelled and re-scanned whenever another issue closes. All blockers closed → the label is swapped for `agent:implement` (added with `AGENT_PAT` so the label event actually starts the implement workflow). Open blockers → a comment names them; the label is kept and the swap fires when the last blocker closes. |

Blocking edges are read from the tracker's native blocked-by relationships
where available, falling back to the issue body's `## Blocked by` section —
parsed in TypeScript, never the shell. This is the label the triage skills
speak in: [docs/agents/triage-labels.md](agents/triage-labels.md) maps the
canonical `ready-for-agent` role onto it, and the converter is what makes
the pipeline honor that vocabulary
([ADR 0010](adr/0010-ready-for-agent-converter.md)).

## Setup

Create the labels the workflows expect:

```sh
for label in "agent:implement" "agent:review" "agent:update-branch" "agent:explore" "agent:in-progress" "agent:blocked" "ready-for-human" "ready-for-agent" "improvement" "spec"; do
  gh label create "$label" --color d4c5f9 || true
done
```
