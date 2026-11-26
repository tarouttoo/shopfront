# Coding standards

Judgment rules the review pass (`.agents/skills/code-review/`) applies.
Mechanical rules are checks, not prose: `npm run lint` (oxlint) and the
content pins over the built output (`src/*.test.ts`) already carry
those. New rules
land only through a Retro harvest (`docs/agents/retro.md`), each traced to
a real finding — never by fiat.

## Exports earn their consumers

Export a member only when something outside the module uses it. An export
with no external consumer is surface area, not API — make it
module-private.

## Docs describe the code as it is after your change

When a commit changes behavior, update every comment, JSDoc line, and
contract header that described the old behavior in the same commit. A doc
claim about other modules ("the pipeline calls this") must be true and
checkable against the code. A contract header (byte formats, invariants —
see ADR 0006) is a reviewable claim pinned by a test, not prose. The rule
covers build and test configuration prose too: two config files describing
one mechanism must agree (retro 2026-11-26 — the `astro.config.mjs` outDir
comment contradicted `vitest.config.ts`'s `fileParallelism: false` through
PR #12's review).

## Optional parameters may not silently weaken a guarantee

If an optional argument switches into a degraded mode (e.g. weaker
validation), the degradation is stated at the signature, and every
production caller passes the argument. Tests cover both modes.

## No silent fallbacks for invariants TypeScript cannot see

When the compiler cannot prove an invariant the code "knows", restructure
so it can — extract a helper returning a pair, let null checks compose —
instead of writing `?? 0`-style defaults that bury a broken assumption.
At untyped boundaries (JSON emitted by an agent, external API responses)
a required key's absence is a rejection, not a default: `record.key ??
fallback` there is the exact `?? 0`-shape this rule bans (retro
2026-11-25 — a drifted `blockedBy` key silently dropped a Spec's
blocking edges, Spec #59).

## Positional assertions start with presence assertions

An ordering or containment check that compares two `indexOf` results
asserts both markers exist before comparing. Compared raw, the check
passes vacuously once a marker vanishes — the comparison silently
degrades from "order" to "both -1" (retro 2026-11-25 — PR #2's
form-before-FAQ ordering assertion survived deleting the form heading;
fixed by the review pass, merged as `bda84fb`).

## Small honest duplication over coupling

Extract a shared helper across modules only when the code is pure and
identical in meaning. If sharing would create an import cycle or force one
module to know another's shape, duplicate the few lines instead.

## Islands receive IDs and params, never datasets

A `client:only` island's props are serialized into the prerendered HTML:
pass a dataset and every row ships to every visitor (retro 2026-11-26 —
the order page carried all 5818 Products as props, a 4.7 MB page; fixed
during PR #12's review, squashed into `f696a45`). Islands receive
IDs/params and fetch their data the way `fetchCategoryProducts` feeds
the cart drawer.

## Legal copy is re-validated against shipped behavior

When a change strips or stubs the behavior a user-facing sentence
describes, the sentence is flagged for re-approval in the same change —
not shipped as-is (retro 2026-11-26 — `/privacy` shipped «через сервис
Web3Forms» describing a submitter Spec #4 strips everywhere; reported on
#4, corrected when intake lands).

## Rejection strings are Russian glossary words beside their reducer

A user-facing rejection message is written where the rejection is produced
(the editor/canvas reducer), uses only GLOSSARY.md terms, and tells the
operator how to proceed. Extract a named constant only when two sites must
stay identical.

## Interaction logic is tested in the pure modules, not the rendered App

Interactive behavior gets unit tests on the pure modules (`src/lib/*` —
cart, checkout, catalog client); component and built-output tests stay
render-level. (Adapted from the robostudio "reducers" rule, 2026-11-26:
this repo has no editor canvas — the pure modules are the seam.)

---

Bootstrap harvest: the review verdicts of PRs #48–#50 ("Rules this review
wanted and could not find"), deduped — 2026-11-24. Mechanical candidates
from the same verdicts (e.g. a glossary-conformance check for UI strings)
are retro material for the checks layer, not rules here.

Retro harvest 2026-11-26: PR #12's review verdict ("Rules this review
wanted and could not find") and the parallel PR #2 retro handoff —
islands/params, legal copy, config-prose clarification; pruned the CAD
click rule, rewrote the reducers rule in shopfront vocabulary. Mechanical
candidates from the same verdicts (page-weight budget #16, dist build-once
#17) are tickets, not rules here.
