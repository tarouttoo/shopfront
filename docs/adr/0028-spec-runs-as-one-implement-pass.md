# A Spec marked `agent:implement` runs as one implement pass

Amends ADR `0019` (delta №1's to-tickets route) and the per-Ticket
publishing that grew from ADRs `0002`/`0010`.

Publishing a Spec used to mean splitting it into child Tickets by hand
and letting each Ticket through the converter (`ready-for-agent` →
`agent:implement`, ADR `0010`) — separate runs, separate PRs, separate
reviews for slices of one decision. Decided (operator, 2026-11-26,
right after Spec #31 converged on this shape in practice): putting
`agent:implement` **on the Spec itself** starts one implement pass that
delivers the whole Spec. The run first records its plan as sub-issue
Tickets (created unlabeled, wired with blockers — the trace, never work
orders), implements all of it on one branch, closes Tickets as their
scope lands, and opens **one draft PR** whose `Closes` line closes the
Spec. One review pass then covers the whole Spec (ADR `0026`: the
director reviews the finished improvement), auto-merge per ADR
`0011`/`0023` unchanged.

## Consequences

- The shape step routes a Spec marked `agent:implement` to the
  implement pass with `SPEC_RUN=true` (new `prompt-spec.md`); the
  `to-tickets` route is retired from the workflow — decomposition is
  the run's first act, not a separate runner (`to-tickets.ts` stays in
  the repo for manual use). The exploration-notes route survives only
  for a non-Spec issue that carries sub-issues.
- Child Tickets of a Spec never carry `agent:*` labels and never go
  through the converter; `ready-for-agent` remains for standalone
  requests only (ADR `0010` unchanged for them).
- Evidence from Spec #31: one implement run covered both Tickets on one
  branch, PR #35 got one 18-minute review, and the whole Spec merged
  clean — the shape the factory had already converged to.
