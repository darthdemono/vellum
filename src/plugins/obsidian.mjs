// Obsidian-flavoured syntax: [[wikilinks]], ![[embeds]], > [!callouts], ==highlight==, #tags, %%comments%%, ^block-ids.
import { hrefOf, esc } from '../util.mjs'
import GithubSlugger from 'github-slugger'

const IMG = /\.(png|jpe?g|gif|svg|webp|avif|bmp)$/i
// \| is an escaped pipe (Obsidian writes it inside tables); it separates the alias like a plain |
const WIKI = /^\[\[([^\[\]|#\\]*)(?:#([^\]|\\]*))?\\?(?:\|([^\]]*))?\]\]/

// default callout titles on a Bengali page (page front matter: language: bn)
const CALLOUT_BN = { explanation: 'ব্যাখ্যা', illustration: 'দৃষ্টান্ত', illustrations: 'দৃষ্টান্ত', exception: 'ব্যতিক্রম', exceptions: 'ব্যতিক্রম', definition: 'সংজ্ঞা', preamble: 'প্রস্তাবনা', note: 'টীকা', info: 'তথ্য', warning: 'সতর্কতা' }

export const headingId = (text) => new GithubSlugger().slug(text)

export default function obsidian(md, { resolve, assetUrl, tagBase = '/tags/' }) {
  // Page-aware state lives in env: env.page, env.links (Set of slugs), env.hasMath, env.hasMermaid.
  function wikilink(state, silent) {
    const src = state.src, pos = state.pos
    if (src.charCodeAt(pos) !== 0x5b && !(src.charCodeAt(pos) === 0x21 && src.charCodeAt(pos + 1) === 0x5b)) return false
    const embed = src.charCodeAt(pos) === 0x21
    const m = WIKI.exec(src.slice(pos + (embed ? 1 : 0)))
    if (!m) return false
    if (!silent) {
      const [raw, rawTarget, anchor, alias] = m
      const target = rawTarget.trim() // Obsidian allows "[[Note \|alias]]"
      const env = state.env
      let tok
      if (embed && IMG.test(target)) {
        const a = assetUrl(target)
        tok = state.push('html_inline', '', 0)
        const size = alias && /^\d+(x\d+)?$/.test(alias) ? alias.split('x') : null
        const alt = size ? target : alias || target
        tok.content = a
          ? `<img src="${esc(a)}" alt="${esc(alt)}" loading="lazy"${size ? ` width="${size[0]}"${size[1] ? ` height="${size[1]}"` : ''}` : ''}>`
          : `<span class="broken">${esc(target)}</span>`
      } else if (embed && /\.pdf$/i.test(target)) {
        tok = state.push('html_inline', '', 0)
        const a = assetUrl(target)
        tok.content = a ? `<iframe src="${esc(a)}" class="pdf" loading="lazy"></iframe>` : esc(target)
      } else {
        const page = target ? resolve(target, env.page) : env.page
        const shown = alias ?? (target || '') + (anchor ? (target ? ' > ' : '') + anchor.replace(/^\^/, '') : '')
        tok = state.push('html_inline', '', 0)
        if (page) {
          env.links?.add(page.slug)
          const hash = anchor ? '#' + (anchor.startsWith('^') ? anchor : headingId(anchor)) : ''
          tok.content = `<a href="${esc(hrefOf(page.slug) + hash)}" class="internal" data-slug="${esc(page.slug)}">${esc(shown)}</a>`
        } else if (target && assetUrl(target)) tok.content = `<a href="${esc(assetUrl(target))}" class="internal">${esc(shown)}</a>`
        else tok.content = `<span class="internal broken" title="Not found">${esc(shown)}</span>`
      }
    }
    state.pos += m[0].length + (embed ? 1 : 0)
    return true
  }

  function highlight(state, silent) {
    const src = state.src, pos = state.pos
    if (src.charCodeAt(pos) !== 0x3d || src.charCodeAt(pos + 1) !== 0x3d) return false
    const end = src.indexOf('==', pos + 2)
    if (end < 0 || end === pos + 2 || src.slice(pos + 2, end).includes('\n')) return false
    if (!silent) {
      state.push('mark_open', 'mark', 1)
      const oldMax = state.posMax
      state.pos = pos + 2; state.posMax = end
      state.md.inline.tokenize(state)
      state.pos = end; state.posMax = oldMax
      state.push('mark_close', 'mark', -1)
    }
    state.pos = end + 2
    return true
  }

  function tag(state, silent) {
    const src = state.src, pos = state.pos
    if (src.charCodeAt(pos) !== 0x23) return false
    if (pos > 0 && !/\s|[(>]/.test(src[pos - 1])) return false
    const m = /^#([\p{L}\p{N}_\/-]*[\p{L}_\/-][\p{L}\p{N}_\/-]*)/u.exec(src.slice(pos))
    if (!m) return false
    if (!silent) {
      const t = state.push('html_inline', '', 0)
      state.env.inlineTags?.add(m[1])
      t.content = `<a href="${tagBase}${esc(m[1])}" class="tag-link">#${esc(m[1])}</a>`
    }
    state.pos += m[0].length
    return true
  }

  md.inline.ruler.before('link', 'wikilink', wikilink)
  md.inline.ruler.before('emphasis', 'highlight', highlight)
  md.inline.ruler.push('obs_tag', tag)

  // Callouts, after block parsing
  md.core.ruler.after('block', 'callouts', (state) => {
    const toks = state.tokens
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]
      if (t.type === 'blockquote_open' && toks[i + 1]?.type === 'paragraph_open' && toks[i + 2]?.type === 'inline') {
        const inl = toks[i + 2]
        const m = /^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)(?:\n|$)/.exec(inl.content)
        if (!m) continue
        const [whole, type, fold, rawTitle] = m
        const title = rawTitle || (state.env.page?.fm?.language === 'bn' && CALLOUT_BN[type.toLowerCase()]) || type.charAt(0).toUpperCase() + type.slice(1)
        let j = i + 1, depth = 0
        for (; j < toks.length; j++) {
          if (toks[j].type === 'blockquote_open') depth++
          if (toks[j].type === 'blockquote_close' && --depth < 0) break
        }
        const close = toks[j]
        const det = fold !== ''
        t.tag = det ? 'details' : 'div'; close.tag = t.tag
        t.attrSet('class', 'callout ' + type.toLowerCase()); t.attrSet('data-callout', type.toLowerCase())
        if (fold === '+') t.attrSet('open', '')
        inl.content = inl.content.slice(whole.length)
        const head = new state.Token('html_block', '', 0)
        const inner = state.md.renderInline(title, state.env)
        head.content = (det ? '<summary' : '<div') + ' class="callout-title"><span class="callout-icon"></span><span class="callout-title-inner">' + inner + '</span></' + (det ? 'summary' : 'div') + '>\n<div class="callout-content">\n'
        const tail = new state.Token('html_block', '', 0); tail.content = '</div>\n'
        if (!inl.content.trim()) toks.splice(i + 1, 3, head)
        else toks.splice(i + 1, 0, head)
        toks.splice(toks.indexOf(close), 0, tail)
      }
    }
  })

  md.core.ruler.after('inline', 'blockids', (state) => {
    const toks = state.tokens
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]
      if (t.type !== 'inline') continue
      const m = /(?:^|\s)\^([A-Za-z0-9-]+)$/.exec(t.content)
      if (!m) continue
      t.content = t.content.slice(0, m.index)
      const last = t.children?.[t.children.length - 1]
      if (last?.type === 'text') last.content = last.content.replace(/\s*\^[A-Za-z0-9-]+$/, '')
      const open = toks[i - 1]
      if (open?.type === 'heading_open') {
        // the heading's own id is its slug (set later), so the block id goes on an empty anchor inside it
        const a = new state.Token('html_inline', '', 0)
        a.content = '<span id="^' + esc(m[1]) + '"></span>'
        t.children.unshift(a)
      } else if (open?.type === 'paragraph_open' && open.hidden && toks[i - 2]?.type === 'list_item_open') toks[i - 2].attrSet('id', '^' + m[1]) // a tight list item: the id goes on the <li>
      else if (open && /_open$/.test(open.type)) open.attrSet('id', '^' + m[1])
    }
  })

  // Standard links: external get rel/class, relative .md links resolve to pages.
  const defLink = md.renderer.rules.link_open || ((tk, i, o, e, s) => s.renderToken(tk, i, o))
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const t = tokens[idx]
    const href = t.attrGet('href') || ''
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      if (!/^(mailto|tel):/i.test(href)) { t.attrSet('class', 'external'); t.attrSet('rel', 'noopener') }
    } else if (!href.startsWith('#') && !href.startsWith('/')) {
      const [p, h] = decodeURI(href).split('#')
      if (/\.md$/i.test(p)) {
        const page = resolve(p, env.page)
        if (page) { env.links?.add(page.slug); t.attrSet('href', hrefOf(page.slug) + (h ? '#' + headingId(h) : '')); t.attrSet('class', 'internal') }
      }
    }
    return defLink(tokens, idx, options, env, self)
  }
  const defImg = md.renderer.rules.image || ((tk, i, o, e, s) => s.renderToken(tk, i, o))
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const t = tokens[idx]
    const src = t.attrGet('src') || ''
    if (!/^([a-z]+:|\/\/|\/)/i.test(src)) { const u = assetUrl(decodeURI(src)); if (u) t.attrSet('src', u) }
    t.attrSet('loading', 'lazy')
    return defImg(tokens, idx, options, env, self)
  }
}
