# vellum

A small static site generator for Obsidian vaults. It builds a folder of Markdown into plain files that nginx (or any static host) serves.
There is **no server process and no runtime on the host**: you build on your own machine and `rsync` the result.

Built for three kinds of vault with one engine: long-form essays, course notes, and a large reference corpus (1,600+ acts of law in English and Bengali).

## Why

The usual Node site generators need Node, a few hundred MB of `node_modules` and a build step on the server. On a 1 GB VPS that
means a dev server permanently swapping, or a rebuild that can run the box out of memory. With vellum the server only holds files.

- **Cheap to build.** Markdown goes through markdown-it (no unified/remark graph); a no-change rebuild of 1,600 pages takes about 15 seconds on a desktop and writes nothing.
- **Cheap to serve.** Every text file gets a `.gz` next to it for nginx `gzip_static`; unchanged files keep their mtime so `rsync` sends nothing; stale files are removed.
- **Cheap in the browser.** One CSS file and one ~6 KB script (under 3 KB gzipped), no framework. Math is rendered at build time. Large sites load the page explorer from one JSON file instead of repeating it on every page.

## Features

Obsidian syntax: `[[wikilinks]]` (shortest-path, aliases, headings, `^block` ids), `![[embeds]]`, callouts (foldable), `==highlight==`, `#tags`, `%%comments%%`, footnotes, tables, task lists.
Math (KaTeX at build time), code (Shiki, light and dark), mermaid (self-hosted, loaded only on pages that use it).
Pages: copy-page menu (Markdown, ChatGPT, Claude), graph view, breadcrumbs, table of contents with scroll spy, backlinks, tag pages, folder pages, explorer, full-text search (`/` or Ctrl+K), link previews, dark mode, reader mode, 404, alias redirects.
Machine-readable: `<page>/llms.txt` (the note's own Markdown with its front matter), `/llms.txt` index, `/llms-full.txt`, sitemap, RSS, `robots.txt`.
Open Graph PNG per page and site icons (SVG, ICO, PNG, web manifest) generated from the site config.

### Extended lists

Legal and academic numbering that CommonMark does not know is kept as **literal text** (never renumbered), with a hanging indent and nesting by indentation:

| Style | Examples |
|---|---|
| Parenthesised | `(1)` `(1A)` `(13AA)` `(a)` `(aa)` `(iv)` |
| Multi-level | `1.1.` `1.2.3` `1.A.` `1.A` |
| Bengali | `১)` `ক)` `(১ক)` `(ক)` `৪৪.` |
| Letters and roman | `a)` `A.` `i.` (only when a second item follows, so "A. Smith wrote" stays prose) |

`lists: { numericNoDot: true }` also accepts `1.1 text`. Lines that are not indented continue the item, as in a paragraph.

## Use

```
npm ci
node bin/vellum.mjs build examples/site.config.mjs     # build to dist/example
node bin/vellum.mjs serve examples/site.config.mjs     # build and preview on :8080
node bin/vellum.mjs check examples/site.config.mjs     # list unresolved wikilinks
node bin/vellum.mjs deploy examples/site.config.mjs    # build, then rsync (needs deploy in the config; --dry previews)
```

Copy `examples/site.config.mjs` and point `content` at your vault. Keys: `title`, `description`, `baseUrl`, `content`, `ignore`, `customCss`, `icon`, `og.fontFiles`,
`theme.fonts` / `theme.colors` (light and dark), `explorer`, `search.depth` (`full` or `meta`), `lists`, `footer.links`, `llms.full`, `disclosure`, `deploy`.

### Original list numbering

Scrapers and converters often turn legal numbering into a plain `1. 2. 3.` list. If each item keeps its real marker in an invisible comment,
vellum shows the real marker and keeps normal Markdown nesting:

```
1. <!--n:(ক)--> first clause
   1. <!--n:(১)--> nested clause
```

Obsidian and other Markdown tools ignore the comment and show `1.`; vellum renders `(ক)` and `(১)`.

### More site options

`home` (a Markdown file used as the home page; the vault's own index moves to `indexSlug`, titled `indexTitle`), `meta: { show: true }` (a table of front matter fields such as the official source),
`footnoteLabel` (the footnote section heading; a manual `## Footnotes` heading in a note is dropped so there is only one), `normalizeHeadings` (remap h5/h6-only pages to h2, h3),
`tocDepth`, `baseSize`, `author`.

### Fonts

Font presets are self-hosted. EB Garamond, Space Mono, Roboto Mono, Noto Serif and Noto Sans (with Bengali) come from the `@fontsource` packages.
Adobe Garamond Pro, Verdana Pro and Departure Mono are read from `./fonts` (or `VELLUM_FONTS`) and are not shipped. A role takes one name or a list, so a Bengali face can follow a Latin one.

### nginx

```
root /var/www/site;
gzip_static on;
charset utf-8;
# A page is Page.html plus an optional Page/ directory holding llms.txt: try $uri.html before any directory
location / { try_files $uri $uri.html $uri/index.html =404; }
error_page 404 /404.html;
```

### Disclosure

`disclosure: { title, short, markdown }` adds a one-line notice to every page footer and an `/about` page, and puts the notice at the top of `llms.txt`.
A page with a `source_url` in its front matter shows an "Official source" link.

## Limits

No client-side routing (every link is a normal page load) and no comments. Search is a linear scan of one JSON file; sites over a few hundred pages index titles, tags and descriptions only.

## Licence

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). Inspired by [Quartz](https://quartz.jzhao.xyz) (MIT); no Quartz code is included.
