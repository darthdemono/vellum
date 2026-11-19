import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import GithubSlugger from 'github-slugger'
import { scan, makeResolver, splitFrontmatter } from './content.mjs'
import { createMarkdown, preprocess } from './md.mjs'
import { pageHtml, explorerHtml } from './render.mjs'
import { buildTree, cssFor } from './site.mjs'
import { resolveFonts } from './fonts.mjs'
import { ogKey, ogRender, iconSvg, iconPng, ico } from './og.mjs'
import { pageLlms, siteLlms, siteLlmsFull } from './llms.mjs'
import { Sink, esc, hash, hrefOf, outFileOf, slugSegment } from './util.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const asset = (f) => fs.readFileSync(path.join(here, '../assets', f), 'utf8')
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '...')

async function makeHighlighter(pages) {
  const langs = new Set()
  for (const p of pages) for (const m of p.body.matchAll(/^```([\w+-]+)/gm)) if (m[1] !== 'mermaid') langs.add(m[1].toLowerCase())
  if (!langs.size) return undefined
  const { createHighlighter, bundledLanguages } = await import('shiki')
  const ok = [...langs].filter((l) => l in bundledLanguages)
  const hl = await createHighlighter({ themes: ['github-light', 'github-dark'], langs: ok })
  const have = new Set(ok)
  return (code, lang) => {
    lang = lang.toLowerCase()
    if (!have.has(lang)) return ''
    return hl.codeToHtml(code, { lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false })
  }
}

export async function build(site, { log = console.log } = {}) {
  const t0 = Date.now()
  const { pages, assets } = scan(site.content, { ignore: site.ignore })
  if (!pages.length) throw new Error('no markdown pages in ' + site.content)
  if (site.home) {
    // A hand-written introduction becomes the home page; the vault's own index moves to site.indexSlug.
    const raw = fs.readFileSync(site.home, 'utf8'), { fm, raw: fmRaw, body } = splitFrontmatter(raw)
    const old = pages.find((p) => p.slug === 'index')
    if (old) { old.slug = site.indexSlug ?? 'index-page'; old.rel = old.slug + '.md'; if (old.title === 'index') old.title = site.indexTitle ?? 'Index' }
    const now = new Date()
    pages.unshift({ rel: 'index.md', slug: 'index', fm, fmRaw, body, title: String(fm.title ?? site.title), tags: [], aliases: [], date: now, updated: now, dated: false, cssclasses: [], home: true })
  }
  { const seenSlug = new Map(); for (const p of pages) { const k = p.slug.toLowerCase(); if (seenSlug.has(k)) log(`warning: ${p.rel} and ${seenSlug.get(k)} share the URL /${p.slug} (one overwrites the other)`); else seenSlug.set(k, p.rel) } }
  const resolver = makeResolver(pages, assets)
  const highlight = await makeHighlighter(pages)
  const md = createMarkdown({
    resolve: resolver.page, highlight, extlist: site.lists, footnoteLabel: site.footnoteLabel, normalizeHeadings: site.normalizeHeadings,
    assetUrl: (t) => { const a = resolver.asset(t); return a ? '/' + a.out : null },
  })

  // 1. render every page
  const bySlug = new Map(pages.map((p) => [p.slug, p]))
  const inbound = new Map()
  for (const p of pages) {
    let body = preprocess(p.body)
    const h1 = body.match(/^\s*#\s+(.+?)\s*\n/)
    if (h1 && h1[1].trim() === p.title.trim()) body = body.slice(h1[0].length)
    const env = { page: p, links: new Set(), inlineTags: new Set(), slugger: new GithubSlugger() }
    p.html = md.render(body, env).replace(/<img\b(?![^>]*\balt=)/g, '<img alt=""') // raw <img> in a note: decorative unless the author says otherwise
    if (p.html.includes('id="footnote-label"')) env.toc.push({ depth: 2, text: site.footnoteLabel || 'References', id: 'footnote-label' })
    p.toc = env.toc; p.hasMath = !!env.hasMath; p.hasMermaid = !!env.hasMermaid; p.links = [...env.links]
    for (const t of env.inlineTags) if (!p.tags.includes(t)) p.tags.push(t)
    const text = plain(p.html)
    p.text = text
    p.mins = Math.max(1, Math.ceil(text.split(' ').length / 200))
    p.desc = clip(String(p.fm.description ?? '').trim() || plain((p.html.match(/<p[^>]*>([\s\S]*?)<\/p>/) ?? [])[1] ?? ''), 200)
    for (const s of env.links) if (s !== p.slug) { if (!inbound.has(s)) inbound.set(s, new Set()); inbound.get(s).add(p.slug) }
  }
  for (const p of pages) p.backlinks = [...(inbound.get(p.slug) ?? [])].map((s) => bySlug.get(s)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title))

  // 2. generated pages: folder listings, tag pages, 404
  const folders = new Set()
  for (const p of pages) { const segs = p.slug.split('/').slice(0, -1); for (let i = 1; i <= segs.length; i++) folders.add(segs.slice(0, i).join('/')) }
  const generated = []
  const list = (items) => '<ul class="page-list">' + items.map((i) => `<li><a class="t" href="${esc(i.href)}">${esc(i.title)}</a>${i.desc ? `<span class="d">${esc(clip(i.desc, 120))}</span>` : ''}</li>`).join('') + '</ul>'
  for (const f of [...folders].sort()) {
    if (bySlug.has(f + '/index')) continue
    const kids = new Set()
    for (const p of pages) if (p.slug.startsWith(f + '/')) { const rest = p.slug.slice(f.length + 1).split('/'); kids.add(rest.length === 1 ? p.slug : f + '/' + rest[0]) }
    const items = [...kids].sort().map((s) => bySlug.has(s) ? { href: hrefOf(s), title: bySlug.get(s).title, desc: bySlug.get(s).desc } : { href: '/' + s + '/', title: s.split('/').pop().replace(/-/g, ' '), desc: '' })
    generated.push({ slug: f + '/index', rel: f + '/index.md', title: f.split('/').pop().replace(/-/g, ' '), html: list(items), tags: [], generated: true, date: new Date(), toc: [], backlinks: [], desc: '' })
  }
  const tagMap = new Map()
  // a nested tag Work/AgamirHashi also lists under its parent Work, as on the previous site
  for (const p of pages) for (const t of p.tags) { const parts = t.split('/'); for (let i = 1; i <= parts.length; i++) { const k = parts.slice(0, i).join('/'); if (!tagMap.has(k)) tagMap.set(k, []); if (!tagMap.get(k).includes(p)) tagMap.get(k).push(p) } }
  for (const [t, ps] of tagMap) generated.push({ slug: 'tags/' + t, rel: 'tags/' + t + '.md', title: '#' + t, html: list(ps.map((p) => ({ href: hrefOf(p.slug), title: p.title, desc: p.desc }))), tags: [], generated: true, date: new Date(), toc: [], backlinks: [], desc: ps.length + ' pages tagged ' + t })
  generated.push({ slug: 'tags/index', rel: 'tags/index.md', title: 'Tags', html: list([...tagMap].sort().map(([t, ps]) => ({ href: '/tags/' + t, title: '#' + t, desc: ps.length + ' pages' }))), tags: [], generated: true, date: new Date(), toc: [], backlinks: [], desc: 'All tags' })
  if (site.disclosure && !bySlug.has('about')) {
    const dmd = createMarkdown({ resolve: () => null, assetUrl: () => null })
    generated.push({ slug: 'about', rel: 'about.md', title: site.disclosure.title ?? 'About this site', html: dmd.render(site.disclosure.markdown, { slugger: new GithubSlugger() }), tags: [], generated: true, date: new Date(), toc: [], backlinks: [], desc: site.disclosure.short })
  }
  const notFound = { slug: '404', rel: '404.md', title: '404', html: '<p>That page does not exist or has moved. Try the search or the page list.</p>', tags: [], generated: true, noCrumbs: true, date: new Date(), toc: [], backlinks: [], desc: '' }
  const all = [...pages, ...generated, notFound]
  const slugs = new Set(all.map((p) => p.slug))

  // 3. shared context
  const tree = buildTree(pages, site)
  const lazyTree = pages.length > site.explorer.inlineMax
  const fonts = resolveFonts(site.theme)
  const css = cssFor(site, asset('style.css'), fonts), js = asset('client.js')
  const ver = { css: hash(css), js: hash(js) }
  const exCache = new Map()
  const fullOk = site.llms.full === true || (site.llms.full === 'auto' && pages.reduce((n, p) => n + p.body.length, 0) < 4_000_000)
  const titleCount = new Map()
  for (const p of all) titleCount.set(p.title, (titleCount.get(p.title) ?? 0) + 1)
  const dupTitles = new Set([...titleCount].filter(([, n]) => n > 1).map(([t]) => t))
  const ctx = { dupTitles, homeMd: fullOk ? '/llms-full.txt' : '/llms.txt', site, ver, slugs, folders, lazyTree, explorer: (slug) => explorerHtml(tree, slug) }
  const sink = new Sink(site.out, path.join(site.cache, 'manifest.json'))

  // 4. emit pages (+ aliases, og, llms)
  const ogDir = path.join(site.cache, 'og')
  const ogData = (p) => { const d = { title: p.slug === 'index' ? site.title : p.title, desc: p.desc }; d.key = ogKey(site, d); return d }
  const rendered = await ogRender(site, all.map(ogData), ogDir)
  const seen = new Set(slugs)
  for (const p of all) {
    sink.write(outFileOf(p.slug), pageHtml(ctx, p))
    if (!p.generated) sink.write(p.slug + '/llms.txt', pageLlms(p, site.footnoteLabel))
    const key = ogData(p).key
    if (sink.old['og/' + p.slug + '.png'] === key && fs.existsSync(path.join(site.out, 'og', p.slug + '.png'))) { sink.now['og/' + p.slug + '.png'] = key; sink.stats.skipped++ } else sink.write('og/' + p.slug + '.png', fs.readFileSync(ogDir + '/' + key + '.png'), key)
    for (const a of p.aliases ?? []) {
      const s = a.split('/').map(slugSegment).join('/')
      if (seen.has(s)) continue
      seen.add(s)
      sink.write(s + '.html', `<!doctype html><meta charset="utf-8"><title>${esc(p.title)}</title><link rel="canonical" href="${esc(hrefOf(p.slug))}"><meta http-equiv="refresh" content="0; url=${esc(hrefOf(p.slug))}">`)
    }
  }

  // 5. site-level files
  const base = 'https://' + site.baseUrl
  sink.write('index.css', css); sink.write('index.js', js)
  if (tree && lazyTree) sink.write('tree.json', JSON.stringify(tree))
  const deep = site.search.depth === 'full' && pages.length <= 400
  sink.write('search.json', JSON.stringify(all.filter((p) => !p.generated).map((p) => ({ u: hrefOf(p.slug), t: p.title, g: p.tags, x: deep ? clip(p.text, 3000) : p.desc }))))
  sink.write('llms.txt', siteLlms(site, pages))
  {
    const real = pages.filter((p) => !p.generated), ix = new Map(real.map((p, i) => [p.slug, i]))
    const e = []
    for (const p of real) for (const s of p.links ?? []) if (ix.has(s) && s !== p.slug) e.push([ix.get(p.slug), ix.get(s)])
    sink.write('graph.json', JSON.stringify({ n: real.map((p) => [p.slug, p.title]), e }))
  }
  if (pages.some((p) => p.hasMermaid)) sink.copy('static/mermaid.min.js', createRequire(import.meta.url).resolve('mermaid/package.json').replace('package.json', 'dist/mermaid.min.js'))
  if (fullOk) sink.write('llms-full.txt', siteLlmsFull(site, pages))
  sink.write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`)
  sink.write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${esc(base + (p.slug === 'index' ? '/' : encodeURI(hrefOf(p.slug))))}</loc><lastmod>${p.updated.toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`)
  const recent = [...pages].sort((a, b) => b.date - a.date).slice(0, 30)
  sink.write('index.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(site.title)}</title><link>${base}</link><description>${esc(site.description || site.title)}</description>\n${recent.map((p) => `<item><title>${esc(p.title)}</title><link>${esc(base + encodeURI(hrefOf(p.slug)))}</link><guid>${esc(base + encodeURI(hrefOf(p.slug)))}</guid><pubDate>${p.date.toUTCString()}</pubDate><description>${esc(p.desc)}</description></item>`).join('\n')}\n</channel></rss>\n`)
  // icons
  sink.write('icon.svg', iconSvg(site))
  const k = hash('icon', JSON.stringify(site.icon), site.theme.fonts.header)
  sink.write('apple-touch-icon.png', iconPng(site, 180), k + 'a'); sink.write('icon-192.png', iconPng(site, 192), k + 'b'); sink.write('icon-512.png', iconPng(site, 512), k + 'c')
  sink.write('favicon.ico', ico(iconPng(site, 48), 48), k + 'd')
  sink.write('manifest.webmanifest', JSON.stringify({ name: site.title, short_name: site.shortTitle ?? site.title, start_url: '/', display: 'standalone', background_color: site.theme.colors.light.light, theme_color: site.theme.colors.light.light, icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }))
  for (const f of fonts.files) sink.copy('static/' + f.rel, f.abs)
  // assets + static + katex
  for (const a of assets) sink.copy(a.out, a.abs)
  if (site.static && fs.existsSync(site.static)) {
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const abs = path.join(d, e.name); if (e.isDirectory()) walk(abs); else sink.copy('static/' + path.relative(site.static, abs).split(path.sep).join('/'), abs) } }
    walk(site.static)
  }
  if (pages.some((p) => p.hasMath)) {
    const kd = path.dirname(createRequire(import.meta.url).resolve('katex/package.json')) + '/dist'
    sink.copy('static/katex/katex.min.css', kd + '/katex.min.css')
    for (const f of fs.readdirSync(kd + '/fonts')) if (f.endsWith('.woff2')) sink.copy('static/katex/fonts/' + f, kd + '/fonts/' + f)
  }
  const stats = sink.finish()
  log(`${site.name}: ${pages.length} pages (+${generated.length + 1} generated), ${stats.written} written, ${stats.skipped} unchanged, ${stats.removed} removed, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  const broken = pages.flatMap((p) => [...p.html.matchAll(/class="internal broken"[^>]*>([^<]*)</g)].map((m) => p.slug + ' -> ' + m[1]))
  return { pages: all, stats, broken }
}
