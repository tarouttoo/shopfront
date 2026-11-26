# Agent runs share a global three-shard concurrency cap

The provider limits concurrent LLM sessions (~3–4: empirically a 4th and
5th run died at start, and the key is shared with the operator's local
sessions). The per-unit concurrency groups the port shipped left the
heavy fan-out unbounded: `agent-implement` grouped per issue
(`agent-implement-issue-<N>`) and `agent-implement-pr` /
`agent-review` / `agent-update-branch` grouped per PR
(`agent-mutate-pr-<N>`), so different Tickets and PRs ran in parallel
without bound — the Spec #4 wave ran 4 implement runs plus stacked
reviews, past the limit. Only explore/improve/merge serialized
repo-wide. Ticket-driven agent workflows now key their concurrency group
as `agent-llm-<unit % 3>`, capping repo-wide concurrent agent runs at 3
while keeping same-PR runs serialized.

## Design

- **Three shards, keyed by the unit number.** `agent-implement.yml`
  groups on `github.event.issue.number % 3`; the three PR workflows
  group on `github.event.pull_request.number % 3`. All four share the
  `agent-llm-` prefix, so the shard namespaces are one pool: an issue
  implement on shard 0 queues behind a PR review on shard 0, and the
  repo-wide total of concurrent agent runs never exceeds 3.
- **Same-unit serialization survives.** A unit's number is its shard
  key, so every run for the same PR (implement, review, update-branch)
  lands in the same group and queues — the old `agent-mutate-pr-<N>`
  guarantee holds without a second group, which GitHub does not support
  anyway (one `concurrency` block per job).
- **Queue, never cancel.** `cancel-in-progress` stays `false`
  everywhere: a queued run is a later slot, a cancelled one is a lost
  run that would leave its issue `agent:in-progress` and its branch
  unpushed.
- **No `github.run_id` fallback is needed here.** All four workflows
  fire only on `labeled` events (issues / pull_request /
  pull_request_target), which always carry the unit number. Workflows
  that can fire numberless (agent-explore's `workflow_dispatch`) keep
  their existing fallback.
- **The wave planner and the shards now agree.** `to-tickets` already
  validates a plan's widest wave against `AGENT_CONCURRENCY: "3"`; that
  check was advisory while implement fan-out was unbounded, and is
  enforced by the shards now — a wave of 3 starts 3-wide, a wave of more
  cannot be planned at all.

## Considered options

- **A repo-wide singleton group** (like agent-merge) — rejected: a
  single queue serializes even independent one-issue PRs, idling two
  provider slots the operator pays for; three shards keep useful
  parallelism exactly at the observed limit.
- **Per-workflow shards** (`agent-implement-shard-<n %>`, distinct from
  review's) — rejected: the provider counts sessions, not workflow
  names; separate namespaces would each allow 3 and sum past the limit
  again (the same mistake as per-unit groups, at shard granularity).
- **A queueing script inside the runners** (acquire a lock via the
  Issues API before starting the agent) — rejected: re-implements what
  GitHub's concurrency groups already do, with more state to get wrong.

## Consequences

Concurrent agent runs top out at 3, and a wide wave queues instead of
dying at the provider. The cost is head-of-line blocking: a same-shard
run for an unrelated unit delays a run behind it, so an issue number can
wait on a PR it has nothing to do with — accepted, because the
alternative was runs failing outright at start. To re-tune the cap,
change the modulus in the four YAMLs and the `AGENT_CONCURRENCY` value
together; the contract test (`.sandcastle/agent-workflows/shared/concurrency.test.ts`)
pins the expressions so the two cannot drift silently.
