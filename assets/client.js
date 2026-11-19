// vellum client: theme, reader mode, search, copy-as-markdown, link previews, TOC spy, lazy explorer. No framework.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const root = document.documentElement
  const setTheme = (t) => { root.dataset.theme = t; try { localStorage.setItem('theme', t) } catch {} }
  $('#theme')?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'))
  $('#reader')?.addEventListener('click', () => document.body.classList.toggle('reader'))

  // copy page as markdown (per-page llms.txt)
  $('#copy-md')?.addEventListener('click', async (e) => {
    const b = e.currentTarget
    try { const r = await fetch(b.dataset.src); await navigator.clipboard.writeText(await r.text()); const o = b.textContent; b.textContent = 'Copied'; setTimeout(() => (b.textContent = o), 1500) } catch { location.href = b.dataset.src }
  })

  // search
  const dlg = $('#search'); let idx = null, sel = 0
  const open = async () => {
    dlg.classList.add('open'); $('input', dlg).focus()
    if (!idx) idx = await (await fetch('/search.json')).json()
  }
  const close = () => dlg.classList.remove('open')
  const run = (q) => {
    const out = $('ul', dlg); out.textContent = ''
    q = q.trim().toLowerCase(); if (!q || !idx) return
    const terms = q.split(/\s+/)
    const hits = []
    for (const p of idx) {
      const t = p.t.toLowerCase(), x = (p.x || '').toLowerCase(), g = (p.g || []).join(' ').toLowerCase()
      let s = 0
      for (const w of terms) { const a = t.includes(w) ? (t.startsWith(w) ? 12 : 8) : 0, b = g.includes(w) ? 4 : 0, c = x.includes(w) ? 1 : 0; if (!a && !b && !c) { s = 0; break } s += a + b + c }
      if (s) hits.push([s, p])
    }
    hits.sort((a, b) => b[0] - a[0]).slice(0, 12).forEach(([, p], i) => {
      const li = document.createElement('li'), a = document.createElement('a'), sm = document.createElement('small')
      a.href = p.u; a.textContent = p.t; sm.textContent = (p.x || '').slice(0, 110); if (i === 0) a.className = 'sel'
      a.append(sm); li.append(a); out.append(li)
    })
    sel = 0
  }
  $('.search-btn')?.addEventListener('click', open)
  $('input', dlg)?.addEventListener('input', (e) => run(e.target.value))
  dlg?.addEventListener('click', (e) => { if (e.target === dlg) close() })
  addEventListener('keydown', (e) => {
    if ((e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) || ((e.ctrlKey || e.metaKey) && e.key === 'k')) { e.preventDefault(); open() }
    if (!dlg?.classList.contains('open')) return
    if (e.key === 'Escape') close()
    const items = $$('a', dlg)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[sel]?.classList.remove('sel'); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; items[sel]?.classList.add('sel'); items[sel]?.scrollIntoView({ block: 'nearest' }) }
    if (e.key === 'Enter' && items[sel]) location.href = items[sel].href
  })

  // link previews (desktop, hover)
  if (matchMedia('(hover:hover) and (min-width:900px)').matches) {
    const pop = document.createElement('div'); pop.id = 'pop'; document.body.append(pop)
    const cache = new Map(); let timer
    document.addEventListener('mouseover', (e) => {
      const a = e.target.closest?.('a.internal'); if (!a || a.classList.contains('broken')) return
      timer = setTimeout(async () => {
        const url = new URL(a.href); if (url.origin !== location.origin) return
        let html = cache.get(url.pathname)
        if (html === undefined) {
          try { const d = new DOMParser().parseFromString(await (await fetch(url.pathname)).text(), 'text/html'); html = d.querySelector('article')?.innerHTML ?? '' } catch { html = '' }
          cache.set(url.pathname, html)
        }
        if (!html) return
        pop.innerHTML = html; const r = a.getBoundingClientRect()
        pop.style.left = Math.min(r.left, innerWidth - 430) + 'px'; pop.style.top = Math.min(r.bottom + 6, innerHeight - 300) + 'px'; pop.style.display = 'block'
      }, 250)
    })
    document.addEventListener('mouseout', (e) => { if (e.target.closest?.('a.internal')) { clearTimeout(timer); pop.style.display = 'none' } })
  }

  // TOC scroll spy
  const links = $$('.toc a'); if (links.length && 'IntersectionObserver' in window) {
    const map = new Map(links.map((a) => [a.hash.slice(1), a]))
    const io = new IntersectionObserver((es) => es.forEach((e) => { const a = map.get(e.target.id); if (a && e.isIntersecting) { links.forEach((l) => l.classList.remove('on')); a.classList.add('on') } }), { rootMargin: '0px 0px -75% 0px' })
    map.forEach((_, id) => { const h = document.getElementById(id); h && io.observe(h) })
  }

  // lazy explorer for big sites: tree.json is [name, slug|null, children?]
  const ex = $('#explorer-lazy')
  if (ex) fetch('/tree.json').then((r) => r.json()).then((tree) => {
    const cur = ex.dataset.slug
    const build = (nodes, path) => {
      const ul = document.createElement('ul')
      for (const [name, slug, kids] of nodes) {
        const li = document.createElement('li')
        if (kids) {
          const d = document.createElement('details'), s = document.createElement('summary')
          s.textContent = name; d.append(s)
          const open = slug && cur.startsWith(slug.replace(/\/index$/, '') + '/')
          if (open) d.open = true
          let built = false
          const fill = () => { if (!built) { built = true; d.append(build(kids, path + name + '/')) } }
          if (open) fill(); else d.addEventListener('toggle', fill, { once: true })
          li.append(d)
        } else { const a = document.createElement('a'); a.href = slug === 'index' ? '/' : '/' + slug; a.textContent = name; if (slug === cur) a.className = 'active'; li.append(a) }
        ul.append(li)
      }
      return ul
    }
    ex.append(build(tree, ''))
  })

  // mermaid, only on pages that have diagrams
  const mm = $$('code.mermaid')
  if (mm.length) import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then(({ default: m }) => {
    m.initialize({ startOnLoad: false, theme: root.dataset.theme === 'dark' ? 'dark' : 'default' })
    mm.forEach((c, i) => { const d = document.createElement('div'); d.className = 'mermaid'; d.textContent = c.textContent; c.closest('pre').replaceWith(d) })
    m.run({ querySelector: '.mermaid' })
  })
})()
