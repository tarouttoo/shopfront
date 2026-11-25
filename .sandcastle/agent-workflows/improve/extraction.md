Your whole reply is one `<output>` block, written straight from the exploration you have already done:

```json
<output>
{
  "candidates": [
    {
      "title": "Deepen the Generation module's outcome interface",
      "problem": "Why the current architecture is causing friction, in plain English.",
      "solution": "What would change, in plain English.",
      "benefits": "Locality and leverage gains, and how tests improve.",
      "files": ["src/ui/generation.ts", "src/export/pipeline.ts"],
      "strength": "strong | worth-exploring | speculative",
      "contradictsAdr": null
    }
  ]
}
</output>
```

The workflow rejects the whole plan unless:

- Every candidate has a non-empty `title`, `problem`, `solution` and `benefits`.
- `files` is a list of repo paths that exist.
- `strength` is one of the three values above.
- `contradictsAdr` is `null` or an ADR reference like "ADR 0007" the candidate reopens.
- There are at most 5 candidates. Use `{"candidates": []}` when nothing is worth deepening.
