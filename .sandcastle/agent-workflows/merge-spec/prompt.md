# TASK

Merge the completed Tickets of Spec #{{SPEC_NUMBER}} into the integration
branch and keep the tree sound. You are the merger run of the software
factory (ADR 0019): the Tickets listed below are implemented — their
branches exist on the remote — and you combine them.

# INTEGRATION BRANCH

`{{INTEGRATION_BRANCH}}`

{{INTEGRATION_STATE_LINE}}

# TICKETS TO MERGE

Each entry: issue number, its branch, and the ticket text for intent.

{{TICKETS_CONTEXT}}

# HOW

1. `git fetch origin` first.
2. Check out the integration branch:
   - it exists on the remote: `git checkout -B {{INTEGRATION_BRANCH}} origin/{{INTEGRATION_BRANCH}}`
   - it does not: `git checkout -B {{INTEGRATION_BRANCH}} origin/main`
3. For each ticket branch, in the listed order:
   `git merge --no-ff origin/<branch> -m "merge: <ticket title> (#<issue>)"`.
   Never abort a merge. Resolve conflicts there, in the integration
   branch: understand both sides (`git log -p` on each), prefer the
   ticket's new behavior unless main carries a later fix the ticket lacks.
4. When all merges are in, run `npm run typecheck && npm test`. If red,
   fix forward on the integration branch — semantic conflicts across
   tickets are yours to settle, with conventional commits.
5. Finish with a clean working tree.

The merger closes nothing and touches no labels: after your run
succeeds, the workflow pushes the integration branch and closes the
Tickets (their close events drive the next wave).

Do not push.
Do not run `gh`.
Do not create issues or PRs.

When complete, output `<promise>COMPLETE</promise>`.
