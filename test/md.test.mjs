import test from 'node:test'
import assert from 'node:assert/strict'
import GithubSlugger from 'github-slugger'
import { createMarkdown, preprocess } from '../src/md.mjs'

const pages = { 'Other Note': { slug: 'Notes/Other-Note' } }
const md = createMarkdown({ resolve: (t) => pages[t] ?? null, assetUrl: (t) => (/\.png$/.test(t) ? '/img/' + t : null) })
const r = (s) => md.render(preprocess(s), { slugger: new GithubSlugger(), links: new Set(), page: { slug: 'x' } })

test('wikilinks, alias, anchor, broken', () => {
  assert.match(r('[[Other Note]]'), /href="\/Notes\/Other-Note" class="internal"/)
  assert.match(r('[[Other Note|alias]]'), />alias</)
  assert.match(r('[[Other Note#^sec-5|s]]'), /href="\/Notes\/Other-Note#\^sec-5"/)
  assert.match(r('[[Missing]]'), /broken/)
})
test('callout, fold, highlight, tag, comment', () => {
  assert.match(r('> [!note] Title\n> body'), /class="callout note"[\s\S]*Title[\s\S]*body/)
  assert.match(r('> [!tip]- Folded\n> x'), /<details class="callout tip"/)
  assert.match(r('a ==hot== b'), /<mark>hot<\/mark>/)
  assert.match(r('see #logic/fallacy now'), /class="tag-link">#logic\/fallacy/)
  assert.doesNotMatch(r('x %%secret%% y'), /secret/)
})
test('math and footnotes', () => {
  assert.match(r('$x^2$'), /katex/)
  assert.match(r('$$\na=b\n$$'), /math-display/)
  assert.match(r('t[^1]\n\n[^1]: note'), /<h2 id="footnote-label">References/)
})
test('original list markers from the scraper comment', () => {
  const h = r('1. <!--n:(ক)--> one\n2. <!--n:(খ)--> two\n   1. <!--n:(১)--> nested\n')
  assert.match(h, /<ol class="xl xn">/)
  assert.match(h, /<span class="lm">\(ক\)<\/span><span class="lt">one<\/span>/)
  assert.match(h, /<span class="lm">\(১\)<\/span><span class="lt">nested<\/span>/)
  assert.doesNotMatch(h, /<!--/)
})
test('manual Footnotes heading is dropped, one section remains', () => {
  const h = r('text[^1]\n\n## Footnotes\n\n[^1]: note')
  assert.equal((h.match(/<h2/g) || []).length, 1)
})
test('heading levels are normalised when asked', () => {
  const m = createMarkdown({ resolve: () => null, assetUrl: () => null, normalizeHeadings: true })
  const h = m.render('##### A\n\ntext\n\n##### B\n\n###### C\n', { slugger: new GithubSlugger(), links: new Set(), page: { slug: 'x' } })
  assert.match(h, /<h2 id="a"/); assert.match(h, /<h3 id="c"/)
})
test('a heading with a wikilink keeps the link text in the contents list', () => {
  const env = { slugger: new GithubSlugger(), links: new Set(), page: { slug: 'x' } }
  const m = createMarkdown({ resolve: (t) => (t === 'canvas.c' ? { slug: 'canvas-c' } : null), assetUrl: () => null })
  m.render('### [[canvas.c]]:\n\ntext\n', env)
  assert.equal(env.toc[0].text, 'canvas.c:')
})
test('block id', () => assert.match(r('Para text ^abc-1'), /<p id="\^abc-1">Para text<\/p>/))
