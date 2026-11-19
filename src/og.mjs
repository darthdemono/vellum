import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { esc, hash } from './util.mjs'

const wide = (ch) => /[অ-হ-৿]/.test(ch) ? 0.95 : /[A-Z]/.test(ch) ? 0.66 : /[ilj.,;:'! ]/.test(ch) ? 0.3 : 0.52
function wrap(text, size, maxW, maxLines) {
  const lines = []; let line = '', w = 0
  for (const word of text.split(/\s+/)) {
    const ww = [...word].reduce((a, c) => a + wide(c) * size, 0), sp = wide(' ') * size
    if (line && w + sp + ww > maxW) { lines.push(line); line = word; w = ww } else { w += (line ? sp : 0) + ww; line = line ? line + ' ' + word : word }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) { const cut = lines.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + '...'; return cut }
  return lines
}

export function ogSvg(site, { title, desc }) {
  const c = site.theme.colors.dark
  const fam = site.og?.fontFamily || [].concat(site.theme.fonts.header)[0]
  const size = title.length > 70 ? 54 : title.length > 40 ? 64 : 76
  const tl = wrap(title, size, 980, 3), dl = desc ? wrap(desc, 30, 1000, 2) : []
  const y0 = 230
  const t = tl.map((s, i) => `<text x="100" y="${y0 + i * size * 1.18}" font-size="${size}" font-weight="700" fill="${c.dark}">${esc(s)}</text>`).join('')
  const dy = y0 + tl.length * size * 1.18 + 20
  const d = dl.map((s, i) => `<text x="100" y="${dy + i * 40}" font-size="30" fill="${c.gray}">${esc(s)}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${esc(fam)}, 'Noto Serif Bengali', 'Noto Serif', serif">
<rect width="1200" height="630" fill="${c.light}"/><rect x="0" y="0" width="16" height="630" fill="${c.secondary}"/>
<text x="100" y="110" font-size="30" fill="${c.secondary}" font-weight="600">${esc(site.title)}</text>${t}${d}
<text x="100" y="570" font-size="26" fill="${c.gray}">${esc(site.baseUrl)}</text>
<rect x="1060" y="490" width="80" height="80" rx="16" fill="${site.icon.bg}"/><text x="1100" y="548" font-size="52" text-anchor="middle" fill="${site.icon.fg}" font-weight="700">${esc(site.icon.text)}</text></svg>`
}

// System-font scanning costs ~200 ms per render; explicit files cost ~20 ms. Defaults: Noto Serif + Noto Serif Bengali if present.
const DEFAULT_FONTS = ['/usr/share/fonts/google-noto-vf/NotoSerif[wght].ttf', '/usr/share/fonts/google-noto-vf/NotoSerifBengali[wght].ttf', '/usr/share/fonts/google-noto-vf/NotoSansBengali[wght].ttf']
export const fontOpts = (site) => ({ fontFiles: [...DEFAULT_FONTS.filter((f) => fs.existsSync(f)), ...(site.og?.fontFiles ?? [])], loadSystemFonts: false, defaultFontFamily: 'Noto Serif' })

export const ogKey = (site, data) => hash('og2', site.name, data.title, data.desc || '', JSON.stringify(site.theme.colors.dark), site.icon.text, (site.og?.fontFiles ?? []).join())

/** Render all missing OG images in short-lived child processes (resvg leaks native memory otherwise). */
export async function ogRender(site, jobs, cache, { chunk = 100, par = 3 } = {}) {
  const todo = jobs.filter((j) => !fs.existsSync(cache + '/' + j.key + '.png'))
  if (!todo.length) return 0
  const { fork } = await import('node:child_process')
  const slim = { name: site.name, title: site.title, baseUrl: site.baseUrl, icon: site.icon, theme: { fonts: site.theme.fonts, colors: { dark: site.theme.colors.dark } }, og: site.og }
  const queue = []
  for (let i = 0; i < todo.length; i += chunk) queue.push(todo.slice(i, i + chunk))
  const run = (jobsChunk) => new Promise((res, rej) => {
    const c = fork(new URL('./og-worker.mjs', import.meta.url))
    c.on('message', () => {}); c.on('exit', (code) => (code ? rej(new Error('og worker exit ' + code)) : res()))
    c.send({ site: slim, jobs: jobsChunk, cache })
  })
  await Promise.all(Array.from({ length: par }, async () => { while (queue.length) await run(queue.shift()) }))
  return todo.length
}

export function iconSvg(site) {
  const { bg, fg, text } = site.icon, fam = site.icon.fontFamily || [].concat(site.theme.fonts.header)[0]
  const dk = site.icon.dark ?? { bg: fg, fg: bg } // dark browser chrome: invert so the icon stays visible
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><style>.b{fill:${bg}}.t{fill:${fg}}@media (prefers-color-scheme:dark){.b{fill:${dk.bg}}.t{fill:${dk.fg}}}</style><rect class="b" width="512" height="512" rx="${site.icon.round ?? 96}"/><text class="t" x="256" y="360" font-size="300" font-weight="700" text-anchor="middle" font-family="${esc(fam)}, 'Noto Serif Bengali', 'Noto Serif', serif">${esc(text)}</text></svg>`
}
export const iconPng = (site, px) =>
  new Resvg(iconSvg(site), { font: fontOpts(site), fitTo: { mode: 'width', value: px } }).render().asPng()

/** ICO container holding one PNG (valid for 16..256 px). */
export function ico(png, px) {
  const h = Buffer.alloc(22)
  h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4)
  h[6] = px; h[7] = px; h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18)
  return Buffer.concat([h, png])
}
