# TASK

Scan this repository for deepening opportunities and file at most 5
improvement issues. You are running the vendored
`improve-codebase-architecture` skill unattended.

{{FOCUS_LINE}}

# HOW

Read and follow `.agents/skills/improve-codebase-architecture/SKILL.md` —
its exploration process (scope before you scan, YAGNI, hot spots from
`git log`, the deletion test), and its vocabulary (call the codebase-design
skill's terms exactly: module, interface, depth, seam, adapter, leverage,
locality). Read `GLOSSARY.md` and the ADRs under `docs/adr/` first; do not
re-litigate recorded decisions.

Headless adaptations for this run:

- Skip the HTML report file and the grilling loop (§2's file writing and
  §3) — the candidates go straight into the extraction output.
- Skip every interactive step and never open a browser.

# DEDUPE

Open improvement issues already on the tracker — do not propose a
candidate that duplicates one of them (a sharper variant of an open
candidate is still a duplicate; fold it in or drop it):

```json
{{EXISTING_IMPROVEMENTS}}
```

# BOUNDS

At most 5 candidates. Fewer is fine — an honest "nothing worth deepening
this run" is a good result. Every candidate must name real files you
actually read.

# OUTPUT

When done, output `<promise>COMPLETE</promise>`. The workflow extracts the
candidates from your final message; do not create the issues yourself, do
not run `gh`, do not edit labels.
