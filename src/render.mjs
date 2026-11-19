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
  const meta = [p.dated || p.showDate ? fmtDate(p.date) : '', p.mins ? `${p.mins} min read` : '', src].filter(Boolean).join(' &middot; ')
  const tags = p.tags?.length ? '<ul class="taglist">' + p.tags.map((t) => `<li><a class="tag-link" href="/tags/${esc(t)}">#${esc(t)}</a></li>`).join('') + '</ul>' : ''
  const toc = p.toc?.length > 1 ? '<nav class="toc"><h3>On this page</h3><ul>' + p.toc.filter((h) => h.depth >= 2 && h.depth <= 4).map((h) => `<li class="d${h.depth}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join('') + '</ul></nav>' : ''
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
<div class="tools"><button class="search-btn" type="button" aria-label="Search">Search</button><button id="theme" type="button" aria-label="Toggle theme">Theme</button><button id="reader" type="button" aria-label="Reader mode">Read</button></div>
<details class="explorer-wrap" id="ex-wrap"><summary class="menu">Pages</summary>${explorer}</details></aside>
<main>${crumbs}
<div class="title-row"><h1 class="article-title">${esc(p.title)}</h1>${copyMenu}</div>
${meta ? `<p class="meta">${meta}</p>` : ''}${tags}
<article class="${esc(['popover-hint', ...(p.cssclasses || [])].join(' '))}">${p.html}</article>
</main>
<aside class="sidebar right">${graph}${toc}${bl}</aside></div>
<footer class="site-footer"><div class="foot-inner"><div class="foot-brand"><a class="foot-title" href="/">${esc(site.title)}</a><p>${esc(site.description || '')}</p></div>
<nav class="foot-links" aria-label="Footer">${links ? `<ul>${links}</ul>` : ''}<ul><li><a href="/llms.txt">llms.txt</a></li><li><a href="/index.xml">RSS</a></li><li><a href="/sitemap.xml">Sitemap</a></li>${site.disclosure ? '<li><a href="/about">About</a></li>' : ''}</ul></nav>
${site.disclosure ? `<p class="disclosure">${esc(site.disclosure.short)} <a href="/about">Read the full notice</a>.</p>` : ''}
<p class="foot-meta">&copy; ${new Date().getFullYear()} ${esc(site.author || site.title)} &middot; Built with vellum</p></div></footer>
<div id="graph-modal" hidden><div class="gm-box"><button id="graph-close" type="button" aria-label="Close">&times;</button><canvas id="graph-big"></canvas></div></div>
<div id="search" role="dialog" aria-label="Search"><div class="box"><input type="search" placeholder="Search" autocomplete="off"><ul></ul></div></div>
</body></html>`
}
