# TASK

Implement Ticket #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}

You are on branch `{{BRANCH}}`, already created from `main`.

# TICKET

{{ISSUE_CONTEXT}}

# PARENT SPEC

{{PARENT_CONTEXT}}

If a parent spec is shown above, it is background: it explains why this
Ticket exists and what it is part of. Implement only Ticket
#{{ISSUE_NUMBER}} — never the spec itself or its other Tickets.

# EXPLORATION NOTES

{{NOTES}}

If a branch name is shown above, the Spec's exploration notes live on it:
run `git fetch origin <branch>` and read the notes in `notes/` — they are
the shared context for this Spec's Tickets (approach, decisions, files,
pitfalls). They may be missing or stale: your own reading of the repo and
the issue wins. If no branch is named, work from the ticket and the spec
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
pushes your branch; a separate merger run integrates it with the other
Tickets of the Spec — your work is judged there, and a single review pass
covers the whole Spec at the end (ADR 0019).

Do not push the branch.
Do not close the issue — closing Tickets is the merger's job.
Do not create or edit PRs: Spec Tickets ship without one.
Do not edit labels.

# EVIDENCE

When the change shows in the UI, save a before and an after screenshot as
PNGs in `/tmp/evidence/`. The branch matches `main` before you edit, so the
before state is real: build the app (`npm run build`), then capture

    npx electron --no-sandbox scripts/evidence-screenshot.mjs /tmp/evidence/before.png

Implement, build again, and capture the after state to
`/tmp/evidence/after.png`. The workflow runs under a virtual display (xvfb)
and uploads `/tmp/evidence/` as an artifact. The PNGs live only in that
artifact: a human cannot open a local path from your text, so reference
the evidence by linking the run page,
`$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID` —
never by writing a bare `/tmp/...` path.

When complete, output `<promise>COMPLETE</promise>`.
