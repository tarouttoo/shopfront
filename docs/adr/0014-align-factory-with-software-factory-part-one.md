# Align the factory with Software Factory Part One

The pipeline is a port of `agent-pipeline-template` (sandcastle
@ `a53e227`), but the course section it was ported from — Software Factory
Part One, lessons 73–86 — teaches features the pinned port predates. A
grilling session (rounds Q1–Q16) settled which of them land here. We
verified the course repo's *current* state against
[mattpocock/sandcastle](https://github.com/mattpocock/sandcastle) `main`
first: upstream itself has since moved away from several mechanics shown in
the videos (the workflow `agent-implement-spec.yml` is gone; the review
prompt is inline-conservative, not skill-invoking; the explore prompt's
untrusted-content framing and the rich review output
`{summary, inlineComments, replies}` — which this repo already ports
verbatim — are upstream's *current* text). So what follows is partly a
deliberate divergence **ahead of** upstream, documented here and in the
README deviations.

## Design

- **Retro loop (human-invoked), with the capture point in the review.** The
  review summary must end with a "Rules this review wanted and could not
  find" section (`review/extraction.md`); harvesting it — and reading run
  logs for inefficiencies — is the manual `/retro` skill, documented in
  `docs/agents/retro.md`. No retro workflow, no per-ticket retro: the
  course runs it by hand against Actions run URLs, on demand or in batches.
  A dedicated checks layer (pre-commit hooks, boundary linters) is **not**
  built now; checks earn their place through retros, which sort mechanical
  findings into checks and judgment calls into `CODING_STANDARDS.md`.
- **Evidence screenshots.** The implement and review prompts ask for
  before/after PNGs in `/tmp/evidence/` whenever the change shows in the
  UI (the course line, verbatim); both workflows install `xvfb` and upload
  the folder as an artifact. The capture mechanism is
  `scripts/evidence-screenshot.mjs`: `xvfb-run` + Electron `capturePage`,
  no new npm dependencies (chosen over Playwright and agent-browser-over-CDP
  — both need xvfb anyway, and both add heavy or fragile moving parts).
  Explore stays code-only: its job is claim-checking against the repo, and
  UI driving there would burn tokens on every batch.
- **Skill-driven, aggressive review.** `review/prompt.md` invokes the
  vendored `code-review` skill (`.agents/skills/code-review/`, MIT, Matt
  Pocock's skills pack; taken from the course's project repo
  `ai-hero-dev/cohort-005-project`, whose copy adds "start every sub-agent
  with a fresh context window" over the globally installed one) with the
  course contract — fixed point
  `origin/{{BASE_REF}}`, spec `/tmp/review-spec.md` (written by `review.ts`
  from the linked issue), standards — and the course's "leave the human
  reviewer as little as possible: fix every finding you can, commit each
  fix" instead of upstream's "single conventional commit / make no commit
  if clean". Workflow mechanics stay ours: the extracted output
  (`summary + inlineComments + replies`), review posting, thread replies,
  and the PR-body audit (which now must verify the declared door, see
  below). This diverges from current upstream's inline prompt on purpose.
- **Auto-merge gate requires a two-way door.** The course's merge criteria
  (two-way door, small blast radius, no migrations) meet ADR 0011's
  structural gate as follows: a clean review plus green CI plus a body that
  declares `**Door:** two-way` requests auto-merge; anything else holds the
  merge loudly. Blast radius and migrations stay prose: they cannot be
  parsed reliably, so the review's body audit verifies them and a "simplest
  stable criteria" stance (the maintainer's words) keeps the machine-checked
  part to one boolean. This partially amends ADR 0011; that ADR's token and
  hold-on-failure reasoning is unchanged.
- **Kept as-is, against the older course videos.** The `ready-for-human`
  label (not the videos' `needs-a-human` — renaming would churn every
  workflow for zero behavior); the rich review output (matches current
  upstream; the videos' `comments[]`-only schema is the older iteration);
  the explore prompt's untrusted-content framing (current upstream text,
  stronger than the videos' `BEWARE` line); no in-app feedback button (a
  product feature that would point public spam straight at paid agent
  runs); the sub-issues + `ready-for-agent` converter stack in place of the
  videos' `agent-implement-spec.yml` queue (upstream deleted that queue;
  see the trajectory below).

## Trajectory to Part Two orchestration

The end goal is Part Two's full Implement Spec orchestration (lessons
101–102). Nothing below is built now; the mapping records that today's
pieces are the orchestrator's future modules, so the transition reuses the
foundation instead of re-plumbing it.

| Today | Role in the Part Two orchestrator |
| --- | --- |
| Sub-issues Spec → Tickets with native `blocked_by` edges | The task graph; the frontier is computed deterministically from the edges |
| `agent-convert.yml` (labels Tickets as blockers clear) | Frontier computation + runner trigger |
| `agent:implement` → one workflow run per Ticket | Design two, "one runner per ticket" — the course's preferred variant |
| Tracker-as-communication (labels, comments) | The same principle, unchanged |
| `PARENT_CONTEXT` (spec text injected per Ticket) | Replaced later by an exploration runner saving markdown notes on a branch |
| PR per Ticket, review per PR | Later: integration branch per Spec, merger runners, one review at the end |

## Considered options

- **Re-port newer upstream wholesale** — rejected: it would drag in
  upstream's *reversals* (conservative review prompt, no capture section,
  no screenshots), destroying the course alignment this ADR records, and
  risk the documented deviations (zai agent, converter).
- **Bake the course axes into the existing inline review prompt** —
  rejected by the maintainer ("полностью берём из курса"): the skill-driven
  prompt is what the course teaches, the skill is already proven in CI by
  the course repo, and the divergence is documented.
- **Run retro per ticket / as a workflow** — rejected: double cost and PR
  storm; the capture section already records per-PR material.
- **Machine-parse blast radius and migrations in the merge gate** —
  rejected: unparseable prose invites brittle allowlists; the review's body
  audit covers it.
