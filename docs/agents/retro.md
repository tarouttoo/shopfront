# Retro: improving the factory itself

The factory's runs are inputs to the factory's own improvement. When a run
(or a batch of runs) produces something off — a noisy verdict, a wasted
hour, a bug the reviewer should have caught — run a **Retro** on it and land
the fix as a normal PR to `main` (course section 06, lesson 82).

The `/retro` skill is installed globally (`~/.agents/skills/retro/`); this
page says how to point it at factory runs in this repo. Retro is
**human-invoked**: it never runs per ticket and is not part of the CI chain.
The per-ticket capture step is the review summary's
"Rules this review wanted and could not find" section
(`.sandcastle/agent-workflows/review/extraction.md`) — the retro is what
harvests it later.

## When to run one

- A review verdict or PR reads wrong: duplicated findings, missed fixes,
  useless evidence.
- The same struggle shows up in several runs: tools installed mid-session,
  setup steps re-derived from scratch.
- Periodically, over batches: "look at the last 10 implement runs / last 20
  review runs".

## How

1. Open the Actions tab and copy the run URLs —
   `https://github.com/<owner>/<repo>/actions/runs/<run-id>` — for the
   review run and the implement run behind the PR.
2. Invoke the skill with the URLs and your feedback:

   ```
   /retro <review-run-url> <implement-run-url> <what you did not like>
   ```

   The skill reads the run logs (`gh run view --log`), the PR, and the
   review summary, and proposes concrete factory improvements.
3. Sort the proposals the way the course does: **mechanical** findings
   become automated checks (lint rules, dependency rules, filesystem
   checks, workflow steps like a cached install); **judgment calls** become
   entries in `.sandcastle/CODING_STANDARDS.md`.
4. Land the improvements as a regular PR — normally a two-way door with a
   factory-only blast radius. Workflow changes only take effect once
   merged: workflows run from the default branch.

## What a retro may touch

- `.sandcastle/agent-workflows/**/prompt.md` and the workflow YAML steps.
- `.sandcastle/CODING_STANDARDS.md` (judgment calls only; mechanical rules
  become checks instead).
- New automated checks are built, not just written down — and tried on a
  throwaway file before the PR, like the course's retro does.

There is no dedicated checks layer in this repo yet (no pre-commit hooks,
no boundary linters); the retro loop is how checks earn their place rather
than arriving by fiat (ADR `0014`).
