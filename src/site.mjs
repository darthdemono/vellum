import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const expand = (p, base) => (p ? (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(base, p)) : p)

const DEFAULTS = {
  lang: 'en',
  ignore: ['private', 'templates'],
  theme: { fonts: { header: 'Georgia', body: 'system-ui', code: 'ui-monospace' }, colors: {} },
  icon: { text: 'V', bg: '#3C5A73', fg: '#F7F4EC' },
  explorer: { order: [], inlineMax: 150 },
  search: { depth: 'full' },
  llms: { full: 'auto' },
  lists: { numericNoDot: false },
  footer: { links: {} },
}
const merge = (a, b) => {
  const o = { ...a }
  for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v
  return o
}

export async function loadSite(configPath) {
  const abs = path.resolve(configPath)
  const base = path.dirname(abs)
  const cfg = merge(DEFAULTS, (await import(pathToFileURL(abs).href)).default)
  cfg.name ||= path.basename(abs).replace(/\.config\.mjs$|\.mjs$/, '')
  cfg.content = expand(cfg.content, base)
  cfg.out = expand(cfg.out ?? `dist/${cfg.name}`, process.cwd())
  cfg.cache = expand(cfg.cache ?? `.cache/${cfg.name}`, process.cwd())
  if (cfg.static) cfg.static = expand(cfg.static, base)
  if (cfg.home) cfg.home = expand(cfg.home, base)
  if (cfg.customCss) cfg.customCss = expand(cfg.customCss, base)
  if (cfg.og?.fontFiles) cfg.og.fontFiles = cfg.og.fontFiles.map((f) => expand(f, base))
  cfg.theme.colors.light ||= {}
  cfg.theme.colors.dark ||= {}
  return cfg
}

const V = ['light', 'lightgray', 'gray', 'darkgray', 'dark', 'secondary', 'tertiary', 'highlight', 'textHighlight', 'customCallout', 'searchBackground']
export function cssFor(site, baseCss, fonts) {
  const t = site.theme
  const block = (c) => V.filter((k) => c[k]).map((k) => `--${k}:${c[k]}`).join(';')
  const faces = fonts.css
  const vars = `--base:${site.baseSize ?? '1.0625rem'};--headerFont:${fonts.stacks.header};--bodyFont:${fonts.stacks.body};--codeFont:${fonts.stacks.code}`
  const custom = site.customCss && fs.existsSync(site.customCss) ? fs.readFileSync(site.customCss, 'utf8') : ''
  return `${faces}\n:root{${block(t.colors.light)};${vars}}\n[data-theme=dark]{${block(t.colors.dark)}}\n${baseCss}\n${custom}`
}

/** Explorer tree: nodes are [name, slug|null, children?]. Folder nodes carry the slug of their index page. */
export function buildTree(pages, site) {
  const root = { kids: new Map() }
  const order = site.explorer.order.map((s) => s.toLowerCase())
  for (const p of pages) {
    if (p.generated || p.slug === 'index') continue
    const segs = p.rel.replace(/\.md$/i, '').split('/')
    let node = root
    for (const s of segs.slice(0, -1)) {
      if (!node.kids.has(s)) node.kids.set(s, { name: s, kids: new Map(), slug: null })
      node = node.kids.get(s)
    }
    const leaf = segs[segs.length - 1]
    if (segs.length > 1 && (leaf === 'index' || leaf === segs[segs.length - 2])) node.slug = p.slug
    else node.kids.set(leaf + '\x00', { name: p.title, slug: p.slug, leaf: true, t: p.dated ? p.date.getTime() : 0 })
  }
  const out = (node) => {
    const items = [...node.kids.values()]
    const folders = items.filter((i) => !i.leaf), files = items.filter((i) => i.leaf)
    const rank = (n) => { const i = order.indexOf(n.name.toLowerCase()); return i < 0 ? 999 : i }
    folders.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en', { numeric: true }))
    files.sort((a, b) => (site.explorer.byDate === false ? 0 : b.t - a.t) || a.name.localeCompare(b.name, 'en', { numeric: true }))
    return [...folders.map((f) => [f.name, f.slug, out(f)]), ...files.map((f) => [f.name, f.slug])]
  }
  return out(root)
}
