// $inline$ and $$display$$ math rendered at build time with KaTeX (no client JS; CSS only on pages that use it).
import katex from 'katex'

const render = (tex, display, env) => {
  if (env) env.hasMath = true
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml' })
}

export default function math(md) {
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const src = state.src, pos = state.pos
    if (src.charCodeAt(pos) !== 0x24) return false
    const display = src.charCodeAt(pos + 1) === 0x24
    const open = display ? 2 : 1
    let end = pos + open
    for (;;) {
      end = src.indexOf(display ? '$$' : '$', end)
      if (end < 0) return false
      if (src.charCodeAt(end - 1) !== 0x5c) break
      end++
    }
    const tex = src.slice(pos + open, end)
    if (!tex.trim() || (!display && (/^\s|\s$/.test(tex) || /\d/.test(src[end + 1] ?? '') || tex.includes('\n\n')))) return false
    if (!silent) { const t = state.push('html_inline', '', 0); t.content = render(tex, display, state.env) }
    state.pos = end + open
    return true
  })
  md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    if (state.src.slice(start, start + 2) !== '$$') return false
    let line = startLine, text = state.src.slice(start + 2, state.eMarks[startLine])
    let closed = text.trimEnd().endsWith('$$') && text.trim().length > 2
    if (closed) text = text.trimEnd().slice(0, -2)
    else {
      const rows = [text]
      for (line = startLine + 1; line < endLine; line++) {
        const l = state.src.slice(state.bMarks[line], state.eMarks[line])
        if (l.trimEnd().endsWith('$$')) { rows.push(l.trimEnd().slice(0, -2)); closed = true; break }
        rows.push(l)
      }
      text = rows.join('\n')
    }
    if (!closed) return false
    if (silent) return true
    const t = state.push('html_block', '', 0)
    t.content = '<div class="math-display">' + render(text, true, state.env) + '</div>\n'
    t.map = [startLine, line + 1]
    state.line = line + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
}
