import { hrefOf } from './util.mjs'

/** Per-page markdown: raw frontmatter, H1, body, with a "## References" heading restored before footnote definitions. */
export function pageLlms(p) {
  let body = p.body.replace(/\r\n/g, '\n').trim()
  const fn = body.match(/(?:^|\n)\[\^[^\]]+\]:/)
  if (fn && !/(?:^|\n)#{1,6}\s+References\s*(?:\n|$)/.test(body)) {
    const i = fn.index + (fn[0].startsWith('\n') ? 1 : 0)
    body = body.slice(0, i).replace(/\n+$/, '') + '\n\n## References\n\n' + body.slice(i)
  }
  return (p.fmRaw ? p.fmRaw + '\n' : '') + '# ' + p.title + '\n' + body + '\n'
}

/** /llms.txt index (llmstxt.org shape): title, summary, then links grouped by top-level folder. */
export function siteLlms(site, pages) {
  const base = 'https://' + site.baseUrl
  const groups = new Map()
  for (const p of pages) {
    if (p.generated) continue
    const g = p.slug.includes('/') ? p.slug.split('/')[0].replace(/-/g, ' ') : 'Pages'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(p)
  }
  let out = `# ${site.title}\n\n> ${site.description || site.title}\n\n${site.disclosure ? 'Notice: ' + site.disclosure.short + ' See ' + base + '/about\n\n' : ''}Every page is also available as plain Markdown at <page-url>/llms.txt.\n`
  for (const [g, ps] of groups) {
    out += `\n## ${g}\n\n`
    for (const p of ps) out += `- [${p.title}](${base}/${p.slug}/llms.txt)${p.desc ? ': ' + p.desc.replace(/\s+/g, ' ').slice(0, 160) : ''}\n`
  }
  return out
}

export function siteLlmsFull(site, pages) {
  const base = 'https://' + site.baseUrl
  let out = `# ${site.title}\n\n> ${site.description || ''}\n\nWebsite: ${base}\n\n`
  for (const p of pages) {
    if (p.generated) continue
    out += `## ${p.title}\n\nURL: ${base}${hrefOf(p.slug)}\n${p.tags?.length ? 'Tags: ' + p.tags.join(', ') + '\n' : ''}\n${p.body.trim()}\n\n---\n\n`
  }
  return out
}
