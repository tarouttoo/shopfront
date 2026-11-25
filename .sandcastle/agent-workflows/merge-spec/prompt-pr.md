# TASK

The Spec #{{SPEC_NUMBER}} is fully implemented: every Ticket is merged and
closed, and the work sits on the integration branch `{{INTEGRATION_BRANCH}}`.
Draft the pull request body that takes it to `main`.

# CONTEXT

- Spec:

{{SPEC_CONTEXT}}

- The integration branch's commits since main:

{{COMMIT_LOG}}

# PR BODY

Write the body to `{{PR_BODY_PATH}}`:

1. Read `.agents/skills/pr/SKILL.md` and follow it.
2. Start the body with `Closes #{{SPEC_NUMBER}}`, then the skill's
   Summary, Evidence, and Merge Danger sections.
3. Evidence here is execution-based: the suite has run on the merged tree;
   show the counts and command output you have. Do not capture UI
   screenshots (this runner has no display). Reference the run page,
   `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`,
   never a local `/tmp/...` path.
4. End with exactly this line:

   Body drafted by the merger agent; audited by the review pass.

Evidence must come from commands you actually ran in this checkout. Do not
commit the body file; the workflow opens the PR from it.

When complete, output `<promise>COMPLETE</promise>`.
