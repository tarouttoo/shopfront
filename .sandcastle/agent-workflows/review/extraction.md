Emit a single `<output>` block as the last thing in your response.

Do not change files.
Do not run commands.
Do not include text outside the `<output>` block.

```json
<output>
{
  "summary": "1-3 paragraphs summarizing the review: what you fixed, one line of reasoning per axis (Standards, Spec), and what you left for the human. End with a section titled 'Rules this review wanted and could not find' — a bullet list of rules you wanted to apply but could not find in the standards ('None.' when empty). Do not repeat inline comments here.",
  "inlineComments": [
    { "path": "relative/file.ts", "line": 123, "body": "Markdown comment" }
  ],
  "replies": [
    { "commentId": "GraphQL node id from PR_COMMENTS_JSON", "body": "Markdown reply" }
  ]
}
</output>
```

Use empty arrays when there are no inline comments or replies.
