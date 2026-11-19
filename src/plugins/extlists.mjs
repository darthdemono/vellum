// Extended list markers for markdown-it: legal-style numbering CommonMark does not know.
//   (1) (1A) (13AA) (a) (aa) (a1) (i) (iv)    parenthesised, Latin or Bengali
//   ১) ক) a) 1A)                              right-paren forms
//   1.1.  1.2.3  1.A.  1.A                    multi-level, dotted
//   ক. খ.  ১. ২.  A. B.  i. ii.               letters, Bengali digits, roman
// Markers are kept as literal text (legal numbering is data, never recomputed).
// Items nest by indentation; lines that are not indented continue the item (lazy), like a paragraph.
const BN = '০-৯', BL = 'ক-হ'
const DIG = `[0-9${BN}]`
const ALNUM = `[0-9${BN}A-Za-z${BL}]`
const MARK_SRC = [
  `${DIG}+(?:\\.${ALNUM}+)+\\.`,                 // 1.1.  1.A.  1.2.3.
  `${DIG}+(?:\\.${ALNUM}+){2,}`,                 // 1.2.3
  `[0-9]+\\.[A-Za-z${BL}](?![A-Za-z${BL}])`,       // 1.A
  `\\((?:${DIG}+[A-Za-z${BL}]*|[A-Za-z]{1,2}[0-9]?|[ivxlcdm]{1,6}|[IVXLCDM]{1,6}|[${BL}]{1,2})\\)`, // (1A) (aa) (iv) (ক)
  `${DIG}*[${BN}]${DIG}*[A-Za-z${BL}]*\\)`,      // ১)  ১ক)
  `[0-9]+[A-Za-z${BL}]+\\)`,                       // 1A)
  `[${BL}][.)]`,                                    // ক. ক)
  `[${BN}]+\\.`,                                   // ১.
  `[A-Za-z]\\)`, `[ivxlcdmIVXLCDM]{1,6}\\.`, `[A-Za-z]\\.`, // ambiguous: need two items
]
const NODOT = `${DIG}+\\.${DIG}+`
const AMBIG = /^(?:[A-Za-z]\)|[ivxlcdmIVXLCDM]{1,6}\.|[A-Za-z]\.|[0-9]+\.[0-9]+)$/

export const makeMarkRe = ({ numericNoDot = false } = {}) =>
  new RegExp('^(' + (numericNoDot ? [NODOT, ...MARK_SRC] : MARK_SRC).join('|') + ')(?=[ \\t]+\\S|[ \\t]*$)')

export default function extlists(md, opts = {}) {
  const MARK = makeMarkRe(opts)
  const esc = md.utils.escapeHtml

  function rule(state, startLine, endLine, silent) {
    const text = (i) => state.src.slice(state.bMarks[i] + state.tShift[i], state.eMarks[i])
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    const first = MARK.exec(text(startLine))
    if (!first) return false
    if (silent) return !AMBIG.test(first[1])
    const base = state.sCount[startLine]
    const terminators = state.md.block.ruler.getRules('paragraph')
    const items = []
    let line = startLine, loose = false

    while (line < endLine) {
      const m = MARK.exec(text(line))
      if (!m || state.sCount[line] !== base) break
      const body = [text(line).slice(m[0].length).trim()]
      const cont = []
      let next = line + 1, last = line
      while (next < endLine) {
        if (state.isEmpty(next)) {
          let k = next
          while (k < endLine && state.isEmpty(k)) k++
          if (k >= endLine) break
          if (state.sCount[k] > base) { for (let j = next; j < k; j++) cont.push(''); next = k; loose = true; continue }
          if (MARK.test(text(k)) && state.sCount[k] === base) loose = true
          break
        }
        const sc = state.sCount[next]
        if (sc <= base) {
          if (MARK.test(text(next)) && sc === base) break
          if (cont.length && cont[cont.length - 1] === '') break
          let stop = false
          for (const t of terminators) if (t(state, next, endLine, true)) { stop = true; break }
          if (stop) break
          cont.push(text(next)); last = next; next++; continue
        }
        cont.push(state.src.slice(state.bMarks[next], state.eMarks[next]).replace(/\t/g, '    ')); last = next; next++
      }
      // dedent indented continuation lines by their common indent
      const ind = cont.filter((l) => l && /^ /.test(l)).map((l) => l.match(/^ */)[0].length)
      const cut = ind.length ? Math.min(...ind) : 0
      for (const l of cont) body.push(cut && /^ /.test(l) ? l.slice(cut) : l)
      items.push({ marker: m[1], src: body.join('\n'), end: last + 1 })
      line = Math.max(next, last + 1)
      while (line < endLine && state.isEmpty(line)) line++
      if (line < endLine && !(MARK.test(text(line)) && state.sCount[line] === base)) { line = items[items.length - 1].end; break }
    }
    if (!items.length) return false
    if (items.length < 2 && AMBIG.test(items[0].marker)) return false

    const open = state.push('ordered_list_open', 'ol', 1)
    open.attrSet('class', 'xl'); open.markup = 'ext'; open.map = [startLine, items[items.length - 1].end]
    for (const it of items) {
      const li = state.push('list_item_open', 'li', 1)
      li.markup = it.marker; li.map = [startLine, it.end]
      const tag = `<span class="lm">${esc(it.marker)}</span> `
      const tokens = []
      state.md.block.parse(it.src, state.md, state.env, tokens)
      const firstTok = tokens[0]
      if (firstTok && firstTok.type === 'paragraph_open' && tokens[1]?.type === 'inline') {
        tokens[1].content = tag + tokens[1].content
      } else {
        const po = new state.Token('paragraph_open', 'p', 1), il = new state.Token('inline', '', 0), pc = new state.Token('paragraph_close', 'p', -1)
        il.content = tag.trim(); il.children = []; po.block = pc.block = il.block = true
        tokens.unshift(po, il, pc)
      }
      if (!loose) for (const t of tokens) if (t.level === 0 && (t.type === 'paragraph_open' || t.type === 'paragraph_close')) t.hidden = true
      for (const t of tokens) { t.level += state.level + 1; state.tokens.push(t) }
      state.push('list_item_close', 'li', -1)
    }
    state.push('ordered_list_close', 'ol', -1)
    state.line = items[items.length - 1].end
    return true
  }
  md.block.ruler.before('list', 'extlist', rule, { alt: ['paragraph', 'reference', 'blockquote'] })
}
