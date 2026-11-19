import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import extlists from '../src/plugins/extlists.mjs'

const md = new MarkdownIt({ html: true }).use(extlists)
const markers = (src) => [...md.render(src).matchAll(/<span class="lm">([^<]*)<\/span>/g)].map((m) => m[1])

test('multi-level numeric and letter', () => {
  assert.deepEqual(markers('1.1. First\n1.2. Second\n1.A. Third\n'), ['1.1.', '1.2.', '1.A.'])
})
test('parenthesised, Latin and Bengali', () => {
  assert.deepEqual(markers('(1) a\n(1A) b\n(13AA) c\n(ক) d\n(১ক) e\n'), ['(1)', '(1A)', '(13AA)', '(ক)', '(১ক)'])
})
test('bengali letters and digits', () => {
  assert.deepEqual(markers('১) এক\nক) দুই\nখ) তিন\n'), ['১)', 'ক)', 'খ)'])
  assert.deepEqual(markers('৪৪. একটি\n৪৫. আরেকটি\n'), ['৪৪.', '৪৫.'])
})
test('lone ambiguous markers stay prose', () => {
  assert.deepEqual(markers('A. Smith wrote this.\n'), [])
  assert.deepEqual(markers('i. one\nii. two\n'), ['i.', 'ii.'])
})
test('nesting by indentation and lazy continuation', () => {
  const html = md.render('(1) Parent text\ncontinues here\n    (a) child one\n    (b) child two\n(2) Next\n')
  assert.deepEqual(markers('(1) Parent text\ncontinues here\n    (a) child one\n    (b) child two\n(2) Next\n'), ['(1)', '(a)', '(b)', '(2)'])
  assert.match(html, /continues here/)
  assert.equal((html.match(/<ol class="xl">/g) || []).length, 2)
})
test('plain CommonMark lists untouched', () => {
  assert.deepEqual(markers('1. one\n2. two\n'), [])
  assert.match(md.render('1. one\n2. two\n'), /<ol>/)
})
