# Adopt Software Factory Part Two

A grilling session over Software Factory Part Two (course lessons 87–103)
settled what this repo adopts from it. Two structural decisions frame
everything else: **the factory stays all-GitHub**, and **the verbatim-port
constraint is gone** — pipeline files are ours to change, the course and
upstream sandcastle are references, not authorities. The Implement Spec
orchestration (v2) is the target design recorded here but not built yet;
the build order at the bottom is the approved sequence, staged.

## Design

### Infrastructure: stay all-GitHub (lessons 87–89)

The migration chapters are vocabulary, not a plan. Every slot keeps its
GitHub answer, and the factory vocabulary they introduced lives in
`GLOSSARY.md`:

| Slot | Answer |
| --- | --- |
| Ticket Tracker | GitHub Issues |
| Git Host | GitHub |
| Runner + Orchestrator | GitHub Actions — loops are `schedule:` cron, events are labels and comments, run errors are the failure comment + `agent:blocked` |
| Observability Platform | manual `/retro` (`docs/agents/retro.md`), still P2 |

### Pipeline files are ours

The "verbatim port, verify against upstream" constraint is removed
entirely. `.github/workflows/` and `.sandcastle/agent-workflows/` evolve by
our own decisions; a substantial behavior change is documented in
`docs/adr/`, which is what this ADR and 0014 before it already are.
`AGENTS.md` and the README carry the policy; the README's old deviations
list became history/attribution.

### Adopted now

- **Auto-Rebase janitor** (lessons 95–96, adapted). A new workflow fires on
  `pull_request.closed` with `merged: true` (plus a nightly cron backup):
  find open PRs whose head branch matches `agent/issue-*` with a
  CONFLICTING mergeable state, then label them `agent:update-branch` —
  **with `AGENT_PAT`**, because labels set by `GITHUB_TOKEN` never fire
  other workflows (the same reason `agent-convert.yml` uses the PAT).
  Gate: **Agent-quiet** — if any `agent-implement` / `agent-review` /
  `agent-update-branch` / `agent-convert` run is in progress (`gh run list
  --status in-progress`), exit silently; the next trigger retries.
  `agent-update-branch.yml` keeps doing the actual resolving. The course's
  deterministic script-rebase is deliberately **not** taken: it would
  duplicate update-branch's lease/race logic.
- **Improve-architecture on demand** (lessons 91–92). A `workflow_dispatch`
  workflow with an optional `focus` input. The runner runs the vendored
  `/improve-codebase-architecture` skill, dedupes candidates against open
  `improvement`-labelled issues, and creates **≤ 5** issues per run, each
  labelled `improvement` (via `AGENT_PAT`). Improvements always wait for
  human review before entering the pipeline — no automatic
  `agent:explore` — and there is no schedule at all: the button is the
  only trigger.

### Adopted as target design (staged, not built yet): Implement Spec v2

Target = course design two (lesson 102, one runner per ticket):

1. Label `agent:implement` on a Spec. No tickets → the to-tickets runner
   creates them; tickets → straight on.
2. An exploration runner saves markdown notes on a branch and posts an
   exploration comment on the Spec pointing at them.
3. The frontier is computed deterministically from the tickets'
   `blocked_by` edges (the existing `agent-convert.yml` machinery).
4. One implement runner per frontier ticket pushes a branch **without**
   opening a PR.
5. A merger runner — the wave barrier: once all of the wave's tickets are
   complete — merges the branches into the Spec's Integration Branch,
   resolves conflicts there, and **closes the tickets**; their close events
   re-fire `agent-convert`, which computes the next frontier wave.
6. Loop until every ticket is closed, then one code-review pass on the
   Integration Branch, then **one PR** Spec → `main` through the existing
   auto-merge gate (ADR 0011 + 0014).

Four deltas vs the course diagram, recorded here so nobody "fixes" them
back:

1. The implement preflight **routes by issue shape** (Spec vs Ticket)
   instead of refusing a Spec outright — the refusal existed only because
   implement-spec did not exist yet.
2. Tickets are closed **by the merger**, not by the implement runner
   (closing is what fires the next wave, so it belongs at the barrier).
3. The merger is a **wave barrier**, not the course's continuous merging.
4. The diagram ends at review; the final **PR step** comes from the lesson
   text — one PR per Spec, not per ticket.

**To-tickets is full AFK** (lesson 102, course-faithful — no human
checkpoint): created tickets immediately get `ready-for-agent` via
`AGENT_PAT`, so the converter cascade starts; a list-comment on the Spec
enables async audit. The brakes are labels and closing tickets.

### Division of labor (Part One, lessons 40 + 82)

Implement = "make it work"; standards are applied **only** by the
code-review pass. Therefore the implement prompt carries no
self-check/standards line (lesson 82 rejected implement-prompt lines as
too noisy) and no `.sandcastle/CODING_STANDARDS.md` in its CONTEXT section
(`GLOSSARY.md` and `docs/adr/` stay — domain, not style). The review keeps
the standards.

### Standards bootstrap: one bulk harvest

