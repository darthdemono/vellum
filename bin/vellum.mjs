#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadSite } from '../src/site.mjs'
import { build } from '../src/build.mjs'

if (process.argv[2] === '--version') { console.log(JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version); process.exit(0) }
const [cmd, cfgPath, ...rest] = process.argv.slice(2)
const usage = 'usage: vellum <build|serve|check|deploy> <site.config.mjs> [--dry] [--port N]'
if (!cmd || !cfgPath) { console.error(usage); process.exit(2) }
const site = await loadSite(cfgPath)

if (cmd === 'build' || cmd === 'check') {
  const r = await build(site)
  if (r.broken.length) console.log(`${r.broken.length} unresolved wikilinks${cmd === 'check' ? ':\n' + r.broken.slice(0, 50).join('\n') : ' (run check to list)'}`)
} else if (cmd === 'serve') {
  await build(site)
  const port = +(rest[rest.indexOf('--port') + 1] || 8080)
  const types = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', json: 'application/json', txt: 'text/plain; charset=utf-8', xml: 'application/xml', svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', webmanifest: 'application/manifest+json', woff2: 'font/woff2', woff: 'font/woff' }
  http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split('?')[0])
    for (const f of [u, u + '.html', path.join(u, 'index.html'), '/404.html']) {
      const abs = path.join(site.out, f)
      if (abs.startsWith(site.out) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        s.writeHead(f === '/404.html' ? 404 : 200, { 'content-type': types[f.split('.').pop()] ?? 'application/octet-stream' })
        return fs.createReadStream(abs).pipe(s)
      }
    }
    s.writeHead(404).end('not found')
  }).listen(port, () => console.log(`http://localhost:${port}`))
} else if (cmd === 'deploy') {
  if (!site.deploy) throw new Error('no deploy {host, dir} in ' + cfgPath)
  await build(site)
  const dry = rest.includes('--dry')
  const args = ['-rltz', '--delete', '--omit-dir-times', '--chmod=D755,F644', ...(dry ? ['-n', '-i'] : []), site.out + '/', `${site.deploy.host}:${site.deploy.dir}/`]
  const r = spawnSync('rsync', args, { stdio: 'inherit' })
  if (r.status) process.exit(r.status)
  if (!dry && site.deploy.check) {
    const res = await fetch(site.deploy.check)
    console.log(res.status, site.deploy.check)
    if (res.status !== 200) process.exit(1)
  }
} else { console.error(usage); process.exit(2) }
