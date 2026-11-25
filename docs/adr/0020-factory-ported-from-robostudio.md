# The agent factory is ported from robostudio

This repo starts as a website project and inherits its build pipeline —
the label-driven agent factory — wholesale from `robostudio`, where it
grew out of `agent-pipeline-template` (a port of mattpocock/sandcastle
running the pi CLI) and evolved through robostudio's own ADRs. Building
the factory from scratch here would re-earn lessons robostudio already
paid for; keeping it in sync by hand across two repos is exactly the
duplication the factory exists to avoid. So: **a verbatim port**, with
this repo free to diverge later by its own ADRs (the robostudio ADR 0019
clause "pipeline files are ours" transfers with the port).

## What was ported, verbatim

- `.sandcastle/agent-workflows/` — all packages (convert, explore,
  implement, implement-pr, improve, merge-spec, rebase-janitor, review,
  spec-explore, to-tickets, update-branch, shared) plus
  `.sandcastle/CODING_STANDARDS.md`.
- `.github/workflows/agent-*.yml` — all nine factory workflows. `ci.yml`
  and `release.yml` were **not** ported: they are robostudio-product
  (Electron, tags, electron-builder); this repo grew its own.
- `.agents/skills/` — code-review, pr, triage-repro,
  improve-codebase-architecture.
- `docs/agents/` — all six documents, including the issue-tracker doc
  with its **Wayfinding operations** section (the `/wayfinder` skill
  depends on it).
- Factory ADRs, **kept under their original robostudio numbers**:
  `0001` (agent-drafted PR bodies), `0002` (child-of-spec tickets),
  `0010` (ready-for-agent converter), `0011` (auto-merge after clean
  review), `0014` (align factory, part one), `0019` (adopt factory,
  part two).

## Why the numbering gaps

Numbers `0003–0009` and `0012–0013` and `0015–0018` are empty here:
those robostudio ADRs are product decisions (Electron layering, CNC arc
conventions, robot kinematics) that this repo did not inherit. Renumbering
the ported set densely was rejected on purpose: factory files carry
references to specific ADR paths, and
`.sandcastle/agent-workflows/convert/docs.test.ts` pins the literal file
path `docs/adr/0010-ready-for-agent-converter.md` with a test — renaming
would break a verbatim port to satisfy cosmetics. New decisions made in
this repo continue from `0020` upward, without regard to the gaps.

## Set up fresh here

- `AGENTS.md`, `GLOSSARY.md`, `README.md` — written for this repo.
- `.github/workflows/ci.yml` — typecheck + tests + lint + build for the
  Astro site.
- `.github/workflows/deploy.yml` — GitHub Pages deployment (the preview
  surface the factory's PRs update).
- Required secrets: `AGENT_PAT` and `ZAI_API_KEY`, same meaning as in
  robostudio (the PAT cascade and the model provider).

## Consequences

- The codename rule: until the client approves the project publicly, the
  client's real name and brand names appear nowhere in this repo — code,
  docs, or issues. This is a public repository; the factory's issues and
  PRs are readable by anyone.
- Factory behavior questions resolve to the ported ADRs first, robostudio
  second, upstream sandcastle third.