The review verdicts already capture the raw material — each ends with
"Rules this review wanted and could not find" (ADR 0014). The bootstrap is
a one-time bulk harvest over the existing PRs' verdicts (#48–#50 are good
samples): dedupe, sort mechanical findings → checks (`oxlint`, the layers
test) and judgment calls → standards, and rewrite
`.sandcastle/CODING_STANDARDS.md` for robostudio — lean and judgment-only
(lessons 59–60). The upstream Effect/sandbox content it carried is
irrelevant here (no Effect in deps). Ongoing growth stays with the
human-invoked batch `/retro` (`docs/agents/retro.md`, unchanged).

### Deferred and skipped (with return conditions)

- **Prototyping** (lessons 99–100) — deferred. Return when a second
  stakeholder appears or a visual UI-iteration need shows up. When built:
  the screenshot variant, via `scripts/evidence-screenshot.mjs`, no
  deploy.
- **The Ratchet** (lessons 93–94) — deferred: no strict/graduated rule
  anchor exists yet (no `lint:strict` vs `lint:all` split to ratchet).
- **Slow-Query Monitor** (lessons 97–98) — skipped: no external alert
  source exists. The lesson's **push → pull** pattern (queue outside
  events, pull them on a schedule) is remembered for future tasks such as
  CI failure monitoring.

## Stage 2 mechanics (as built)

The target design needed decisions the course diagram does not settle on a
GitHub-Actions orchestrator. They are recorded here because they are the
surprising parts:

- **v2 mode is a shape, not a label**: an issue with a parent Spec ships
  without a PR (branch only — the merger takes it); a standalone issue
  keeps the classic per-issue PR chain. No mode flag exists to forget.
- **Ticketless Specs need a marker**: an issue without sub-issues is
  indistinguishable from a standalone Ticket, so a Spec awaiting
  decomposition carries the `spec` label (the `wayfinder:map` precedent).
  `agent:implement` on a `spec`-marked issue runs to-tickets; once tickets
  exist, sub-issues are the shape and the marker becomes redundant. The
  title is the safety net: a ticketless issue titled `Spec: …` routes to
  to-tickets even when the marker was forgotten (case-insensitive; the
  marker stays canonical) — added after a real mis-route implemented a
  whole Spec as a standalone Ticket.
- **Branch conventions**: notes `agent/spec-<n>-notes`, integration
  `agent/spec-<n>-integration`, tickets unchanged (`agent/issue-<n>-<slug>`).
- **Merger triggers**: a push to any `agent/issue-*` branch is the pulse
  (each implement completion may complete a wave), plus a manual
  `workflow_dispatch` accelerator. All merger runs serialize repo-wide —
  one concurrency group — because the barrier and the integration branch
  are per-Spec, and per-Spec groups would race on the same pushes.
- **Closing Tickets is workflow work, not agent work** (delta №2 made
  literal): the merger agent merges and keeps the tree sound; the script
  pushes the integration branch and closes the Tickets deterministically.
  Close events re-fire the converter — the next wave.
- **The integration PR is found by the existing chain**: the merger opens
  ONE draft PR Spec → main with `Closes #<spec>` and labels it
  `agent:review` (via `AGENT_PAT`), so the review pass and the auto-merge
  gate (ADR 0011 + 0014) run unchanged — the "single review pass" is that
  chain on the integration branch.
- **The agent concurrency is a plan constraint, not a runtime queue**: the
  provider plan allows ~3 simultaneous agent runs (a 4th and 5th died at
  start on the first real to-tickets run), and the key is shared with the
  operator's local sessions. to-tickets validates the plan's widest wave
  against `AGENT_CONCURRENCY` and the rejection feeds back to the agent,
  which staggers Tickets with blockedBy edges. A runtime slot gate in the
  implement preflight is the return condition when Specs start overlapping.

## Build order

Approved sequence; items 4–7 of the session plan wait for the operator's
explicit «строим»:

1. Docs (this ADR, AGENTS.md policy, README history/attribution) — done
   with this ADR.
2. Standards harvest (the bulk rewrite of `CODING_STANDARDS.md`).
3. Two diagnosed bug fixes: evidence links in PR bodies, and the
   `gh issue view` call that fills `/tmp/review-spec.md`.
4. Auto-Rebase janitor.
5. Improve-architecture button.
6. Stage 1: to-tickets routing in the implement preflight + to-tickets
   runner + exploration-notes runner; tickets keep flowing through the
   existing per-ticket chain (PR + review + auto-merge).
7. Stage 2 (v2 core): implement-without-PR, merger runner, single final
   review.

## Considered options

- **Script-rebase in the janitor** (course's deterministic-first rebase) —
  rejected: `agent-update-branch.yml` already owns conflict resolution with
  lease/race protection; a second resolver would race it.
- **Design one, one runner per frontier** (lesson 102) — rejected: needs a
  runner powerful enough to build every frontier ticket at once; design
  two's per-ticket runners match the per-ticket workflows we already have.
- **Human checkpoint between to-tickets and implementation** — rejected:
  the course runs to-tickets full AFK; the brakes (labels, closing
  tickets) are the intervention points.
- **Scheduled improve-architecture loop** (course: once a day) — reduced to
  an on-demand button: one operator, so a daily loop would only pile up
  `improvement` tickets nobody reviews.
