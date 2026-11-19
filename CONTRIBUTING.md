# Contributing

Small fixes, tests, docs and new Markdown extensions are welcome. Open an issue first for anything bigger than a bug fix.
Security problems are not issues: see [SECURITY.md](SECURITY.md). Be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md).

By contributing you agree your work is licensed under Apache-2.0 and you certify the
[Developer Certificate of Origin 1.1](https://developercertificate.org/).

## Build and test

Node 22 or newer.

```
npm ci
npm test
node bin/vellum.mjs build examples/site.config.mjs
```

## Style

- Small modules, no framework, no build step. Prefer a few lines of standard library to a new dependency.
- A change to Markdown handling needs a test in `test/`. A bug fix needs a test that fails without the fix.
- Keep personal paths, domains and proprietary fonts out of the repo: site configs live in `sites/` (ignored), fonts in `fonts/` (ignored).

## Commits and pull requests

- One plain sentence per commit message, about 10 to 15 words, saying what changed.
- Group related files into one commit; do not mix a refactor with a feature.
- Pull request: say what changed and why, and how you checked it.
