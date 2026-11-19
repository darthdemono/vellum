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
  assert.match(r('by the [[[Other Note|x]] act'), /href="\/Notes\/Other-Note"/) // stray "[" in front
})
test('a space before the pipe does not break a wikilink', () => {
  assert.match(r('[[Other Note \\|shown]]'), /href="\/Notes\/Other-Note" class="internal"[^>]*>shown/)
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
test('a footnote followed by (a) is not a link', () => {
  const h = r('text.[^1](১ক) more\n\n[^1]: note')
  assert.match(h, /footnote-ref/)
  assert.doesNotMatch(h, /<a href="১ক"/)
})
test('a heading block id becomes an anchor and keeps its slug id', () => {
  const env = { slugger: new GithubSlugger(), links: new Set(), page: { slug: 'x' } }
  const h = md.render('##### Section 3: Title ^sec-3\n', env)
  assert.match(h, /<h5 id="section-3-title"><span id="\^sec-3"><\/span>Section 3: Title<\/h5>/)
})
test('a note with its own h1 still ends up with one h1', () => {
  const h = md.render('# Inner title\n\ntext\n', { slugger: new GithubSlugger(), links: new Set(), page: { slug: 'x' } })
  assert.doesNotMatch(h, /<h1/); assert.match(h, /<h2 id="inner-title"/)
})
test('block id', () => assert.match(r('Para text ^abc-1'), /<p id="\^abc-1">Para text<\/p>/))

test('word markers get the ragged list class', () => {
  assert.match(r('1. <!--n:Firstly--> a\n2. <!--n:Secondly--> b\n'), /class="xl xn xw"/)
  assert.doesNotMatch(r('1. <!--n:(a)--> a\n2. <!--n:(b)--> b\n'), /xw/)
})
