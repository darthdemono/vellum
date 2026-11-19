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
test('block id', () => assert.match(r('Para text ^abc-1'), /<p id="\^abc-1">Para text<\/p>/))
