// Child process: renders a chunk of OG images then exits, so resvg's native memory is returned to the OS.
import fs from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { ogSvg, fontOpts } from './og.mjs'

process.on('message', ({ site, jobs, cache }) => {
  fs.mkdirSync(cache, { recursive: true })
  for (const j of jobs) {
    const png = new Resvg(ogSvg(site, j), { font: fontOpts(site), fitTo: { mode: 'width', value: 1200 } }).render().asPng()
    fs.writeFileSync(cache + '/' + j.key + '.png', png)
  }
  process.send('done')
  process.exit(0)
})
