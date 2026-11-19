# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use
[GitHub's private vulnerability-reporting form](https://github.com/darthdemono/vellum/security/advisories/new)
for this repository, or contact the maintainer through the address on the
[GitHub profile](https://github.com/darthdemono).

Include a minimal reproduction, the affected version, the impact and any proposed mitigation.
Reports are acknowledged within seven days.

## Scope

vellum reads a folder of Markdown you control and writes static files. It runs no server in production.
Things that count: a crafted note that makes the build write outside the output directory, run code, or
inject script into pages that is not in the note; a crafted `deploy` config that runs a command other than rsync.
Raw HTML in notes is passed through on purpose (the vault is trusted input, like the config).
