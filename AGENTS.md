# AGENTS.md

shopfront is a B2B shopfront — public catalog, cart, order request — for
ООО ИТЦ «Альтер Энерго», built as a static Astro site and evolved by
the agent factory ported from robostudio (ADR `0020`; the client's
identity is public since ADR `0022`). Humans and coding
agents edit both the product and the factory.

## Navigation

- **Naming or domain questions** — read `GLOSSARY.md` (domain glossary)
  first. UI text is Russian, code and docs are English; the glossary maps
  the two and forbids synonyms.
- **Changing pipeline behaviour** — check `docs/adr/` for prior
  decisions; add an ADR when making a non-obvious, hard-to-reverse
  choice. Factory behaviour resolves to the ported ADRs (`0001`, `0002`,
  `0010`, `0011`, `0014`, `0019`), repo decisions continue from `0020`.
- **Code style** — `.sandcastle/CODING_STANDARDS.md` holds the judgment
  rules the review pass applies; grow it only through Retro harvests
  (`docs/agents/retro.md`), never by casual edits.
- **Testing or evidence questions** — read `docs/agents/evidence.md`
  (content pins through the prerendered HTML, behavior pins through
  modules; no screenshot script in a static build).
- **Skill conventions** (triage labels, issue-tracker commands,
  domain-doc layout) — read `docs/agents/`; the triage-repro skill lives
  under `.agents/skills/triage-repro/`.
- **Product direction** (CMS, Order Request intake, catalog data source)
  — open wayfinder territory: chart it as a decision map before building
  (ADR `0021` records the deliberate non-decisions).

## Constraints

- **Client identity is public** — the Client is named in the repo and
  the deployed site is public and indexable (ADR `0022`, amending
  `0020`). Issues and PRs are readable by anyone, including the Client;
  write them accordingly.
- Non-trivial changes ride the pipeline: publish a Spec issue first,
  break it into child Tickets, and let the `agent:*` label flow implement
  and review them. Direct one-shot edits in the working tree are the
  exception — agree it with the operator before starting. Every change
  request is assessed for this each time, not assumed.
- The operator pushes every change to GitHub immediately and works from
  two computers, so `origin/main` can move between (or during) sessions.
  Always `git fetch` and rebase onto `origin/main` before starting work;
  don't trust remembered commit hashes — re-read the log.
- Pipeline files (`.sandcastle/agent-workflows/`, `.github/workflows/`)
  are ours to change: the verbatim-port constraint was removed by
  robostudio ADR 0019 and transfers with the port (ADR `0020`). Document
  substantial behavior changes in `docs/adr/`.
- Before finishing: `npm run typecheck` and `npm test` and
  `npm run build` must pass.

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI; external PRs are triaged as requests too.
See `docs/agents/issue-tracker.md` (includes the Wayfinding operations
section used by `/wayfinder`).

### Triage labels

Pipeline vocabulary: `agent:explore` → `agent:blocked` → `agent:implement`
→ `ready-for-human`; the `ready-for-agent` converter turns approved
Tickets into runs (ADR `0010`); `wontfix` is applied by closing. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See
`docs/agents/domain.md`.
