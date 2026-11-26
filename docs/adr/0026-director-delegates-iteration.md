# The director reviews finished improvements; the operator iterates without pre-approval

The re-approval gate treated the approved source (`reference/project-B/`) as
the only sanctioned copy: every visible string the port adapted was listed
«before → after» on the spec issue (#4) and waited for the director's pass.
The 2026-11-26 re-approval closed the last three items (the privacy §4.2
Web3Forms claim, the nav omissions, the «Каталог» drop) — and with them the
director changed the working mode: the project is handed to the operator,
who ships improvements without per-change pre-approval; the director reviews
**finished** features and improvements (accept / reject), not drafts.

## Design

- **Post-hoc review replaces per-change pre-approval.** Improvements land
  on `main` by the normal pipeline (ticket → implement → review →
  auto-merge); the director sees finished work on the deployed site with a
  short change summary, and a rejected improvement is reverted like any
  other two-way change (ADR `0014`'s door).
- **Adapted-source strings keep their trail.** The changed-string lists on
  #4 remain the audit record for adaptations of approved texts (the
  re-approval pass is what caught the §4.2 Web3Forms claim — a verbatim
  sentence the T5 report had missed, flagged onto the list by the PR #12
  review). New improvements are
  operator-authored from the start — their review is the pipeline's, plus
  the director's post-hoc pass.
- **Deliberately undecided product questions become operator-decidable** —
  Order Request intake and the CMS (ADR `0021`'s deliberate non-decisions),
  joined by the catalog data source that same ADR pins to JSON in the repo
  — under the same post-hoc review and still via wayfinder:
  a decision map before building.

## Considered options

- **Keep per-change pre-approval** — rejected: it bottlenecked one-word
  changes (the §4.2 sentence waited for a pass although the wording was
  already agreed), and the director explicitly lifted the gate.
- **Fully autonomous shipping with no director contact** — rejected: the
  director keeps accept/reject over finished work; visible copy and
  direction changes still surface to him, just after landing instead of
  before.

## Consequences

Improvements reach the public site within one pipeline pass instead of a
review round-trip. The accepted risk: a rejected improvement is briefly
live — tolerable because the site is public anyway (ADR `0022`) and
everything ships as two-way doors. First planned use: the wayfinder
decision map for Order Request intake, after which privacy §4.2 gets its
promised re-validation against real intake.
