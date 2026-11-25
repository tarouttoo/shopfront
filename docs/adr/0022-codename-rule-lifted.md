# The codename rule is lifted

The operator has decided to publish the Client's real identity ahead of
any formal client sign-off: the public repo was judged unlikely to be
noticed, and the approved material (landing, texts, the real catalog of
5818 positions) loses its meaning under placeholders. ADR `0020`'s
codename rule is amended accordingly, and with it the until-approval
gates of ADR `0021`: the deployed site is public and indexable (the
`noindex` meta and the disallowing `robots.txt` go), and the catalog
carries real client, brand, and product names. The Client's identity
data lives in one place, `src/data/site.ts`, so an identity change
stays a one-place edit.

## Consequences

- Irreversible in practice: public git history, issues, and search
  indexing of the deployed site cannot be fully recalled.
- Issues, PRs, and commit messages may use the Client's real name.
- The placeholder-Products clause of ADR `0021` is superseded: real
  catalog data imports as-is.
