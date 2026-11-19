import { esc, hrefOf } from './util.mjs'
import { ICONS } from './icons.mjs'

const fmtDate = (d) => d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })

export function explorerHtml(tree, curSlug) {
  const walk = (nodes) => '<ul>' + nodes.map(([name, slug, kids]) => {
    if (!kids) return `<li><a href="${esc(hrefOf(slug))}"${slug === curSlug ? ' class="active"' : ''}>${esc(name)}</a></li>`
    const open = slug && curSlug.startsWith(slug.replace(/\/index$/, '') + '/') ? ' open' : ''
    return `<li><details${open}><summary>${slug ? `<a href="${esc(hrefOf(slug))}">${esc(name)}</a>` : esc(name)}</summary>${walk(kids)}</details></li>`
  }).join('') + '</ul>'
  return walk(tree)
}

export function pageHtml(ctx, p) {
  const { site, ver } = ctx
  const base = 'https://' + site.baseUrl
  const url = base + (p.slug === 'index' ? '/' : encodeURI(hrefOf(p.slug)))
  const title = p.slug === 'index' ? site.title : `${p.title} | ${site.title}`
  const desc = p.desc || site.description || ''
  const og = `${base}/og/${p.slug}.png`
  const crumbs = p.slug === 'index' || p.noCrumbs ? '' : '<nav class="crumbs"><a href="/">Home</a>' +
    p.slug.split('/').slice(0, -1).map((seg, i, a) => { const sl = a.slice(0, i + 1).join('/') + '/index'; return ctx.slugs.has(sl) || ctx.folders.has(a.slice(0, i + 1).join('/')) ? `<span><a href="/${esc(a.slice(0, i + 1).join('/'))}/">${esc(seg.replace(/-/g, ' '))}</a></span>` : `<span>${esc(seg.replace(/-/g, ' '))}</span>` }).join('') +
    `<span>${esc(p.title)}</span></nav>`
  const src = typeof p.fm?.source_url === 'string' && /^https?:\/\//.test(p.fm.source_url) ? `<a class="external" rel="noopener" href="${esc(p.fm.source_url)}">Official source</a>` : ''
  const info = site.meta?.show ? docInfo(p, site) : ''
  const meta = [p.dated || p.showDate ? fmtDate(p.date) : '', p.mins ? `${p.mins} min read` : '', src].filter(Boolean).join(' &middot; ')
  const tags = p.tags?.length ? '<ul class="taglist">' + p.tags.map((t) => `<li><a class="tag-link" href="/tags/${esc(t)}">#${esc(t)}</a></li>`).join('') + '</ul>' : ''
  const toc = p.toc?.length > 1 ? '<nav class="toc"><h3>On this page</h3><ul>' + p.toc.filter((h) => h.depth >= 2 && h.depth <= (site.tocDepth ?? 5)).map((h) => `<li class="d${h.depth}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join('') + '</ul></nav>' : ''
  const bl = p.backlinks?.length ? '<nav class="backlinks"><h3>Backlinks</h3><ul>' + p.backlinks.slice(0, 30).map((b) => `<li><a class="internal" href="${esc(hrefOf(b.slug))}">${esc(b.title)}</a></li>`).join('') + (p.backlinks.length > 30 ? `<li class="more">and ${p.backlinks.length - 30} more</li>` : '') + '</ul></nav>' : ''
  const explorer = ctx.lazyTree
    ? `<div class="explorer" id="explorer-lazy" data-slug="${esc(p.slug)}"></div>`
    : `<div class="explorer">${ctx.explorer(p.slug)}</div>`
  const links = (site.footer?.links ? Object.entries(site.footer.links) : []).map(([k, v]) => `<li><a href="${esc(v)}">${esc(k)}</a></li>`).join('')
  const katex = p.hasMath ? `<link rel="stylesheet" href="/static/katex/katex.min.css">` : ''
  const graph = p.generated ? '' : `<div class="graph-box"><div class="graph-head"><h3>Graph view</h3><button id="graph-full" type="button" aria-label="Open full graph" title="Open full graph">&#10530;</button></div><canvas id="graph" data-slug="${esc(p.slug)}"></canvas></div>`
  const hasMd = p.slug !== 'index' ? !p.generated : ctx.homeMd
  const mdUrl = p.slug === 'index' ? ctx.homeMd : '/' + p.slug + '/llms.txt'
  const copyMenu = !hasMd ? '' : `<div class="copy-page" data-md="${esc(mdUrl)}"><button class="copy-main" type="button" aria-haspopup="true">${ICONS.copy}<span class="copy-text">${p.slug === 'index' ? 'Copy site' : 'Copy page'}</span>${ICONS.arrow}</button>
<div class="copy-menu" role="menu"><button type="button" class="mi do-copy">${ICONS.copy}<span>${p.slug === 'index' ? 'Copy site as Markdown' : 'Copy page as Markdown'}</span></button>
<a class="mi" href="${esc(mdUrl)}" target="_blank" rel="noopener">${ICONS.file}<span>View as Markdown <i>&#8599;</i></span></a>
<a class="mi ask-chatgpt" href="#" target="_blank" rel="noopener">${ICONS.chatgpt}<span>Ask ChatGPT about this ${p.slug === 'index' ? 'site' : 'page'} <i>&#8599;</i></span></a>
<a class="mi ask-claude" href="#" target="_blank" rel="noopener">${ICONS.claude}<span>Ask Claude about this ${p.slug === 'index' ? 'site' : 'page'} <i>&#8599;</i></span></a></div></div>`
  return `<!doctype html>
<html lang="${esc(site.lang || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="${p.slug === 'index' ? 'website' : 'article'}"><meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(og)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(og)}">
<meta name="theme-color" content="${esc(site.theme.colors.light.light)}">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/index.xml">
<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt">
${hasMd ? `<link rel="alternate" type="text/markdown" href="/${esc(p.slug)}/llms.txt">` : ''}
<script>document.documentElement.dataset.theme=(()=>{try{return localStorage.getItem('theme')}catch(e){}})()||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')</script>
<link rel="stylesheet" href="/index.css?v=${ver.css}">${katex}
<script defer src="/index.js?v=${ver.js}"></script>
</head><body><div class="progress" id="progress"></div>
<header class="topbar"><button id="menu" type="button" aria-label="Menu" aria-expanded="false">&#9776;</button><a class="site-title" href="/">${esc(site.title)}</a><button class="search-btn" type="button" aria-label="Search">Search</button></header>
<div class="page">
<aside class="sidebar left"><h2 class="site-title"><a href="/">${esc(site.title)}</a></h2>
<div class="tools"><button class="search-btn" type="button" aria-label="Search">Search</button><button id="theme" type="button" aria-label="Switch between light and dark mode" title="Switch between light and dark mode"><span class="to-dark"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg> Dark mode</span><span class="to-light"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> Light mode</span></button><button id="reader" type="button" aria-label="Toggle reader mode (hide sidebars)" title="Toggle reader mode (hide sidebars)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/></svg> <span>Reader</span></button></div>
<details class="explorer-wrap" id="ex-wrap"><summary class="menu">Pages</summary>${explorer}</details></aside>
<main>${crumbs}
<div class="title-row"><h1 class="article-title">${esc(p.title)}</h1>${copyMenu}</div>
${meta ? `<p class="meta">${meta}</p>` : ''}${tags}${info}
<article class="${esc(['popover-hint', ...(p.cssclasses || [])].join(' '))}">${p.html}</article>
</main>
<aside class="sidebar right">${graph}${toc}${bl}</aside></div>
<footer class="site-footer"><div class="foot-inner"><div class="foot-brand"><a class="foot-title" href="/">${esc(site.title)}</a><p>${esc(site.description || '')}</p></div>
<nav class="foot-links" aria-label="Footer">${links ? `<ul>${links}</ul>` : ''}<ul><li><a href="/llms.txt">llms.txt</a></li><li><a href="/index.xml">RSS</a></li><li><a href="/sitemap.xml">Sitemap</a></li></ul></nav>
<p class="foot-meta">&copy; ${new Date().getFullYear()} ${esc(site.author || site.title)} &middot; Built with vellum</p></div></footer>
<div id="graph-modal" hidden><div class="gm-box"><button id="graph-close" type="button" aria-label="Close">&times;</button><canvas id="graph-big"></canvas></div></div>
<div id="search" role="dialog" aria-label="Search"><div class="box"><input type="search" placeholder="Search" autocomplete="off"><ul></ul></div></div>
</body></html>`
}

const LABELS = { source_url: 'Official source', act_id: 'Act number', year: 'Year', enacted_at: 'Enacted', scraped_at: 'Copied on', language: 'Language' }
const SKIP = new Set(['title', 'description', 'tags', 'tag', 'aliases', 'alias', 'cssclasses', 'cssclass', 'sections', 'draft', 'publish', 'datetime', 'purpose'])
const LANG = { en: 'English', bn: 'Bengali (Bangla)' }

/** Front matter as a small information table: where the page came from and when. */
function docInfo(p, site) {
  const fm = p.fm ?? {}
  const rows = []
  for (const [k, v] of Object.entries(fm)) {
    if (SKIP.has(k) || v == null || v === '' || (Array.isArray(v) && !v.length) || typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) continue
    const label = site.meta?.labels?.[k] ?? LABELS[k] ?? k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
    let val
    if (v instanceof Date) val = v.toISOString().slice(0, 10)
    else if (Array.isArray(v)) val = v.map((x) => esc(String(x))).join(', ')
    else if (typeof v === 'string' && /^https?:\/\//.test(v)) val = `<a class="external" rel="noopener" href="${esc(v)}">${esc(v.replace(/^https?:\/\//, ''))}</a>`
    else if (k === 'language') val = esc(LANG[v] ?? String(v))
    else val = esc(String(v))
    rows.push(`<div><dt>${esc(label)}</dt><dd>${val}</dd></div>`)
  }
  if (Array.isArray(fm.sections)) rows.push(`<div><dt>Sections</dt><dd>${fm.sections.length}</dd></div>`)
  if (!rows.length) return ''
  return `<details class="docinfo" open><summary>${esc(site.meta?.title ?? 'Document information')}</summary><dl>${rows.join('')}</dl></details>`
}
