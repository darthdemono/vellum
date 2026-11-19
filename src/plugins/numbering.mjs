// Original list markers. The scraper writes Markdown ordered lists (1. 2. 3.) and keeps the real legal marker
// beside each item as an invisible comment:   1. <!--n:(ক)--> text
// Markdown renderers (Obsidian included) ignore the comment and show 1. 2. 3.; this plugin shows (ক) instead.
// The list structure (nesting, paragraphs, continuation lines) stays standard Markdown.
// markdown-it reads a line that starts with a comment as an HTML block, so it is turned back into a paragraph here.
const NOTE = /^<!--n:(.*?)-->[ \t]*([\s\S]*?)\n?$/

export default function numbering(md) {
  const esc = md.utils.escapeHtml
  md.core.ruler.after('block', 'orig_numbering', (state) => {
    const t = state.tokens
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'html_block') continue
      const m = NOTE.exec(t[i].content)
      if (!m) continue
      let k = i - 1
      while (k >= 0 && t[k].type !== 'list_item_open') k--
      if (k < 0 || t[k].level !== t[i].level - 1) continue
      const open = new state.Token('paragraph_open', 'p', 1), inl = new state.Token('inline', '', 0), close = new state.Token('paragraph_close', 'p', -1)
      open.level = t[i].level; inl.level = t[i].level + 1; close.level = t[i].level
      open.map = inl.map = t[i].map; open.block = inl.block = close.block = true
      open.hidden = close.hidden = true // legal lists are tight
      inl.content = `<span class="lm">${esc(m[1])}</span><span class="lt">${m[2]}</span>`
      inl.children = []
      t.splice(i, 1, open, inl, close)
      t[k].attrJoin('class', 'xli')
      let j = k - 1
      while (j >= 0 && !(t[j].type === 'ordered_list_open' && t[j].level === t[k].level - 1)) j--
      if (j >= 0) t[j].attrSet('class', 'xl xn')
      i += 2
    }
  })
}
