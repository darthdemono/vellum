import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const hash = (...parts) => crypto.createHash('sha1').update(parts.join('\x00')).digest('hex').slice(0, 16)

// Same rules as Quartz so existing URLs keep working.
export const slugSegment = (s) =>
  s.replace(/\s/g, '-').replace(/&/g, '-and-').replace(/%/g, '-percent').replace(/\?/g, '').replace(/#/g, '')
export const slugify = (rel) => {
  const noExt = rel.replace(/\.(md|markdown)$/i, '')
  const s = noExt.split('/').map(slugSegment).join('/')
  return s === '' ? 'index' : s
}
export const assetPath = (rel) => rel.split('/').map(slugSegment).join('/')

// Page URL: "a/index" -> "/a/", "index" -> "/", else "/a/b" (nginx adds .html).
export const hrefOf = (slug) => (slug === 'index' ? '/' : slug.endsWith('/index') ? '/' + slug.slice(0, -5) : '/' + slug)
export const outFileOf = (slug) => slug + '.html'

const COMPRESSIBLE = /\.(html|css|js|json|txt|xml|svg|webmanifest|ico)$/
/** Output sink: skips unchanged files (keeps mtimes so rsync sends nothing), writes .gz for nginx gzip_static. */
export class Sink {
  constructor(root, manifestFile) {
    this.root = root
    this.manifestFile = manifestFile
    this.old = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {}
    this.now = {}
    this.stats = { written: 0, skipped: 0 }
  }
  write(rel, data, key) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const k = key ?? hash(buf.toString('latin1'))
    const abs = path.join(this.root, rel)
    this.now[rel] = k
    if (this.old[rel] === k && fs.existsSync(abs)) { this.stats.skipped++; return }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, buf)
    this.stats.written++
    if (COMPRESSIBLE.test(rel) && buf.length > 1024) fs.writeFileSync(abs + '.gz', zlib.gzipSync(buf, { level: 9 }))
    else fs.rmSync(abs + '.gz', { force: true })
  }
  /** Copy a file unchanged-aware (key = size + mtime), no compression. */
  copy(rel, abs) {
    const st = fs.statSync(abs), k = st.size + '-' + Math.floor(st.mtimeMs)
    const dest = path.join(this.root, rel)
    this.now[rel] = k
    if (this.old[rel] === k && fs.existsSync(dest)) { this.stats.skipped++; return }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(abs, dest)
    this.stats.written++
  }
  /** Delete everything under root that this build did not emit, then save the manifest. */
  finish() {
    const keep = new Set()
    for (const rel of Object.keys(this.now)) { keep.add(rel); keep.add(rel + '.gz') }
    let removed = 0
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name)
        const rel = path.relative(this.root, abs).split(path.sep).join('/')
        if (e.isDirectory()) { walk(abs); if (!fs.readdirSync(abs).length) fs.rmdirSync(abs) }
        else if (!keep.has(rel)) { fs.rmSync(abs); removed++ }
      }
    }
    if (fs.existsSync(this.root)) walk(this.root)
    fs.mkdirSync(path.dirname(this.manifestFile), { recursive: true })
    fs.writeFileSync(this.manifestFile, JSON.stringify(this.now))
    this.stats.removed = removed
    return this.stats
  }
}
