import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadSite } from '../src/site.mjs'
import { build } from '../src/build.mjs'

test('example vault builds: pages, llms, og, icons, lists, gzip, no stale files', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vellum-'))
  const site = await loadSite(new URL('../examples/site.config.mjs', import.meta.url).pathname)
  site.out = path.join(tmp, 'out'); site.cache = path.join(tmp, 'cache')
  const r = await build(site, { log() {} })
  const f = (p) => fs.readFileSync(path.join(site.out, p), 'utf8')
  assert.ok(r.stats.written > 20)
  assert.match(f('Lists.html'), /class="lm">\(1A\)/)
  assert.match(f('Lists.html'), /class="lm">ক\)/)
  assert.match(f('Callouts-and-math.html'), /class="callout tip"/)
  assert.match(f('Callouts-and-math.html'), /katex/)
  assert.match(f('Callouts-and-math.html'), /shiki/)
  assert.match(f('Notes/Linking.html'), /id="\^target"/)
  assert.match(f('links.html'), /refresh/)
  assert.match(f('Lists/llms.txt'), /^---\ntitle: Lists/)
  assert.match(f('llms.txt'), /^# Example/)
  assert.match(f('Callouts-and-math/llms.txt'), /## References/)
  assert.ok(fs.statSync(path.join(site.out, 'og/Lists.png')).size > 5000)
  assert.ok(fs.existsSync(path.join(site.out, 'index.html.gz')))
  fs.writeFileSync(path.join(site.out, 'stale.html'), 'x')
  const r2 = await build(site, { log() {} })
  assert.equal(r2.stats.written, 0, 'second build rewrites nothing')
  assert.ok(!fs.existsSync(path.join(site.out, 'stale.html')))
})
