# An unfixed factory-breaking review finding holds the merge

PR #13's review verified live that the new agent-run preflight 403s for
GITHUB_TOKEN — «as merged, every implement run fails at minute 0» — and
could not fix it: `.github/` is off-limits to review edits (the review
prompt bars them). ADR 0011's auto-merge merged the PR anyway, ~80 s
after that verdict, because "clean" there is defined structurally —
zero inline comments in the extracted payload — and a break flagged in
the summary prose (or in a comment the diff-line filter dropped) reads
as clean. The hotfix (`8581f88`) landed post-merge from a live
session's working tree. The 2026-11-26 retro over PR #12's
neighborhood surfaced the gap; this ADR closes it (issue #19).

## Decision

**An unfixed factory-breaking review finding holds the merge.** When
the review flags a finding it cannot fix in scope, on `.github/**` or
`.sandcastle/agent-workflows/**`, whose effect is a deterministic break
of agent runs, the verdict holds auto-merge instead of flag-and-merge.
Product-side findings keep today's behavior.

Rationale: the factory is its own runtime — a merged factory-breaking
change damages every subsequent run (implement, review, merge alike),
which is strictly worse than a held PR. A held PR costs its Spec a
slot; a merged factory break costs every Spec until a human notices.

## Design

- **The review declares the hold.** Whether a finding deterministically
  breaks agent runs is a judgment over live context, not a parse over
  comment text — so the reviewing agent decides, and the verdict schema
  (`reviewOutputSchema`) carries a required `holds_merge` boolean. The
  extraction contract documents it; a missing or mistyped flag is a
  rejection, not a default (CODING_STANDARDS: at the agent-JSON
  boundary a required key's absence is a rejection) — a drifted key
  must not silently disarm the hold.
- **review.ts writes the gate's input.** The flag lands in
  `verdict.json` (`{ "holds_merge": … }`) next to the existing
  artifacts; the review payload posted to GitHub stays untouched, so
  the reviews API never sees pipeline fields.
- **The gate checks the flag before the comment count.** The ADR 0011
  step ("Request auto-merge on clean review") reads `verdict.json`
  first: `holds_merge: true` holds with a comment for the operator —
  not the `agent:implement-pr` retry loop, because the finding is by
  definition out of the loop's scope. A missing or unreadable
  `verdict.json` holds too, on the merger's barrier rule (an unreadable
  safety signal defaults to the conservative outcome). Product findings
  (`holds_merge: false`) flow into the existing checks unchanged:
  inline comments hold with the retry loop, a two-way door plus green
  CI merges.
- **Same gate, same kill switch.** No new step and no new workflow: the
  hold is one more branch of the ADR 0011 gate, still governed by the
  repo's `allow_auto_merge` setting and the operator's re-add
  `agent:review` retry.

## What is deliberately not done

- **No deterministic derivation in review.ts.** Mapping comment paths
  to "factory-breaking" with a path prefix plus a keyword scan would
  fire on refactors that merely touch `.sandcastle/**` and miss breaks
  whose diff lives elsewhere than the symptom (PR #13's break surfaced
  in a workflow file, but a data or secret break might not). The
  judgment stays with the agent that verified the break live; the gate
  only reads the flag.
- **No hold taxonomy or severity levels.** One boolean covers the one
  case the retro found. If a second hold shape appears (e.g. a
  product-side break too expensive to fix in scope), extend the verdict
  then — with its own retro finding.
- **ADR 0011 is not amended for product findings.** The structural
  clean definition (zero inline comments) stays for everything
  product-side; this ADR only adds a first check in front of it for
  factory breaks — a check the pipeline itself never overrides. The
  operator's manual merge click remains, as everywhere.
