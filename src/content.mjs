import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { slugify, assetPath } from './util.mjs'

const IMG = /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i
const ASSET = /\.(?!md$|markdown$|canvas$|base$)[^.]+$/i

export const splitFrontmatter = (raw) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!m) return { fm: {}, raw: '', body: raw }
  let fm = {}
  try { fm = YAML.parse(m[1]) ?? {} } catch { fm = {} }
  return { fm, raw: m[0].replace(/\r?\n$/, ''), body: raw.slice(m[0].length) }
}

const asDate = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d) ? null : d
}
const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : String(v).split(/[,\s]+/)).map(String).filter(Boolean)

/** Walk a vault. Returns { pages, assets }. Hidden dirs and ignore patterns are skipped. */
export function scan(dir, { ignore = [] } = {}) {
  const pages = [], assets = []
  const skip = (rel) => ignore.some((p) => rel === p || rel.startsWith(p + '/') || rel.split('/').includes(p))
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      const abs = path.join(d, e.name)
      const rel = path.relative(dir, abs).split(path.sep).join('/')
      if (skip(rel)) continue
      if (e.isDirectory()) walk(abs)
      else if (/\.md$/i.test(e.name)) {
        const raw = fs.readFileSync(abs, 'utf8')
        const { fm, raw: fmRaw, body } = splitFrontmatter(raw)
        if (fm.draft === true || fm.publish === false) continue
        const st = fs.statSync(abs)
        const base = path.basename(rel, '.md')
        pages.push({
          rel, slug: slugify(rel), fm, fmRaw, body,
          title: String(fm.title ?? base),
          tags: asList(fm.tags ?? fm.tag),
          aliases: asList(fm.aliases ?? fm.alias),
          date: asDate(fm.date ?? fm.created ?? fm.datetime) ?? st.mtime,
          updated: asDate(fm.updated ?? fm.modified) ?? st.mtime,
          dated: !!(fm.date ?? fm.created ?? fm.datetime),
          cssclasses: asList(fm.cssclasses ?? fm.cssclass),
        })
      } else if (ASSET.test(e.name)) assets.push({ rel, abs, out: assetPath(rel), image: IMG.test(e.name) })
    }
  }
  walk(dir)
  pages.sort((a, b) => (a.slug < b.slug ? -1 : 1))
  return { pages, assets }
}

/** Shortest-path name resolution, like Obsidian: by basename, else by path suffix. */
export function makeResolver(pages, assets) {
  const byName = new Map(), bySlug = new Map(), assetByName = new Map()
  for (const p of pages) {
    bySlug.set(p.slug.toLowerCase(), p)
    const n = p.slug.split('/').pop().toLowerCase()
    if (!byName.has(n)) byName.set(n, [])
    byName.get(n).push(p)
  }
  for (const a of assets) assetByName.set(a.rel.split('/').pop().toLowerCase(), a)
  const page = (target, from) => {
    const t = target.replace(/\.md$/i, '').replace(/^\/+/, '')
    const full = bySlug.get(slugify(t).toLowerCase())
    if (full) return full
    const cands = byName.get(slugify(t.split('/').pop()).toLowerCase()) ?? []
    const suffix = '/' + slugify(t).toLowerCase()
    const hit = t.includes('/') ? cands.filter((c) => ('/' + c.slug.toLowerCase()).endsWith(suffix)) : cands
    if (hit.length <= 1) return hit[0] ?? null
    const dir = from ? from.slug.split('/').slice(0, -1).join('/') : ''
    return hit.find((c) => c.slug.startsWith(dir + '/')) ?? [...hit].sort((a, b) => a.slug.length - b.slug.length)[0]
  }
  const asset = (target) => assetByName.get(target.split('/').pop().toLowerCase()) ?? null
  return { page, asset }
}
