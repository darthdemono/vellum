import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import extlists from './plugins/extlists.mjs'
import obsidian from './plugins/obsidian.mjs'
import math from './plugins/math.mjs'
import numbering from './plugins/numbering.mjs'
import { esc } from './util.mjs'

/** Build a markdown-it instance. highlight(code, lang) is optional (shiki). */
export function createMarkdown({ resolve, assetUrl, highlight, footnoteLabel = 'References', extlist = {}, normalizeHeadings = false }) {
  const md = new MarkdownIt({
    html: true, linkify: true, typographer: false,
    highlight: highlight ? (code, lang) => (lang && lang !== 'mermaid' ? highlight(code, lang) : '') : undefined,
  })
  md.use(footnote).use(extlists, extlist).use(math).use(numbering).use(obsidian, { resolve, assetUrl })
  md.renderer.rules.footnote_block_open = () => `<hr class="footnotes-sep">\n<section class="footnotes" data-footnotes><h2 id="footnote-label">${esc(footnoteLabel)}</h2>\n<ol class="footnotes-list">\n`
  md.renderer.rules.footnote_anchor = (tokens, idx, options, env, slf) => {
    let id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf)
    if (tokens[idx].meta.subId > 0) id += ':' + tokens[idx].meta.subId
    return ` <a href="#fnref${id}" class="footnote-backref" aria-label="Back to content">\u{21A9}\u{FE0E}</a>`
  }
  md.core.ruler.push('heading_ids', (state) => {
    state.env.toc = []
    let remap = null
    if (normalizeHeadings) {
      const lv = [...new Set(state.tokens.filter((x) => x.type === 'heading_open').map((x) => +x.tag.slice(1)))].sort((a, b) => a - b)
      const base = lv[0] === 1 ? 1 : 2
      remap = new Map(lv.map((l, n) => [l, Math.min(6, base + n)]))
    }
    for (let i = 0; i < state.tokens.length; i++) {
      const t = state.tokens[i]
      if (t.type !== 'heading_open') continue
      if (remap) { const nl = 'h' + remap.get(+t.tag.slice(1)); t.tag = nl; state.tokens[i + 2].tag = nl }
      const inl = state.tokens[i + 1]
      // link text counts too: wikilinks are inline HTML (<a>text</a>), so strip the tags and keep the words
      const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      const text = inl.children?.filter((c) => c.type === 'text' || c.type === 'code_inline' || c.type === 'html_inline').map((c) => (c.type === 'html_inline' ? plain(c.content) : c.content)).join('') ?? inl.content
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
// A manual "## Footnotes" / "## References" heading before the [^n]: definitions is for Obsidian; the renderer prints its own section.
export const preprocess = (body) => body.replace(/\r\n/g, '\n').replace(/%%[\s\S]*?%%/g, '').replace(/^#{1,6}[ \t]+(?:Footnotes?|References)[ \t]*\n+(?=\[\^)/gm, '')
