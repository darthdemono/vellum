import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import extlists from './plugins/extlists.mjs'
import obsidian from './plugins/obsidian.mjs'
import math from './plugins/math.mjs'
import { esc } from './util.mjs'

/** Build a markdown-it instance. highlight(code, lang) is optional (shiki). */
export function createMarkdown({ resolve, assetUrl, highlight, footnoteLabel = 'References', extlist = {} }) {
  const md = new MarkdownIt({
    html: true, linkify: true, typographer: false,
    highlight: highlight ? (code, lang) => (lang && lang !== 'mermaid' ? highlight(code, lang) : '') : undefined,
  })
  md.use(footnote).use(extlists, extlist).use(math).use(obsidian, { resolve, assetUrl })
  md.renderer.rules.footnote_block_open = () => `<hr class="footnotes-sep">\n<section class="footnotes" data-footnotes><h2 id="footnote-label">${esc(footnoteLabel)}</h2>\n<ol class="footnotes-list">\n`
  md.renderer.rules.footnote_anchor = (tokens, idx, options, env, slf) => {
    let id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf)
    if (tokens[idx].meta.subId > 0) id += ':' + tokens[idx].meta.subId
    return ` <a href="#fnref${id}" class="footnote-backref" aria-label="Back to content">\u{21A9}\u{FE0E}</a>`
  }
  md.core.ruler.push('heading_ids', (state) => {
    state.env.toc = []
    for (let i = 0; i < state.tokens.length; i++) {
      const t = state.tokens[i]
      if (t.type !== 'heading_open') continue
      const inl = state.tokens[i + 1]
      const text = inl.children?.filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('') ?? inl.content
      const id = state.env.slugger ? state.env.slugger.slug(text) : text
      t.attrSet('id', id)
      state.env.toc.push({ depth: +t.tag.slice(1), text, id })
    }
  })
  const fence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const t = tokens[idx]
    if (t.info.trim().split(/\s/)[0] === 'mermaid') {
      env.hasMermaid = true
      return `<pre class="mermaid-src"><code class="language-mermaid">${esc(t.content)}</code></pre>\n`
    }
    return fence(tokens, idx, options, env, slf)
  }
  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n'
  md.renderer.rules.table_close = () => '</table></div>\n'
  return md
}

/** Strip %%comments%%, normalise CRLF. */
export const preprocess = (body) => body.replace(/\r\n/g, '\n').replace(/%%[\s\S]*?%%/g, '')
