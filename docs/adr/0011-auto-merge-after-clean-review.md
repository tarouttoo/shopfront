# Auto-merge after a clean review (the last human click, automated)

After `agent:review` succeeded the PR sat ready and untouched: the review
posted as a regular review (the payload has no verdict field, so nothing ever
"approved" formally) and the merge happened only when the maintainer clicked
merge. ADR 0010 removed the human from the label loop; the merge click was the
one manual step left in the happy path (ticket → `agent:implement` → draft PR
→ `agent:review` → *human*). This ADR removes it.

## Design

- **Clean review = zero inline comments.** The extracted review payload
  (`review_payload.json`, contract in
  `.sandcastle/agent-workflows/review/extraction.md`) has no verdict field, so
  "clean" is defined structurally: `inlineComments` is empty. The review step
  already fails the run on errors, so anything that reaches this step posted
  findings successfully.
- **Clean → request squash auto-merge.** A new step after "Mark PR ready"
  runs `gh pr merge --squash --auto --delete-branch`. The repo's
  `allow_auto_merge` setting is the feature's activation switch and kill
  switch, same reasoning as the tenderagent gate's hold conditions.
- **The request rides AGENT_PAT, falling back to GITHUB_TOKEN** (same pattern
  as implement's label step). Two reasons: a GITHUB_TOKEN-authored PR refuses
  an auto-merge request from its own GITHUB_TOKEN, and the PAT keeps the
  eventual merge attributed to the maintainer rather than
  `github-actions[bot]`. If both tokens fail the step fails into the standard
  blocked path — a merge request that silently didn't happen would be worse.
- **Findings hold loudly.** Non-empty `inlineComments` posts one comment with
  the count and the retry loop (`agent:implement-pr`, then re-add
  `agent:review`) and exits 0: a held PR is a legitimate outcome, not a
  workflow failure.

## What is deliberately not done

- **CI gate, verified in-workflow.** Before requesting the merge the step
  runs its own poll of the check-runs API instead of `gh pr checks`, for
  two live-found reasons: `gh pr checks` includes the review run's own
  check — which cannot complete before the gate does, a circular wait — and
  it answers "no checks reported" in the seconds between the review's
  self-fix push and the new head's checks registering. The gate waits on
  every check that is not this pipeline's (agent workflow checks are all
  named "Agent …") to complete green, holds fast on any red conclusion, and
  times out into a hold with a comment naming the retry (re-add
  `agent:review`) when checks never appear. The workflow verifies CI itself instead of assuming branch
  protection, because the auto-merge request rides a maintainer PAT whose
  bypass permissions would defeat protection anyway — the same stance as the
  tenderagent merge gate's `ci_green` condition. A repo with no CI at all
  would hold (`gh pr checks` fails with no checks reported); robostudio runs
  `ci.yml` on every PR, so this is moot here.
- **The windows CI leg runs app tests only.** The pipeline suites
  (`.sandcastle`) stub `gh` with POSIX bash scripts and spawn tsx via POSIX
  paths; the agent workflows they exercise only ever run on ubuntu GitHub
  runners, so windows CI runs `npm run test:app` (`--exclude
  ".sandcastle/**"`) instead of failing on the harness (which is what
  happened since the converter port — the converter's tests were the reason
  windows CI was red on main when this ADR landed). Branch protection
  requiring `ci.yml` checks remains the recommended hardening; it is not
  enabled together with this change so the gate semantics stay in one place.
- **No tenderagent-style merge gate.** Upstream's deterministic gate
  (review verdict, door cross-check, denylist, changed-line ceiling, blocker
  check) needs the richer verdict payload and the REVIEW_PAT review identity;
  robostudio runs the simpler template review. This is the minimal automation
  for the simpler pipeline; porting the gate stays an option if the repo
  grows riskier changes (its denylist would cover `.github/`,
  `.sandcastle/`, lockfiles).

## Deviations

Upstream sandcastle's template review workflow stops at "mark ready" and has
no merge step; tenderagent's merge gate is the richer sibling. This step is a
documented deviation of the simpler template variant.
