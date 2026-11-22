// vellum client: theme, reader mode, search, copy-as-markdown, link previews, TOC spy, lazy explorer. No framework.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const root = document.documentElement
  const setTheme = (t) => { root.dataset.theme = t; try { localStorage.setItem('theme', t) } catch {} }
  $('#theme')?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'))
  $('#reader')?.addEventListener('click', () => document.body.classList.toggle('reader'))

  // copy-page menu
  const cp = $('.copy-page')
  if (cp) {
    const url = location.origin + cp.dataset.md, prompt = 'Read this ' + (cp.dataset.what || 'page') + ' and answer questions about it: ' + url
    $('.ask-chatgpt', cp).href = 'https://chatgpt.com/?hints=search&q=' + encodeURIComponent(prompt)
    $('.ask-claude', cp).href = 'https://claude.ai/new?q=' + encodeURIComponent(prompt)
    $('.copy-main', cp).addEventListener('click', (e) => { e.stopPropagation(); cp.classList.toggle('open') })
    document.addEventListener('click', (e) => { if (!cp.contains(e.target)) cp.classList.remove('open') })
    $('.do-copy', cp).addEventListener('click', async (e) => {
      e.stopPropagation()
      const t = $('.copy-text', cp), o = t.textContent
      try { const r = await fetch(cp.dataset.md); await navigator.clipboard.writeText(await r.text()); t.textContent = 'Copied!' } catch { location.href = cp.dataset.md; return }
      cp.classList.remove('open'); setTimeout(() => (t.textContent = o), 1800)
    })
  }

  // mobile menu, explorer default, reading progress
  const menu = $('#menu')
  menu?.addEventListener('click', () => { const o = document.body.classList.toggle('menu-open'); menu.setAttribute('aria-expanded', o) })
  const ew = $('#ex-wrap'); if (ew && matchMedia('(min-width:801px)').matches) ew.open = true
  const bar = $('#progress')
  if (bar) addEventListener('scroll', () => { const h = document.documentElement; bar.style.transform = 'scaleX(' + (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) + ')' }, { passive: true })

  // hover/touch prefetch: internal pages open almost instantly without a client router
  const pre = new Set()
  const prefetch = (e) => { const a = e.target.closest?.('a.internal,.explorer a,.backlinks a,.page-list a,.crumbs a'); if (!a || a.origin !== location.origin || pre.has(a.pathname)) return; pre.add(a.pathname); const l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.pathname; document.head.append(l) }
  document.addEventListener('mouseover', prefetch, { passive: true }); document.addEventListener('touchstart', prefetch, { passive: true })

  // heading anchors and code copy buttons
  $$('article h2[id],article h3[id],article h4[id]').forEach((h) => { const a = document.createElement('a'); a.className = 'anchor'; a.href = '#' + h.id; a.textContent = '#'; a.setAttribute('aria-label', 'Link to this section'); h.append(a) })
  $$('article pre:not(.mermaid-src)').forEach((pre) => {
    const b = document.createElement('button'); b.className = 'code-copy'; b.type = 'button'; b.textContent = 'Copy'
    b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.innerText.replace(/Copy$/, '').trimEnd()); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1500) } catch {} })
    pre.append(b)
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
    const tagOnly = q.startsWith('#'); if (tagOnly) q = q.slice(1)
    if (!q) return
    const terms = q.split(/\s+/)
    const hits = []
    for (const p of idx) {
      const t = p.t.toLowerCase(), x = (p.x || '').toLowerCase(), g = (p.g || []).join(' ').toLowerCase()
      let s = 0
      if (tagOnly) { if (g.includes(q)) hits.push([5, p]); continue }
      for (const w of terms) { const a = t.includes(w) ? (t.startsWith(w) ? 12 : 8) : 0, b = g.includes(w) ? 4 : 0, c = x.includes(w) ? 1 : 0; if (!a && !b && !c) { s = 0; break } s += a + b + c }
      if (s) hits.push([s, p])
    }
    hits.sort((a, b) => b[0] - a[0]).slice(0, 12).forEach(([, p], i) => {
      const li = document.createElement('li'), a = document.createElement('a'), sm = document.createElement('small')
      a.href = p.u; a.textContent = p.t; const xx = p.x || '', at = Math.max(0, xx.toLowerCase().indexOf(terms[0])); sm.textContent = (at > 40 ? '… ' : '') + xx.slice(Math.max(0, at - 40), at + 110); if (i === 0) a.className = 'sel'
      a.append(sm); li.append(a); out.append(li)
    })
    sel = 0
  }
  $$('.search-btn').forEach((b) => b.addEventListener('click', open))
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

  // mermaid: self-hosted, loaded only on pages that have a diagram
  const mm = $$('code.language-mermaid')
  if (mm.length) {
    const srcs = mm.map((c) => c.textContent)
    const draw = () => {
      const dark = root.dataset.theme === 'dark'
      window.mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'loose', fontFamily: getComputedStyle(document.body).fontFamily })
      mm.forEach((c, i) => { let d = c.closest('pre')?.nextElementSibling; if (!d?.classList.contains('mermaid')) { d = document.createElement('div'); d.className = 'mermaid'; c.closest('pre').after(d); c.closest('pre').hidden = true } d.removeAttribute('data-processed'); d.textContent = srcs[i] })
      window.mermaid.run({ querySelector: '.mermaid' })
    }
    const s = document.createElement('script'); s.src = '/static/mermaid.min.js'; s.onload = draw; document.head.append(s)
    $('#theme')?.addEventListener('click', () => setTimeout(() => window.mermaid && draw(), 50))
  }

  // graph view: local graph in the sidebar, whole-site graph in an overlay
  const gc = $('#graph')
  if (gc) {
    let data = null
    const href = (s) => (s === 'index' ? '/' : s.endsWith('/index') ? '/' + s.slice(0, -5) : '/' + s)
    const load = () => (data ??= fetch('/graph.json').then((r) => r.json()))
    const sub = (d, cur, depth, cap) => {
      const adj = d.n.map(() => []); d.e.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a) })
      const ci = d.n.findIndex((n) => n[0] === cur); if (ci < 0) return null
      const seen = new Map([[ci, 0]]); let fr = [ci]
      for (let k = 1; k <= depth; k++) { const nx = []; for (const i of fr) for (const j of adj[i]) if (!seen.has(j)) { seen.set(j, k); nx.push(j) } fr = nx }
      let ids = [...seen.keys()]
      if (ids.length > cap) ids = [ci, ...ids.filter((i) => i !== ci).sort((a, b) => adj[b].length - adj[a].length).slice(0, cap - 1)]
      const m = new Map(ids.map((id, k) => [id, k]))
      return { nodes: ids.map((id) => ({ slug: d.n[id][0], title: d.n[id][1] })), edges: d.e.filter(([a, b]) => m.has(a) && m.has(b)).map(([a, b]) => [m.get(a), m.get(b)]), cur: m.get(ci) }
    }
    const colors = () => { const s = getComputedStyle(root), g = (k) => s.getPropertyValue(k).trim(); return { sec: g('--secondary'), ter: g('--tertiary'), gray: g('--gray'), line: g('--lightgray'), txt: g('--darkgray') } }
    const graph = (canvas, g) => {
      const ctx = canvas.getContext('2d'), dpr = devicePixelRatio || 1; let W, H
      const fit = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }; fit()
      const side = Math.max(220, Math.sqrt(g.nodes.length * 2600)), k = 40
      const ns = g.nodes.map((n, i) => ({ ...n, i, x: (Math.random() - 0.5) * side, y: (Math.random() - 0.5) * side, vx: 0, vy: 0, deg: 0 }))
      const es = g.edges.map(([a, b]) => ({ a: ns[a], b: ns[b] })); es.forEach((e) => { e.a.deg++; e.b.deg++ })
      const order = [...ns].sort((a, b) => (b.i === g.cur) - (a.i === g.cur) || b.deg - a.deg)
      const v = { s: 1, x: 0, y: 0 }; let alpha = 1, hover = null, drag = null, pan = null, moved = false, raf = 0
      const step = () => {
        for (let i = 0; i < ns.length; i++) { const a = ns[i]; for (let j = i + 1; j < ns.length; j++) { const b = ns[j]; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01; if (d2 > k * k * 36) continue; const d = Math.sqrt(d2), f = ((k * k) / d2) * alpha * 1.2; a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f } }
        for (const e of es) { const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - k) * 0.04 * alpha; e.a.vx += (dx / d) * f; e.a.vy += (dy / d) * f; e.b.vx -= (dx / d) * f; e.b.vy -= (dy / d) * f }
        for (const n of ns) { n.vx -= n.x * 0.012 * alpha; n.vy -= n.y * 0.012 * alpha; if (n === drag) { n.vx = n.vy = 0; continue } n.vx *= 0.6; n.vy *= 0.6; n.x += n.vx; n.y += n.vy }
        alpha *= 0.985
      }
      const home = () => {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        for (const n of ns) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y) }
        v.s = Math.min(W / (x1 - x0 + 120), H / (y1 - y0 + 120), 2.2); v.x = W / 2 - ((x0 + x1) / 2) * v.s; v.y = H / 2 - ((y0 + y1) / 2) * v.s
      }
      const sx = (n) => n.x * v.s + v.x, sy = (n) => n.y * v.s + v.y
      const rad = (n) => (n.i === g.cur ? 6 : 3) + Math.min(5, Math.sqrt(n.deg))
      const draw = () => {
        const c = colors(); ctx.clearRect(0, 0, W, H)
        const nb = new Set(); if (hover) es.forEach((e) => { if (e.a === hover) nb.add(e.b); if (e.b === hover) nb.add(e.a) })
        ctx.lineWidth = 1; ctx.strokeStyle = c.line; ctx.globalAlpha = hover ? 0.25 : 0.55; ctx.beginPath()
        for (const e of es) { if (hover && (e.a === hover || e.b === hover)) continue; ctx.moveTo(sx(e.a), sy(e.a)); ctx.lineTo(sx(e.b), sy(e.b)) } ctx.stroke()
        if (hover) { ctx.globalAlpha = 1; ctx.strokeStyle = c.ter; ctx.lineWidth = 1.5; ctx.beginPath(); for (const e of es) if (e.a === hover || e.b === hover) { ctx.moveTo(sx(e.a), sy(e.a)); ctx.lineTo(sx(e.b), sy(e.b)) } ctx.stroke() }
        for (const n of ns) { const cur = n.i === g.cur; ctx.globalAlpha = hover && n !== hover && !nb.has(n) ? 0.3 : 1; ctx.fillStyle = cur ? c.sec : n === hover || nb.has(n) ? c.ter : c.gray; ctx.beginPath(); ctx.arc(sx(n), sy(n), rad(n), 0, 6.2832); ctx.fill() }
        // labels: current, hovered and its neighbours first, then hubs; a label that would overlap one already placed is skipped, zooming in reveals more
        ctx.globalAlpha = 1; ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4
        const halo = getComputedStyle(root).getPropertyValue('--light').trim(), placed = []
        const pri = hover ? [hover, ...nb, ...order] : order
        for (const n of pri) {
          const x = sx(n), y = sy(n); if (x < -50 || y < -20 || x > W + 50 || y > H + 20) continue
          const t = n.title.length > 30 ? n.title.slice(0, 29) + '…' : n.title, w = ctx.measureText(t).width + 6, ty = y - rad(n) - 5
          const r = [x - w / 2, ty - 12, x + w / 2, ty + 3]
          if (placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1]) && n !== hover && n.i !== g.cur) continue
          placed.push(r); ctx.strokeStyle = halo; ctx.strokeText(t, x, ty); ctx.fillStyle = c.txt; ctx.fillText(t, x, ty)
        }
      }
      const loop = () => { raf = 0; step(); draw(); if (alpha > 0.01 || drag) raf = requestAnimationFrame(loop) }
      const wake = (a) => { alpha = Math.max(alpha, a); if (!raf) raf = requestAnimationFrame(loop) }
      const pt = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
      const at = (x, y) => { let best = null, bd = 144; for (const n of ns) { const d = (sx(n) - x) ** 2 + (sy(n) - y) ** 2; if (d < bd) { bd = d; best = n } } return best }
      canvas.onpointermove = (e) => { const [x, y] = pt(e)
        if (drag) { drag.x = (x - v.x) / v.s; drag.y = (y - v.y) / v.s; moved = true; wake(0.3) }
        else if (pan) { v.x = pan.vx + x - pan.x; v.y = pan.vy + y - pan.y; moved = true; draw() }
        else { const n = at(x, y); if (n !== hover) { hover = n; canvas.style.cursor = n ? 'pointer' : 'grab'; draw() } } }
      canvas.onpointerdown = (e) => { const [x, y] = pt(e), n = at(x, y); moved = false; canvas.setPointerCapture(e.pointerId); if (n) { drag = n; wake(0.3) } else pan = { x, y, vx: v.x, vy: v.y } }
      canvas.onpointerup = () => { const d = drag; drag = null; pan = null; if (d && !moved) location.href = href(d.slug) }
      canvas.onpointerleave = () => { if (!drag && !pan) { hover = null; draw() } }
      canvas.onwheel = (e) => { e.preventDefault(); const [x, y] = pt(e), f = Math.exp(-e.deltaY * 0.0015), s2 = Math.min(6, Math.max(0.15, v.s * f)); v.x = x - ((x - v.x) / v.s) * s2; v.y = y - ((y - v.y) / v.s) * s2; v.s = s2; draw() }
      canvas.ondblclick = () => { home(); draw() }
      canvas.style.cursor = 'grab'
      for (let i = 0; i < 150; i++) step()
      home(); draw(); wake(0.2)
      return { fit: () => { fit(); home(); draw() }, stop: () => cancelAnimationFrame(raf), redraw: draw }
    }
    const cur = gc.dataset.slug, big = $('#graph-big'), modal = $('#graph-modal')
    const io = new IntersectionObserver((es, o) => { if (!es.some((e) => e.isIntersecting)) return; o.disconnect(); load().then((d) => { const g = sub(d, cur, d.n.length > 300 ? 1 : 2, 30); if (g && g.nodes.length > 1) graph(gc, g); else gc.closest('.graph-box').hidden = true }) })
    io.observe(gc)
    let gb = null
    $('#graph-full')?.addEventListener('click', async () => {
      modal.hidden = false; const d = await load()
      const g = d.n.length > 400 ? sub(d, cur, 2, 300) ?? sub(d, 'index', 1, 300) : { nodes: d.n.map(([slug, title]) => ({ slug, title })), edges: d.e, cur: d.n.findIndex((n) => n[0] === cur) }
      gb?.stop(); gb = graph(big, g)
    })
    const closeG = () => { modal.hidden = true; gb?.stop(); gb = null }
    $('#graph-close')?.addEventListener('click', closeG); modal?.addEventListener('click', (e) => { if (e.target === modal) closeG() })
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeG() })
  }
})()
