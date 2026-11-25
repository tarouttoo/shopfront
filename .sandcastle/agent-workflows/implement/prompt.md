# TASK

Implement issue #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}

You are on branch `{{BRANCH}}`, already created from `main`.

# ISSUE

{{ISSUE_CONTEXT}}

# PARENT SPEC

{{PARENT_CONTEXT}}

If a parent spec is shown above, it is background: it explains why this
Ticket exists and what it is part of. Implement only issue #{{ISSUE_NUMBER}}
— never the spec itself or its other Tickets.

# EXPLORATION NOTES

{{NOTES}}

If a branch name is shown above, the Spec's exploration notes live on it:
run `git fetch origin <branch>` and read the notes in `notes/` — they are
the shared context for this Spec's Tickets (approach, decisions, files,
pitfalls). They may be missing or stale: your own reading of the repo and
the issue wins. If no branch is named, work from the issue and the spec
alone.

# CONTEXT

Read the project's domain and architecture docs before changing code:

- `GLOSSARY.md`
- `docs/adr/` if relevant

Coding standards are deliberately not listed here: making it work is the
implement pass's whole job — the review pass applies the standards
(ADR 0019, course lessons 40 + 82).

Explore the repo and relevant tests before editing.

# EXECUTION

Where a test seam already exists, or a new one is being proposed, do red-green-refactor:

1. RED: write a failing test
2. GREEN: implement the smallest correct change
3. REPEAT until the issue is done
4. REFACTOR

Do not improvise new test seams, such as extracting out a function so that it can be tested in isolation. This creates spaghetti tests.

Run `npm run typecheck` before committing. Run focused tests where relevant.

# COMMIT

Make one or more commits on `{{BRANCH}}` with conventional commit messages.
Finish with at least one commit and a clean working tree. The workflow
pushes and opens the pull request.

Do not push the branch.
Do not close the issue.
Do not edit labels.
Do not create or edit PRs.

# EVIDENCE

If the repo ships `scripts/evidence-screenshot.mjs` (the Electron-app
convention this factory grew up in), capture a before and an after
screenshot with it as PNGs in `/tmp/evidence/`: the branch matches `main`
before you edit, so the before state is real. Build (`npm run build`),
then capture

    npx electron --no-sandbox scripts/evidence-screenshot.mjs /tmp/evidence/before.png

Implement, build again, and capture the after state to
`/tmp/evidence/after.png`.

If the repo has no such script (a static web build with no app window),
do not invent one and do not commit screenshot tooling: evidence is the
commands you ran and their output. The workflow uploads `/tmp/evidence/`
as an artifact when present. A human cannot open a local path from your
text, so reference the evidence by linking the run page,
`$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID` —
never by writing a bare `/tmp/...` path.

# PR BODY

After the final commit, write the pull request body to `{{PR_BODY_PATH}}`:

1. Read `.agents/skills/pr/SKILL.md` and follow it.
2. Start the body with `Closes #{{ISSUE_NUMBER}}`, then the skill's
   Summary, Evidence, and Merge Danger sections. In Evidence, link the
   workflow run page
   (`$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`)
   where the `/tmp/evidence/` artifacts live — a local path renders as
   dead text on GitHub.
3. End with exactly this line:

   Body drafted by the implement agent; audited by the review pass.

Evidence must come from commands you actually ran in this checkout. Do not
commit the body file; the workflow opens the PR from it.

When complete, output `<promise>COMPLETE</promise>`.
