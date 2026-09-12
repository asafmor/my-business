# Contributing

## Branch strategy

`main` is the single long-lived branch and must remain deployable. Create a
short-lived branch from the latest `main` for each issue, using names such as
`feat/12-document-upload` or `fix/34-upload-timeout`.

Keep each branch limited to one coherent change. Rebase or merge the latest
`main` before integration, require continuous integration to pass, and merge
through a reviewed pull request. Delete the short-lived branch after merging.
Use direct commits to `main` only for repository administration or when the
repository owner explicitly requests them.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`,
and `chore:`. Reference the GitHub issue in the pull request description and
close it when its definition of done is satisfied.

## Before opening a pull request

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```
