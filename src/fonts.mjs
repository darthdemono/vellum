// Font presets. Self-hosted (no Google requests). Proprietary files are never in the repo: put them in ./fonts (gitignored)
// or point VELLUM_FONTS at a directory.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)
const fsrc = (pkg) => path.join(path.dirname(req.resolve(`@fontsource/${pkg}/package.json`)), 'files')
const LOCAL = process.env.VELLUM_FONTS ?? path.resolve(process.cwd(), 'fonts')
const BN = 'U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC'
const fs400 = (pkg, name, extra = {}) => [
  { dir: () => fsrc(pkg), file: `${name}-latin-400-normal.woff2`, weight: 400, ...extra },
  { dir: () => fsrc(pkg), file: `${name}-latin-700-normal.woff2`, weight: 700, ...extra },
  { dir: () => fsrc(pkg), file: `${name}-latin-400-italic.woff2`, weight: 400, style: 'italic', optional: true, ...extra },
  { dir: () => fsrc(pkg), file: `${name}-latin-700-italic.woff2`, weight: 700, style: 'italic', optional: true, ...extra },
]
// size-adjust: Bengali glyphs sit smaller than Latin ones at the same font-size, so the Bengali faces are scaled up
const bn = (pkg, name, adjust) => [400, 700].map((weight) => ({ dir: () => fsrc(pkg), file: `${name}-bengali-${weight}-normal.woff2`, weight, range: BN, adjust }))

export const PRESETS = {
  'Adobe Garamond Pro': [{ dir: () => LOCAL, file: 'adobe-garamond-pro/AGaramondPro-Regular.woff', weight: 400 }],
  'Verdana Pro': [{ dir: () => LOCAL, file: 'verdana-pro/VerdanaPro-Regular.woff', weight: 400 }],
  'Departure Mono': [{ dir: () => LOCAL, file: 'DepartureMono-Regular.otf', weight: 400 }],
  'EB Garamond': fs400('eb-garamond', 'eb-garamond'),
  'Space Mono': fs400('space-mono', 'space-mono'),
  'Roboto Mono': fs400('roboto-mono', 'roboto-mono'),
  'Noto Serif': fs400('noto-serif', 'noto-serif'),
  'Noto Sans': fs400('noto-sans', 'noto-sans'),
  'Noto Serif Bengali': bn('noto-serif-bengali', 'noto-serif-bengali', '112%'),
  'Noto Sans Bengali': bn('noto-sans-bengali', 'noto-sans-bengali', '106%'),
}
const GENERIC = { header: 'Georgia,serif', body: 'system-ui,sans-serif', code: 'ui-monospace,monospace' }
const fmt = { woff2: 'woff2', woff: 'woff', otf: 'opentype', ttf: 'truetype' }

/** theme.fonts = { header, body, code }, each a name or an array of names (fallbacks, e.g. a Bengali face). */
export function resolveFonts(theme) {
  const faces = [], files = [], stacks = {}, seen = new Set()
  for (const role of ['header', 'body', 'code']) {
    const names = [].concat(theme.fonts[role])
    stacks[role] = names.map((n) => `"${n}"`).concat(GENERIC[role]).join(',')
    for (const name of names) {
      if (seen.has(name)) continue
      seen.add(name)
      for (const f of PRESETS[name] ?? []) {
        const abs = path.join(f.dir(), f.file)
        if (!fs.existsSync(abs)) { if (!f.optional) console.warn(`font ${name}: ${abs} missing, falling back`); continue }
        const rel = 'fonts/' + f.file.split('/').pop()
        files.push({ rel, abs })
        faces.push(`@font-face{font-family:"${name}";src:url(/static/${rel}) format("${fmt[rel.split('.').pop()]}");font-weight:${f.weight};font-style:${f.style ?? 'normal'};font-display:swap${f.range ? ';unicode-range:' + f.range : ''}${f.adjust ? ';size-adjust:' + f.adjust : ''}}`)
      }
    }
  }
  return { css: faces.join('\n'), files, stacks }
}
