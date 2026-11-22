# Changelog

## Unreleased

### Added

- **Download vault** button on the home page: a zip of the vault's original Markdown files and folders, built with the site (`<name>-vault.zip`), replaces "Copy site". On the home page it is the first item of the page menu, above Copy, View, Ask ChatGPT and Ask Claude (those work on the site's `llms` file there). Other pages keep "Copy page".
- **Graph view** redrawn: zoom (wheel), pan (drag the background), double-click to refit, lighter edges, hovered node's links highlighted, labels placed without overlapping.
- First version. Builds an Obsidian vault into static files: wikilinks, embeds, callouts, highlights, tags, block ids, footnotes, KaTeX math, Shiki code, mermaid, backlinks, table of contents, explorer, search, link previews, dark mode, reader mode.
- **Extended list markers** kept as literal text: `(1)`, `(1A)`, `(13AA)`, `(a)`, `(iv)`, `1.1.`, `1.A.`, `১)`, `ক)`, `(১ক)`, nested by indentation.
- Open Graph images (PNG, cached, rendered in short-lived child processes), site icons (SVG, ICO, PNG, web manifest), `llms.txt` per page and per site, `llms-full.txt`, sitemap, RSS, robots.txt.
- Output is written only when it changed (so rsync sends nothing), stale files are removed, and every text file gets a `.gz` for nginx `gzip_static`.
- Self-hosted font presets (Adobe Garamond Pro and Verdana Pro from a local folder; EB Garamond, Space Mono, Roboto Mono, Noto Serif and Sans with Bengali from fontsource).
- **Copy page menu** (copy as Markdown, view as Markdown, ask ChatGPT, ask Claude), **graph view** (local graph in the sidebar, whole-site overlay), self-hosted **mermaid** (loaded only on pages that use it), heading anchors, code copy buttons, reading progress bar, mobile drawer menu and a full-width site footer.
- Original list markers via `<!--n:(a)-->` comments, a front matter information table (`meta`), a custom home page (`home`), one footnote section with a configurable label, heading level normalisation, all heading levels in the contents list, image flags in alt text (left, right, sm, md, lg, centre, left-right, grid), nested tag pages, tag search (`#tag`) with snippets, hover prefetch, and a clearer theme button.
- The root page is no longer listed in the page explorer; sites set their base font size with `baseSize`.
- `deploy` (build then rsync), `serve`, `check` (unresolved wikilinks), and a per-site disclosure notice with an About page.
