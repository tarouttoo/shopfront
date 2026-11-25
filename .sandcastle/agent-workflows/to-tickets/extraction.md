Your whole reply is one `<output>` block, written straight from the planning you have already done:

```json
<output>
{
  "tickets": [
    {
      "title": "Imperative short title for one coherent change",
      "body": "Self-contained markdown: what to build, acceptance criteria, files/tests it concerns. A separate agent implements this without any other context.",
      "blockedBy": []
    },
    {
      "title": "Next Ticket, depending on the first",
      "body": "Self-contained markdown.",
      "blockedBy": [0]
    }
  ]
}
</output>
```

The workflow rejects the whole plan unless:

- There is at least one ticket.
- Every ticket has a non-empty `title` and `body`.
- `blockedBy` contains only 0-based indices of other tickets in this list — no self-references, no cycles.
