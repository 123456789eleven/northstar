/* Northstar site v3: progressive enhancement only. Every page is complete without this file.
   No network requests, no cookies, no localStorage/sessionStorage/IndexedDB, no service worker, no analytics.
   Each block runs only if its markup exists. Demos use fictional data and keep nothing after a reload. */
(function () {
  'use strict'
  var d = document, root = d.documentElement
  root.classList.add('js')
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var sup = function (q) { return !!(window.CSS && CSS.supports && CSS.supports(q)) }
  var hasView = sup('animation-timeline: view()')
  var hasIO = 'IntersectionObserver' in window
  var $ = function (s, el) { return (el || d).querySelector(s) }
  var $$ = function (s, el) { return Array.prototype.slice.call((el || d).querySelectorAll(s)) }
  var inView = function (el) { var r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  var live = $('#live')
  var say = function (msg) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = msg }, 30) } }
  var replay = function (el, cls) { if (reduce || !el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls) }
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  $$('.pal-k').forEach(function (k) { if (isMac) k.textContent = '⌘ K' })

  /* ---- reveal + draw-in fallback (IntersectionObserver) for browsers without scroll-driven animations ---- */
  if (!hasView && !reduce && hasIO) {
    var els = $$('.rv, .draw')
    root.classList.add('io')
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } })
    }, { rootMargin: '0px 0px -12% 0px' })
    els.forEach(function (e) { if (inView(e)) e.classList.add('in'); else io.observe(e) })
  }
  /* sync packets travel only once the architecture drawing is in view */
  if (!reduce && hasIO) {
    var ioA = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('live'); ioA.unobserve(x.target) } })
    }, { threshold: 0.4 })
    $$('.arch').forEach(function (a) { ioA.observe(a) })
  }

  /* ---- tabs: roving focus, arrow keys, automatic activation ---- */
  var tabSets = []
  $$('[role="tablist"]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list)
    var api = { list: list, tabs: tabs, onSelect: null }
    var select = function (tab, focus, animate) {
      tabs.forEach(function (t) {
        var on = t === tab, panel = d.getElementById(t.getAttribute('aria-controls'))
        t.setAttribute('aria-selected', on ? 'true' : 'false')
        t.tabIndex = on ? 0 : -1
        if (panel) { panel.hidden = !on; if (on && animate) replay(panel, 'enter') }
      })
      if (focus) tab.focus()
      if (api.onSelect) api.onSelect(tab)
    }
    api.select = select
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false, true) })
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length, j = -1
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n
        else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n
        else if (k === 'Home') j = 0
        else if (k === 'End') j = n - 1
        if (j >= 0) { e.preventDefault(); select(tabs[j], true, true) }
      })
    })
    select(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true' })[0] || tabs[0], false, false)
    list._tabs = api
    tabSets.push(api)
  })

  /* ---- capture parser: a faithful subset of src/lib/capture.ts (used by the filer and the miniature) ---- */
  var DAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 }
  var AREAS = ['career', 'health', 'finance', 'learning', 'relationships', 'personal']
  var GOALS = [ // active goals from the built-in demo dataset
    { title: 'Lead a benefits team', area: 'career', h: 2 }, { title: 'Move into a team lead role', area: 'career', h: 1 },
    { title: 'Earn the compliance certification', area: 'career', h: 0 }, { title: 'Stay healthy and rested', area: 'health', h: 2 },
    { title: 'Run a 10k in the spring', area: 'health', h: 1 }, { title: 'Run three times a week', area: 'health', h: 0 }]
  var FILLER = { on: 1, by: 1, due: 1, at: 1 }
  var clean = function (w) { return w.toLowerCase().replace(/[.,;:!?]+$/, '') }
  var today = function () { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()) }
  var addD = function (dt, n) { var x = new Date(dt); x.setDate(x.getDate() + n); return x }
  var addM = function (dt, n) { var x = new Date(dt), day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return x }
  var nextDow = function (from, dow) { var diff = ((dow - from.getDay() + 7) % 7) || 7; return addD(from, diff) }
  var same = function (a, b) { return a.getTime() === b.getTime() }
  var label = function (dt) {
    var t = today()
    if (same(dt, t)) return 'Today'
    if (same(dt, addD(t, 1))) return 'Tomorrow'
    if (same(dt, addD(t, -1))) return 'Yesterday'
    var diff = Math.round((dt - t) / 864e5)
    if (diff > 0 && diff < 7) return dt.toLocaleDateString('en-US', { weekday: 'short' })
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  var norm = function (s) { return s.toLowerCase().replace(/[-_]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim() }
  var matchGoal = function (tag) {
    var t = norm(tag); if (!t) return null
    for (var i = 0; i < GOALS.length; i++) if (norm(GOALS[i].title).indexOf(t) >= 0) return GOALS[i]
    if (AREAS.indexOf(t) >= 0) return GOALS.filter(function (g) { return g.area === t }).sort(function (a, b) { return a.h - b.h })[0] || null
    return null
  }
  var parseDue = function (words, i, prev) {
    var t = today(), w = clean(words[i]), w2 = words[i + 1] ? clean(words[i + 1]) : '', w3 = words[i + 2] ? clean(words[i + 2]) : ''
    if (w === 'today' || w === 'tonight') return { due: t, used: 1 }
    if (w === 'tomorrow' || w === 'tmr' || w === 'tmrw') return { due: addD(t, 1), used: 1 }
    if (w in DAYS) {
      var abbr = !/day$/.test(w), atEnd = words.slice(i + 1).every(function (x) { return /^[!#]/.test(x) }), cued = prev in FILLER || prev === 'next' || prev === 'this'
      if (!abbr || atEnd || cued) return { due: nextDow(t, DAYS[w]), used: 1 }
    }
    if (w === 'next' && w2 === 'week') return { due: nextDow(t, 1), used: 2 }
    if (w === 'next' && w2 in DAYS) return { due: nextDow(t, DAYS[w2]), used: 2 }
    if (w === 'in') {
      var m = /^(\d+)(d|w|m)$/.exec(w2), n = 0, u = '', used = 2
      if (m) { n = +m[1]; u = m[2] } else if (/^\d+$/.test(w2)) { n = +w2; used = 3; u = /^days?$/.test(w3) ? 'd' : /^weeks?$/.test(w3) ? 'w' : /^months?$/.test(w3) ? 'm' : '' }
      if (u) return { due: u === 'd' ? addD(t, n) : u === 'w' ? addD(t, n * 7) : addM(t, n), used: used }
    }
    return null
  }
  var parseTask = function (text) {
    var words = text.split(/\s+/).filter(Boolean), out = [], due = null, pri = 2, rec = 'none', goal = null
    for (var i = 0; i < words.length; i++) {
      var raw = words[i], w = clean(raw), p = /^!([123])$/.exec(raw)
      if (p) { pri = +p[1]; continue }
      if (raw.charAt(0) === '#' && raw.length > 1) { var g = matchGoal(raw.slice(1)); if (g && !goal) { goal = g; continue } out.push(raw); continue }
      if (w === 'every' && words[i + 1]) {
        var nx = clean(words[i + 1])
        if (nx === 'day') { rec = 'Daily'; i++; continue }
        if (nx === 'week') { rec = 'Weekly'; i++; continue }
        if (nx === 'month') { rec = 'Monthly'; i++; continue }
        if (nx in DAYS) { rec = 'Weekly'; if (!due) due = nextDow(addD(today(), -1), DAYS[nx]); i++; continue }
      }
      if (!due) {
        var r = parseDue(words, i, i > 0 ? clean(words[i - 1]) : '')
        if (r) { due = r.due; i += r.used - 1; if (out.length && out[out.length - 1].toLowerCase() in FILLER) out.pop(); continue }
      }
      out.push(raw)
    }
    return { kind: 'task', title: out.join(' '), due: due, pri: pri, rec: rec, goal: goal }
  }
  var slotNow = function () { var n = new Date(), h = n.getHours() + n.getMinutes() / 60; return h >= 4 && h < 10.5 ? 'Breakfast' : h >= 10.5 && h < 15 ? 'Lunch' : h >= 17 && h < 22 ? 'Dinner' : 'Snack' }
  var parse = function (input) {
    var text = input.trim(), m
    if (!text) return { kind: 'empty' }
    if ((m = /^([+-])?\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?:\s+(.*))?$/.exec(text))) {
      var amt = +m[2].replace(/,/g, ''), inc = m[1] === '+'
      return { kind: 'transaction', amount: amt, income: inc, desc: (m[3] || '').trim() || (inc ? 'Income' : 'Expense') }
    }
    if ((m = /^journal\s*:\s*(.+)$/i.exec(text))) return { kind: 'journal', text: m[1].trim() }
    if ((m = /^win\s*:\s*(.*)$/i.exec(text))) {
      var area = 'personal'
      var title = m[1].split(/\s+/).filter(function (w) { var t = w.charAt(0) === '#' ? w.slice(1).toLowerCase() : ''; if (t && AREAS.indexOf(t) >= 0) { area = t; return false } return true }).join(' ').trim()
      return { kind: 'win', title: title || 'Win', area: area }
    }
    if ((m = /^(?:weight|weighed|w)\s+(\d{2,3}(?:\.\d)?)\s*(?:lbs?)?(?:\s+(today|yesterday|yday))?$/i.exec(text)) && +m[1] >= 50 && +m[1] <= 700) {
      return { kind: 'weight', weight: +m[1], date: m[2] && m[2].toLowerCase() !== 'today' ? addD(today(), -1) : today() }
    }
    if ((m = /^(?:ate|had)\s+(?!to\b)(.+)$/i.exec(text))) {
      var rest = m[1], cal = null, slot = slotNow(), date = today(), c, f, y
      if ((c = /(?:^|\s)(\d{1,5})\s*(?:k?cals?|calories)\b/i.exec(rest))) { cal = +c[1]; rest = rest.replace(c[0], ' ') }
      if ((f = /\s*\bfor (breakfast|lunch|dinner|snack)\b/i.exec(rest))) { slot = f[1].charAt(0).toUpperCase() + f[1].slice(1).toLowerCase(); rest = rest.replace(f[0], ' ') }
      if ((y = /\s*\b(?:yesterday|yday)\b/i.exec(rest))) { date = addD(today(), -1); rest = rest.replace(y[0], ' ') }
      var name = rest.replace(/\s+/g, ' ').trim()
      if (name) return { kind: 'meal', name: name, cal: cal, slot: slot, date: date }
    }
    return parseTask(text)
  }
  var usd = function (n) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) }
  var PRI = { 1: 'High', 2: 'Normal', 3: 'Low' }
  var cap1 = function (s) { return s.charAt(0).toUpperCase() + s.slice(1) }
  var describe = function (c) {
    switch (c.kind) {
      case 'task': return ['Task', c.due && 'due ' + (/^(Today|Tomorrow|Yesterday)$/.test(label(c.due)) ? label(c.due).toLowerCase() : label(c.due)), c.pri !== 2 && PRI[c.pri].toLowerCase() + ' priority', c.rec !== 'none' && 'repeats ' + c.rec.toLowerCase(), c.goal && 'goal: ' + c.goal.title].filter(Boolean).join(', ')
      case 'transaction': return (c.income ? 'Income, +' : 'Expense, −') + usd(c.amount) + (c.desc ? ', ' + c.desc : '')
      case 'meal': return 'Meal, ' + (c.cal != null ? c.cal.toLocaleString('en-US') + ' cal, ' : '') + c.slot.toLowerCase()
      case 'weight': return 'Weight, ' + c.weight.toFixed(1) + ' lb' + (same(c.date, today()) ? ' today' : ' yesterday')
      case 'journal': return 'Journal, appended to today’s entry'
      case 'win': return 'Win, ' + c.area + ', on the timeline'
      default: return 'nothing yet'
    }
  }

  /* ---- hero filer: types real capture lines and files each into its lane ---- */
  var filer = $('#filer')
  if (filer) {
    var lanes = $$('.lane', filer), txt = $('#filer-text'), pauseB = $('#filer-pause')
    var EX = lanes.map(function (l) { return { el: l, line: $('.ln-in', l).textContent } })
    EX.forEach(function (x) { var c = parse(x.line), out = $('.ln-out', x.el); if (c.kind === 'task') out.textContent = describe(c).replace(/^Task, /, ''); else out.textContent = cap1(describe(c)) })
    if (!reduce) {
      var idx = 0, timer = null, paused = false, visible = true, typing = 0
      var wait = function (ms, fn) { clearTimeout(timer); timer = setTimeout(function () { if (paused || !visible || d.hidden) { wait(400, fn); return } fn() }, ms) }
      var cycle = function () {
        var ex = EX[idx], full = ex.line
        typing = 0
        var type = function () {
          typing++
          txt.textContent = full.slice(0, typing)
          if (typing < full.length) wait(38 + (full.charCodeAt(typing) % 5) * 9, type)
          else wait(420, file)
        }
        var file = function () {
          lanes.forEach(function (l) { l.classList.toggle('on', l === ex.el) })
          replay(ex.el, 'drop')
          wait(2400, erase)
        }
        var erase = function () {
          typing = Math.max(0, typing - 3); txt.textContent = full.slice(0, typing)
          if (typing > 0) wait(16, erase); else { idx = (idx + 1) % EX.length; wait(260, cycle) }
        }
        type()
      }
      txt.textContent = ''
      wait(900, cycle)
      if (hasIO) new IntersectionObserver(function (es) { visible = es[0].isIntersecting }).observe(filer)
      pauseB.addEventListener('click', function () {
        paused = !paused
        pauseB.setAttribute('aria-pressed', paused ? 'true' : 'false')
        pauseB.textContent = paused ? 'Play' : 'Pause'
      })
    } else if (pauseB) { pauseB.hidden = true }
  }

  /* ---- the instrument: a working miniature of the app with fictional data ---- */
  var mini = $('#mini')
  if (mini) {
    var rail = $('.mini-rail', mini), tabsApi = rail && rail._tabs
    var hhmm = function () { var n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0') }
    var histL = $('#mh-list')
    var log = function (tag, text) {
      var li = d.createElement('li')
      li.innerHTML = '<time>' + hhmm() + '</time><span class="tag">' + esc(tag) + '</span><span>' + esc(text) + '</span>'
      histL.insertBefore(li, histL.firstChild); replay(li, 'enter-row')
      while (histL.children.length > 9) histL.removeChild(histL.lastChild)
    }
    var tick = function (el, text) { if (!el) return; el.textContent = text; el.classList.remove('tick'); if (!reduce) { void el.offsetWidth; el.classList.add('tick') } }
    var show = function (key) { if (!tabsApi) return; var t = $('#mt-' + key); if (t && t.getAttribute('aria-selected') !== 'true') tabsApi.select(t, false, true) }
    var bumpN = function (key, text) { var n = $('#mn-' + key); if (!n) return; n.textContent = text; replay(n, 'bump') }

    /* tasks */
    var openL = $('#tk-open'), doneL = $('#tk-done'), tkMeta = $('#tk-meta')
    var countTasks = function () {
      var o = openL.children.length, dn = doneL.children.length
      tkMeta.textContent = o + ' open · ' + dn + ' done today'
      $('#mn-tasks').textContent = String(o)
    }
    var wireRow = function (li) {
      var cb = $('input', li)
      cb.addEventListener('change', function () {
        var title = $('.tt', li).textContent
        if (cb.checked) {
          li.classList.add('completing')
          setTimeout(function () {
            li.classList.add('leaving')
            setTimeout(function () {
              li.classList.remove('completing', 'leaving'); li.classList.add('is-done')
              doneL.insertBefore(li, doneL.firstChild); replay(li, 'enter-row'); countTasks(); cb.focus({ preventScroll: true })
            }, reduce ? 0 : 200)
          }, reduce ? 0 : 420)
          log('Tasks', 'Completed: ' + title)
          say('Completed ' + title + '. Logged to History.')
        } else {
          li.classList.remove('is-done')
          openL.appendChild(li); replay(li, 'enter-row'); countTasks(); cb.focus({ preventScroll: true })
          say('Reopened ' + title)
        }
      })
    }
    $$('.tr', mini).forEach(wireRow)
    var addTask = function (c) {
      var li = d.createElement('li'); li.className = 'tr'
      var chips = [c.due && label(c.due), c.pri === 1 && 'High', c.pri === 3 && 'Low', c.rec !== 'none' && c.rec, c.goal && c.goal.title].filter(Boolean)
      li.innerHTML = '<label class="tr-l"><input type="checkbox" class="check"><span class="tt">' + esc(c.title || 'Untitled task') + '</span></label><span class="chips">' +
        chips.map(function (ch) { return '<span class="chip' + (ch === 'High' ? ' hi' : '') + '">' + esc(ch) + '</span>' }).join('') + '</span>'
      openL.insertBefore(li, openL.firstChild); wireRow(li); replay(li, 'enter-row'); countTasks()
      show('tasks'); log('Tasks', 'Added: ' + (c.title || 'Untitled task'))
    }

    /* body: weights, 7-day average, 4-week rate (same math as features/body/model.ts) */
    var W = []
    ;(function () { var seed = 11; var r = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
      for (var i = 20; i >= 0; i--) W.push({ day: -i, w: Math.round((135.0 + (20 - i) * 0.068 + (r() - 0.5) * 0.9) * 10) / 10 })
      W[W.length - 1].w = 136.4 })()
    var avgAt = function (end) { var xs = W.filter(function (p) { return p.day > end - 7 && p.day <= end }); return xs.reduce(function (s, p) { return s + p.w }, 0) / xs.length }
    var rate = function () {
      var pts = W.filter(function (p) { return p.day > -28 }), n = pts.length
      if (n < 3) return null
      var mx = pts.reduce(function (s, p) { return s + p.day }, 0) / n, my = pts.reduce(function (s, p) { return s + p.w }, 0) / n, num = 0, den = 0
      pts.forEach(function (p) { num += (p.day - mx) * (p.w - my); den += (p.day - mx) * (p.day - mx) })
      return den ? num / den * 7 : null
    }
    var NS = 'http://www.w3.org/2000/svg'
    var mk = function (tag, a, t) { var e = d.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e }
    var drawChart = function (fresh) {
      var g = $('#wc-grid'), dots = $('#wc-dots'), path = $('#wc-avg')
      while (g.firstChild) g.removeChild(g.firstChild); while (dots.firstChild) dots.removeChild(dots.firstChild)
      var ws = W.map(function (p) { return p.w }), lo = Math.floor(Math.min.apply(null, ws) - 0.4), hi = Math.ceil(Math.max.apply(null, ws) + 0.4)
      var L = 40, R = 592, T = 10, B = 176
      var X = function (day) { return L + (R - L) * (day + 20) / 20 }, Y = function (v) { return T + (B - T) * (1 - (v - lo) / (hi - lo)) }
      for (var i = 0; i <= 2; i++) { var v = lo + (hi - lo) * i / 2; g.appendChild(mk('line', { x1: L, x2: R, y1: Y(v), y2: Y(v), class: 'g' })); g.appendChild(mk('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'ax' }, v.toFixed(0))) }
      g.appendChild(mk('text', { x: L, y: 196, class: 'ax' }, '3 weeks ago')); g.appendChild(mk('text', { x: R, y: 196, 'text-anchor': 'end', class: 'ax' }, 'Today'))
      W.forEach(function (p, i) { dots.appendChild(mk('circle', { cx: X(p.day), cy: Y(p.w), r: i === W.length - 1 ? 4 : 2.6, class: 'd' + (fresh && i === W.length - 1 ? ' new' : '') })) })
      path.setAttribute('d', W.map(function (p, i) { return (i ? 'L' : 'M') + X(p.day).toFixed(1) + ' ' + Y(avgAt(p.day)).toFixed(1) }).join(' '))
      var rt = rate()
      tick($('#bd-avg'), avgAt(0).toFixed(1)); tick($('#bd-rate'), rt == null ? '–' : (rt >= 0 ? '+' : '−') + Math.abs(rt).toFixed(1)); tick($('#bd-last'), W[W.length - 1].w.toFixed(1))
    }
    drawChart(false)
    var logWeight = function (w) {
      W[W.length - 1].w = Math.round(w * 10) / 10
      drawChart(true); show('body'); bumpN('body', '+1'); log('Body', 'Weighed in: ' + w.toFixed(1) + ' lb')
      say('Logged ' + w.toFixed(1) + ' pounds. Seven-day average ' + avgAt(0).toFixed(1) + '.')
    }

    /* finance: budgets react to expenses (status as in features/finance/quickAdd.ts budgetStatus) */
    var BUD = { Dining: { spent: 168.40, limit: 250, el: 'dining' }, Groceries: { spent: 301.12, limit: 450, el: 'groc' } }
    var DINING = /chipotle|coffee|caf[eé]|starbucks|blue bottle|pizza|pizzeria|sushi|taco|burger|restaurant|bistro|diner|ramen|thai|bakery|bar\b|pub|lunch|dinner|brunch|bowl/i
    var GROC = /grocer|trader joe|whole foods|kroger|safeway|aldi|costco|market|produce/i
    var drawBud = function (name, flash) {
      var b = BUD[name], ratio = b.limit > 0 ? b.spent / b.limit : 0, left = Math.round((b.limit - b.spent) * 100) / 100
      var state = ratio > 1 ? 'over' : ratio > 0.9 ? 'near' : 'ok', box = $('#bud-' + b.el)
      box.classList.toggle('over', state === 'over'); box.classList.toggle('near', state === 'near')
      $('#bar-' + b.el).style.setProperty('--r', String(Math.min(1, ratio)))
      tick($('#bd-' + b.el + '-s'), usd(b.spent))
      $('#bd-' + b.el + '-st').textContent = state === 'over' ? 'Over by ' + usd(-left) : state === 'near' ? usd(left) + ' left, near the limit' : usd(left) + ' left'
      if (flash) replay(box, 'enter-row')
    }
    var addTx = function (amount, desc, income) {
      var cat = income ? 'Income' : DINING.test(desc) ? 'Dining' : GROC.test(desc) ? 'Groceries' : 'Uncategorized'
      var li = d.createElement('li')
      li.innerHTML = '<span class="tx-d">Today</span><span class="tx-n">' + esc(cap1(desc)) + '</span><span class="tx-c' + (cat === 'Uncategorized' ? ' un' : '') + '">' + cat + '</span><span class="tx-a">' + (income ? '+' : '−') + usd(amount) + '</span>'
      var tl = $('#tx-list'); tl.insertBefore(li, tl.firstChild); replay(li, 'enter-row')
      while (tl.children.length > 5) tl.removeChild(tl.lastChild)
      if (BUD[cat]) { BUD[cat].spent = Math.round((BUD[cat].spent + amount) * 100) / 100; drawBud(cat, true) }
      show('money'); bumpN('money', '+1'); log('Finance', (income ? 'Income: ' : 'Expense: ') + cap1(desc) + ' ' + (income ? '+' : '−') + usd(amount))
      say((income ? 'Income' : 'Expense') + ' of ' + usd(amount) + ' filed as ' + cat + (BUD[cat] ? '. ' + $('#bd-' + BUD[cat].el + '-st').textContent : cat === 'Uncategorized' ? '. In the app, Command would propose a category once a merchant rule matches.' : ''))
    }
    drawBud('Dining'); drawBud('Groceries')

    /* food */
    var TARGET = 2450, eaten = 830
    var drawFood = function () {
      var left = TARGET - eaten
      tick($('#fd-left'), left >= 0 ? left.toLocaleString('en-US') : '−' + (-left).toLocaleString('en-US'))
      $('#bar-food').style.setProperty('--r', String(Math.min(1, eaten / TARGET)))
    }
    var addMeal = function (c) {
      var li = d.createElement('li')
      li.innerHTML = '<span class="ann">' + esc(c.slot) + '</span><span>' + esc(cap1(c.name)) + '</span><span class="fig">' + (c.cal != null ? c.cal : '–') + '</span>'
      var fl = $('#fd-list'); fl.appendChild(li); replay(li, 'enter-row')
      if (c.cal != null) eaten += c.cal
      drawFood(); show('food'); bumpN('food', '+1'); log('Food', c.slot + ': ' + c.name + (c.cal != null ? ', ' + c.cal + ' cal' : ''))
    }
    /* journal */
    var addJournal = function (t) {
      var p = d.createElement('p'); p.textContent = cap1(t)
      $('#jr-body').appendChild(p); replay(p, 'enter-row'); show('journal'); bumpN('journal', '+1'); log('Journal', 'Entry: ' + t)
    }

    /* capture bar */
    var capF = $('#mini-cap'), capIn = $('#mini-in'), kind = $('#mini-kind')
    capIn.addEventListener('input', function () { kind.textContent = describe(parse(capIn.value)) })
    capF.addEventListener('submit', function (e) {
      e.preventDefault()
      var c = parse(capIn.value)
      if (c.kind === 'empty') { say('Type a line first, for example $14 chipotle.'); return }
      if (c.kind === 'task') addTask(c)
      else if (c.kind === 'transaction') addTx(c.amount, c.desc, c.income)
      else if (c.kind === 'weight') logWeight(c.weight)
      else if (c.kind === 'meal') addMeal(c)
      else if (c.kind === 'journal') addJournal(c.text)
      else if (c.kind === 'win') { log(cap1(c.area), 'Win: ' + c.title); say('Win added to History.') }
      if (c.kind !== 'weight' && c.kind !== 'transaction') say('Filed: ' + describe(c) + '. Logged to History.')
      capIn.value = ''; kind.textContent = 'nothing yet'
    })
    $$('.tryb', mini).forEach(function (b) {
      b.addEventListener('click', function () { capIn.value = b.getAttribute('data-line'); kind.textContent = describe(parse(capIn.value)); capIn.focus() })
    })
    $('#bd-f').addEventListener('submit', function (e) {
      e.preventDefault(); var v = parseFloat($('#bd-in').value)
      if (!(v >= 50 && v <= 700)) { say('Enter a weight between 50 and 700 pounds.'); return }
      logWeight(v); $('#bd-in').value = ''
    })
    $('#tx-f').addEventListener('submit', function (e) {
      e.preventDefault(); var a = parseFloat($('#tx-amt').value), w = $('#tx-what').value.trim() || 'Expense'
      if (!(a > 0)) { say('Enter an amount above zero.'); return }
      addTx(Math.round(a * 100) / 100, w, false); $('#tx-amt').value = ''; $('#tx-what').value = ''
    })
    if (tabsApi) tabsApi.onSelect = function (t) { var n = $('.mr-n', t); if (n && t.id !== 'mt-tasks') n.textContent = '' }
    countTasks()
  }

  /* ---- a day, filed: the stage follows the step in view ---- */
  var story = $('#story')
  if (story) {
    var stage = $('#stage'), steps = $$('.step', story), evs = $$('.stage-ev li', stage), clock = $('#stage-clock'), prog = $('#stage-prog')
    var meters = $$('.stage-m dd', stage), cssRail = sup('timeline-scope: --a') && !reduce
    var setStep = function (n) {
      stage.setAttribute('data-step', String(n))
      evs.forEach(function (li) { var s = +li.getAttribute('data-s'); li.classList.toggle('off', s > n); li.classList.toggle('cur', s === n) })
      steps.forEach(function (st) { st.classList.toggle('on', +st.getAttribute('data-step') === n) })
      clock.textContent = n ? $('.step-t', steps[n - 1]).textContent : 'Tuesday'
      meters.forEach(function (m) { var v = (m.getAttribute('data-v') || '').split('|'); if (v[n] != null) m.textContent = v[n] })
      if (!cssRail) prog.style.setProperty('--p', String(n / steps.length))
    }
    setStep(0)
    if (hasIO) {
      var ioS = new IntersectionObserver(function (es) {
        es.forEach(function (x) { if (x.isIntersecting) setStep(+x.target.getAttribute('data-step')) })
      }, { rootMargin: '-45% 0px -50% 0px' })
      steps.forEach(function (s) { ioS.observe(s) })
    } else setStep(steps.length)
  }

  /* ---- module index preview ---- */
  var modl = $('#modlist')
  if (modl) {
    var pimg = $('#modprev-img'), plab = $('#modprev-l'), cur = 'today'
    var pick = function (a) {
      var k = a.getAttribute('data-shot'); $$('a', modl).forEach(function (x) { x.classList.toggle('on', x === a) })
      if (k === cur) return; cur = k
      pimg.src = 'img/' + k + '-d.webp'; plab.textContent = 'Northstar · ' + $('.mi-t', a).textContent; replay(pimg, 'swap')
    }
    $$('a', modl).forEach(function (a) { a.addEventListener('pointerenter', function () { pick(a) }); a.addEventListener('focus', function () { pick(a) }) })
  }

  /* ---- features: index follows the module in view ---- */
  var catIdx = $('.cat-idx')
  if (catIdx && hasIO) {
    var links = $$('a', catIdx)
    var ioF = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) links.forEach(function (l) { l.classList.toggle('on', l.getAttribute('href') === '#' + x.target.id) }) })
    }, { rootMargin: '-30% 0px -65% 0px' })
    links.forEach(function (l) { var t = d.getElementById(l.getAttribute('href').slice(1)); if (t) ioF.observe(t) })
  }

  /* ---- weight projection calculator (same math as the Body module) ---- */
  var calc = $('#calc')
  if (calc) {
    var ci = $('#c-cur'), cg = $('#c-goal'), cr = $('#c-rate'), svg = $('#c-svg'), msg = $('#c-msg')
    var long2 = function (dt) { return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
    var CW = 560, CH = 220, CL = 44, CR = 16, CT = 16, CB = 28
    var draw = function (animate) {
      var cur = parseFloat(ci.value), goal = parseFloat(cg.value), rt = parseFloat(cr.value)
      var out = function (a, b, c) { $('#c-weeks').textContent = a; $('#c-date').textContent = b; $('#c-delta').textContent = c }
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      if (!(cur >= 50 && cur <= 700) || !(goal >= 50 && goal <= 700)) { out('–', '–', '–'); msg.textContent = 'Enter a current and goal weight between 50 and 700 lb.'; return }
      var dist = Math.abs(goal - cur), dir = goal >= cur ? 1 : -1
      if (dist < 0.05) { out('0', 'Today', '0.0 lb'); msg.textContent = 'You are already at your goal weight.'; return }
      if (!(rt > 0.01)) { out('–', '–', (dir > 0 ? '+' : '−') + dist.toFixed(1) + ' lb'); msg.textContent = 'Projection needs a weekly rate above zero.'; return }
      if (rt > 3) { msg.textContent = 'Rates above 3 lb a week are outside what the Body module projects.'; out('–', '–', '–'); return }
      var days = Math.ceil((dist / rt) * 7), weeks = Math.ceil(dist / rt)
      var end = new Date(); end.setDate(end.getDate() + days)
      out(String(weeks), end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: end.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }), (dir > 0 ? '+' : '−') + dist.toFixed(1) + ' lb')
      msg.textContent = 'At ' + rt + ' lb a week you reach ' + goal + ' lb in about ' + weeks + ' week' + (weeks === 1 ? '' : 's') + ', around ' + long2(end) + '.'
      var lo = Math.min(cur, goal), hi = Math.max(cur, goal), pad = Math.max(1, (hi - lo) * 0.12), y0 = lo - pad, y1 = hi + pad
      var X = function (wk) { return CL + (CW - CL - CR) * (wk / weeks) }, Y = function (v) { return CT + (CH - CT - CB) * (1 - (v - y0) / (y1 - y0)) }
      for (var i = 0; i <= 3; i++) { var v = y0 + (y1 - y0) * (i / 3), yy = Y(v); svg.appendChild(mk2('line', { x1: CL, x2: CW - CR, y1: yy, y2: yy, class: 'grid' })); svg.appendChild(mk2('text', { x: CL - 8, y: yy + 4, 'text-anchor': 'end', class: 'axis' }, v.toFixed(0))) }
      var ticks = Math.min(6, weeks)
      for (var k = 0; k <= ticks; k++) { var wk = Math.round(weeks * k / ticks); svg.appendChild(mk2('text', { x: X(wk), y: CH - 8, 'text-anchor': k === 0 ? 'start' : k === ticks ? 'end' : 'middle', class: 'axis' }, k === 0 ? 'Now' : wk + 'w')) }
      svg.appendChild(mk2('line', { x1: CL, x2: CW - CR, y1: Y(goal), y2: Y(goal), class: 'goal' }))
      svg.appendChild(mk2('text', { x: CW - CR, y: Y(goal) + (dir > 0 ? -8 : 16), 'text-anchor': 'end', class: 'lbl' }, 'Goal ' + goal + ' lb'))
      svg.appendChild(mk2('path', { d: 'M' + X(0) + ' ' + Y(cur) + ' L' + X(weeks) + ' ' + Y(goal), class: 'path' + (animate && !reduce ? ' draw-path' : ''), pathLength: '1' }))
      var first = dir > 0 ? Math.floor(cur / 5) * 5 + 5 : Math.ceil(cur / 5) * 5 - 5
      for (var m = first; dir > 0 ? m < goal : m > goal; m += 5 * dir) svg.appendChild(mk2('circle', { cx: X(Math.abs(m - cur) / rt), cy: Y(m), r: 4, class: 'ms' }))
      svg.appendChild(mk2('circle', { cx: X(weeks), cy: Y(goal), r: 5, class: 'end' }))
      svg.appendChild(mk2('circle', { cx: X(0), cy: Y(cur), r: 4, class: 'ms' }))
      svg.setAttribute('aria-label', 'Projected line from ' + cur + ' lb now to ' + goal + ' lb in ' + weeks + ' weeks, with a marker every 5 lb.')
    }
    var mk2 = function (tag, a, t) { var e = d.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e }
    var ct
    ;[ci, cg, cr].forEach(function (x) { x.addEventListener('input', function () { clearTimeout(ct); ct = setTimeout(function () { draw(true) }, 120) }) })
    calc.addEventListener('submit', function (e) { e.preventDefault(); draw(true) })
    draw(false)
  }

  /* ---- privacy explorer ---- */
  var ex = $('#explore')
  if (ex) {
    var sws = $$('input[data-f]', ex), none = $('.sent li.none', ex)
    var upd = function () {
      var any = false
      sws.forEach(function (s) {
        var f = s.getAttribute('data-f'), on = s.checked
        any = any || on
        var g = $('#fm-' + f); if (g) g.classList.toggle('fm-on', on)
        $$('.sent li[data-f="' + f + '"]', ex).forEach(function (li) { li.classList.toggle('on', on) })
        var sm = $('small', s.parentNode); if (sm) sm.textContent = on ? 'On in this explorer' : 'Off by default'
      })
      none.classList.toggle('off', any)
    }
    sws.forEach(function (s) {
      s.addEventListener('change', function () {
        upd()
        var name = $('.t', s.parentNode).firstChild.textContent
        say(name + (s.checked ? ' on. ' + $('.sent li[data-f="' + s.getAttribute('data-f') + '"]', ex).textContent : ' off.'))
      })
    })
    upd()
  }

  /* ---- security: key-wrapping stepper highlights its part of the drawing ---- */
  var kw = $('#kw')
  if (kw) {
    var kbs = $$('.kw-b'), parts = $$('svg g, svg .lab', kw)
    var setK = function (n) {
      kw.setAttribute('data-step', String(n)); kw.classList.toggle('has-step', n > 0)
      parts.forEach(function (p) { p.classList.toggle('sel', n > 0 && p.classList.contains('s' + n)) })
      kbs.forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-s') === n ? 'true' : 'false') })
    }
    kbs.forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-s'), on = b.getAttribute('aria-pressed') === 'true'
        setK(on ? 0 : n); say(on ? 'Showing the whole diagram.' : 'Step ' + n + ' highlighted in the diagram.')
      })
    })
    setK(0)
  }

  /* ---- install: preselect the visitor's platform ---- */
  var ptl = $('.ptabs')
  if (ptl && ptl._tabs) {
    var ua = navigator.userAgent
    var plat = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop'
    ptl._tabs.select($('#pt-' + plat), false, false)
  }

  /* ---- roadmap filters ---- */
  var rm = $('#rm')
  if (rm) {
    var fch = $$('.fchip'), items = $$('li[data-s]', rm), groups = $$('.rm-g', rm)
    var applyF = function (f) {
      var n = 0
      groups.forEach(function (g) {
        var a = g.getAttribute('data-a'), any = false
        $$('li[data-s]', g).forEach(function (li) {
          var hit = f === 'all' || f === li.getAttribute('data-s') || f === a
          if (hit && li.hidden) replay(li, 'in')
          li.hidden = !hit; if (hit) { any = true; n++ }
        })
        g.hidden = !any
      })
      fch.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-f') === f ? 'true' : 'false') })
      $('#rm-count').textContent = n + (n === 1 ? ' entry' : ' entries')
      $('#rm-empty').hidden = n > 0
    }
    fch.forEach(function (b) { b.addEventListener('click', function () { applyF(b.getAttribute('data-f')) }) })
    applyF('all')
  }

  /* ---- FAQ: hash deep links, filter, expand all ---- */
  var faq = $('.faq')
  if (faq) {
    var dets = $$('details', faq), bulk = false
    var openHash = function () {
      var id = decodeURIComponent(location.hash.slice(1)), t = id && d.getElementById(id)
      if (t && t.tagName === 'DETAILS') { t.open = true; t.scrollIntoView({ block: 'start' }); $('summary', t).focus({ preventScroll: true }) }
    }
    dets.forEach(function (det) {
      det.addEventListener('toggle', function () {
        if (bulk) return
        if (det.open) history.replaceState(null, '', '#' + det.id)
        else if (location.hash === '#' + det.id) history.replaceState(null, '', location.pathname + location.search)
      })
    })
    addEventListener('hashchange', openHash)
    openHash()
    var q = $('#faq-q'), count = $('#faq-count'), empty = $('#faq-empty')
    if (q) q.addEventListener('input', function () {
      var s = q.value.trim().toLowerCase(), n = 0
      dets.forEach(function (det) { var hit = !s || det.textContent.toLowerCase().indexOf(s) >= 0; det.hidden = !hit; if (hit) n++ })
      $$('.faq-g', faq).forEach(function (g) { g.hidden = !$$('details', g).some(function (x) { return !x.hidden }) })
      count.textContent = s ? n + ' of ' + dets.length + ' questions' : dets.length + ' questions'
      empty.hidden = n > 0
    })
    var all = $('#faq-all')
    if (all) all.addEventListener('click', function () {
      var open = all.getAttribute('aria-pressed') !== 'true'
      bulk = true
      dets.forEach(function (det) { if (!det.hidden) det.open = open })
      setTimeout(function () { bulk = false }, 0)
      all.setAttribute('aria-pressed', open ? 'true' : 'false')
      all.textContent = open ? 'Collapse all' : 'Expand all'
    })
  }

  /* ---- site search palette: Ctrl/Cmd+K or "/" ---- */
  var INDEX = /*@index*/[{"t":"FAQ","u":"faq.html","k":"Page","x":"Answers about data loss, backups, sync passphrases, multiple devices, bank connections, cost, who built Northstar, its source code and offline use."},{"t":"Will I lose my data?","u":"faq.html#lose-data","k":"FAQ","x":"Q01 Will I lose my data? Your data lives in your browser on your device. Clearing site data for Northstar, using a browser’s \"clear everything\" option, or losing the device can erase it. Without sync or a backup there is no other copy, so export a JSON backup from Settings regularly. Northstar nudges you if you have never exported one. Link to this answer"},{"t":"How do backups work?","u":"faq.html#backups","k":"FAQ","x":"Q02 How do backups work? In Settings, Export backup downloads one JSON file of everything. Import restores it as a single step, so a failed import cannot leave things half-written. The file is readable, so store it like any personal document. Link to this answer"},{"t":"Can I use it on more than one device?","u":"faq.html#devices","k":"FAQ","x":"Q03 Can I use it on more than one device? Yes. Turn on encrypted sync in Settings on each device, with your own Supabase project and the same passphrase. Or skip sync and move data by exporting a backup on one device and importing it on another. Link to this answer"},{"t":"Does it work offline?","u":"faq.html#offline","k":"FAQ","x":"Q04 Does it work offline? Yes. After the first load, the app opens without a connection and everything that works on local data keeps working. Sync, Google Calendar and food search wait until you are online. See Install . Link to this answer 02 Sync, banks and tracking"},{"t":"What if I forget my sync passphrase?","u":"faq.html#passphrase","k":"FAQ","x":"Q05 What if I forget my sync passphrase? If you still have your one-time recovery code, you can use it to regain access. If you lose both the passphrase and the recovery code, nobody can decrypt the cloud copy, including Northstar and Supabase. Each device keeps its own readable copy, so export a backup and set sync up again. Link to this answer"},{"t":"How do bank connections work?","u":"faq.html#banks","k":"FAQ","x":"Q06 How do bank connections work? By default they do not. You export a CSV or OFX/QFX file from your bank and import it; Northstar never asks for bank credentials. There is an optional live feed through SimpleFIN, off by default, which uses a small relay in your own Supabase project. See the privacy explorer for exactly what it sends. Link to this answer"},{"t":"Does it send my data anywhere or track me?","u":"faq.html#tracking","k":"FAQ","x":"Q07 Does it send my data anywhere or track me? No tracking or analytics. Only four opt-in connections can send anything: encrypted sync, read-only Google Calendar, Open Food Facts search and the SimpleFIN bank feed. The Privacy page lists exactly what each one sends. Link to this answer 03 About Northstar"},{"t":"How much does it cost?","u":"faq.html#cost","k":"FAQ","x":"Q08 How much does it cost? Nothing. It is free to use, with no ads and no accounts. Sync uses a Supabase project that you create, which has its own plan and limits. Link to this answer"},{"t":"Who built it?","u":"faq.html#who","k":"FAQ","x":"Q09 Who built it? One person, mainly for their own use, and then made available to anyone. There is no company behind it and no data collection to fund. Link to this answer"},{"t":"Is it open source?","u":"faq.html#open-source","k":"FAQ","x":"Q10 Is it open source? The source code is in a public repository, so it is viewable. A license has not been chosen yet, so please treat it as viewable but not yet licensed for reuse. Link to this answer 04 This website"},{"t":"Does this website use cookies or analytics?","u":"faq.html#site","k":"FAQ","x":"Q11 Does this website use cookies or analytics? No. The site is a set of static files. It sets no cookies, stores nothing in your browser and makes no requests to other sites. The interactive demos and the search run inside the page and keep nothing. Link to this answer"},{"t":"Are the demos on this site the real app?","u":"faq.html#demos","k":"FAQ","x":"Q12 Are the demos on this site the real app? No. The capture filer, the working miniature on the home page and the weight projection are small re-implementations that run in the page, with fictional data, so you can see the behavior before opening the app. They cannot see or change the app’s data. The app itself is at Open the app . Link to this answer No qu"},{"t":"Features","u":"features.html","k":"Page","x":"What each of Northstar's fourteen modules does, from Today and Tasks to Finance, Body, Journal and Command, shown with the built-in demo dataset."},{"t":"Today","u":"features.html#today","k":"Features","x":"01 Module 01 of 14 Today Your day on one screen. 01.1 Where the day stands. Due, overdue, done and habits left, counted live from your records. 01.2 Suggested focus. Chosen by priority and due date. Pin the ones you commit to. 01.3 Context beside the list. Quarter goals, the next event and gentle nudges such as overdue work or no backup yet. Northstar · Toda"},{"t":"Planner","u":"features.html#planner","k":"Features","x":"02 Module 02 of 14 Planner Week and day views for events and tasks. 02.1 Week and day views. Step through weeks; today is always one click away. 02.2 Events and tasks together. A task due Friday sits beside Friday’s meetings. 02.3 Plan my day. Surfaces high-priority tasks that have no date yet. Northstar · Planner Fig. 02 Planner, demo dataset."},{"t":"Tasks","u":"features.html#tasks","k":"Features","x":"03 Module 03 of 14 Tasks Capture in one line, work from a queue. 03.1 The queue at a glance. Open, overdue, due today and done in the last 14 days. 03.2 Keyboard work. j and k move, x completes, Enter opens. 03.3 Details in a side panel. Due date, priority, recurrence and the goal link, without leaving the list. Northstar · Tasks Fig. 03 Tasks, demo dataset."},{"t":"Goals","u":"features.html#goals","k":"Features","x":"04 Module 04 of 14 Goals Life, year and quarter goals with real progress. 04.1 Life, year and quarter. Goals live at three horizons, filtered by status and area. 04.2 Linked work. Progress follows the tasks you actually complete. 04.3 Milestones. Break a goal into steps you can tick off. Quiet goals become a Command proposal. Northstar · Goals Fig. 04 Goals,"},{"t":"Habits","u":"features.html#habits","k":"Features","x":"05 Module 05 of 14 Habits Daily check-ins and streaks. 05.1 One tap a day. Check in from here or from Today. 05.2 Streaks with history. Edit a habit any time; every check-in is written to your timeline. Northstar · Habits Fig. 05 Habits, demo dataset."},{"t":"Finance","u":"features.html#finance","k":"Features","x":"06 Module 06 of 14 Finance Import, categorize, budget, see net worth. 06.1 Six tabs, one ledger. Overview, transactions, budgets, net worth, investments and import. 06.2 The month in four numbers. Income, spending, net and savings rate. 06.3 Charts with a table view. Every chart can switch to an accessible table. Northstar · Finance Fig. 06 Finance, demo dat"},{"t":"Food","u":"features.html#food","k":"Features","x":"07 Module 07 of 14 Food Meals, targets and what is left today. 07.1 What is left today. Calories and protein remaining against your targets. 07.2 Meal slots. Add from favorites, copy yesterday or save a template. 07.3 Repeat meals in a tap. Favorites and templates for what you eat often. Northstar · Food Fig. 07 Food, demo dataset."},{"t":"Body","u":"features.html#body","k":"Features","x":"08 Module 08 of 14 Body Weight trend and where it is heading. 08.1 Log in one line. Here, or w 136.4 in the capture bar. 08.2 Rate and projection. Change this week, 4-week rate and the date you reach your goal. 08.3 Trend over noise. A 7-day average line over faint daily weigh-ins. Northstar · Body Fig. 08 Body, demo dataset, fictional weights. Instrument / "},{"t":"Learning","u":"features.html#learning","k":"Features","x":"09 Module 09 of 14 Learning Courses, books and study time. 09.1 Planned, active, completed. Courses, books, skills and certifications with progress. 09.2 Log study time. One tap adds a session and keeps the streak going. 09.3 A weekly target. Study time measured against a goal you set. Northstar · Learning Fig. 09 Learning, demo dataset."},{"t":"People","u":"features.html#people","k":"Features","x":"10 Module 10 of 14 People Keep up with the people who matter. 10.1 Who is due. Each person has a contact cadence; overdue check-ins rise to the top. 10.2 One tap to log contact. Notes and history sit under Details. 10.3 Birthdays ahead. The next 30 days at a glance. Northstar · People Fig. 10 People, demo dataset."},{"t":"Journal","u":"features.html#journal","k":"Features","x":"11 Module 11 of 14 Journal Write privately, with an immersive focus mode. 11.1 Prompts and templates. Start from a prompt or write freely. 11.2 Focus mode. Hides everything but the page. 11.3 Patterns over time. A month map of writing days and a 90-day mood chart. Northstar · Journal Fig. 11 Journal, demo dataset."},{"t":"History","u":"features.html#history","k":"Features","x":"12 Module 12 of 14 History One timeline for your whole life. 12.1 Timeline and achievements. Milestones collect on their own wall. 12.2 Filter by area. Career, health, finance, learning, people and more. 12.3 One timeline. Tasks done, goals reached, wins and journal entries, in order. Northstar · History Fig. 12 History, demo dataset."},{"t":"Review","u":"features.html#review","k":"Features","x":"13 Module 13 of 14 Review A weekly review you can lock. 13.1 A digest written for you. Tasks done, goals, spending, meals, study and people for the week, plus what slipped. 13.2 Ratings trend. Rate each week and watch the line. 13.3 Lock it. Finished reviews stay exactly as written. Northstar · Review Fig. 13 Review, demo dataset."},{"t":"Command","u":"features.html#command","k":"Features","x":"14 Module 14 of 14 Command Proposals from your own data. You approve. 14.1 What needs you. Open proposals, what needs approval and what was auto-applied. 14.2 Proposals from your data. Overdue tasks, stalled goals, people to check in with, merchant categories. 14.3 You decide. Accept, modify, dismiss or snooze. Evidence and logic are one click away. Northsta"},{"t":"Things that work on every page.","u":"features.html#everywhere","k":"Features","x":"+ Across the app 6 entries + Things that work on every page. Capture bar One line creates tasks, transactions, meals, weights, wins and journal entries. Try the miniature . Search and commands Searches everything on-device and runs commands from the keyboard. Data Hub Import CSV, OFX/QFX statements, .ics calendars and .vcf contacts; export a full JSON backup"},{"t":"The common actions never need the mouse.","u":"features.html#shortcuts","k":"Features","x":"+ Keyboard Reference card K The common actions never need the mouse. Everywhere Search and run commands Ctrl K Same, on Mac Cmd K Focus the capture bar / Save the line Enter Close a panel or dialog Esc Tasks Next and previous task j k Complete the selected task x Open the selected task Enter Command Next and previous proposal j k Accept the selected proposal"},{"t":"Home","u":"index.html","k":"Page","x":"Northstar is a private, local-first life operations app. Tasks, goals, money, food, body, journal and people in one app that keeps every record on your device. Free to use."},{"t":"A working miniature. Tick, type, spend, log.","u":"index.html#instrument","k":"Home","x":"01 The instrument Fig. 2 01 A working miniature. Tick, type, spend, log. This is a small copy of the app’s core interactions, built into this page with fictional data. File a line from the capture bar and watch it land in the right module and on the History timeline. Northstar Capture a line (demo, nothing is saved) File Parses as: nothing yet Try $14 chipot"},{"t":"Seven lines on a Tuesday. One timeline at the end of it.","u":"index.html#day","k":"Home","x":"02 A day, filed Fig. 3 02 Seven lines on a Tuesday. One timeline at the end of it. Each module keeps its own records and also writes one event to History. Scroll through a day and watch the timeline fill. History · Tuesday Sun 19:00 07:12 Body Weighed in: 136.4 lb 08:40 Tasks Completed: Study session 12:35 Finance Expense: Chipotle $12.50 12:41 Food Lunch: b"},{"t":"The modules write to one History. Three views read it back.","u":"index.html#timeline","k":"Home","x":"03 One timeline Fig. 4 03 The modules write to one History. Three views read it back. Because every meaningful action is logged once, in order, the History page, the Achievements wall and the weekly review all see across your whole life instead of one app at a time. Fig. 4 Modules write records to their own tables and one event to History. Nothing reads acro"},{"t":"Your device is the source of truth. Sync carries locked boxes.","u":"index.html#where","k":"Home","x":"04 Where your data lives Fig. 5 04 Your device is the source of truth. Sync carries locked boxes. Northstar works fully offline with no account. Turn on end-to-end encrypted sync only if you want the same data on a phone and a laptop. This is what each side can see. Your device Every record, readable , in your browser’s database Your passphrase and keys. The"},{"t":"Fourteen modules, each one a page you can open.","u":"index.html#modules","k":"Home","x":"05 Index of modules 14 entries 05 Fourteen modules, each one a page you can open. Hover or focus an entry to preview it, shown with the built-in demo dataset. 01 Today Your day on one screen 02 Planner Week and day views for events and tasks 03 Tasks Capture in one line, work from a queue 04 Goals Life, year and quarter, with real progress 05 Habits Daily ch"},{"t":"Install","u":"install.html","k":"Page","x":"Use Northstar in a browser tab right away, or install it on iPhone, Android or desktop for its own window and icon. It works offline either way."},{"t":"Pick your device.","u":"install.html#platforms","k":"Install","x":"01 Instructions Fig. 1 3 01 Pick your device. This page guessed from your browser; switch if it guessed wrong. iPhone and iPad Android Desktop"},{"t":"After the first load, the network is optional.","u":"install.html#offline","k":"Install","x":"02 Offline behavior 02 After the first load, the network is optional. What works offline The app’s files are cached and Northstar opens with no connection. Your data is already on the device, so everything works offline: capture, tasks, planner, journal, finance and the rest. What waits for a connection Features that need the network, such as encrypted sync,"},{"t":"Ten minutes to know your way around.","u":"install.html#first-steps","k":"Install","x":"03 First steps 03 Ten minutes to know your way around. Open the app and choose Load demo to look around with fictional data, or start empty. Add a task with one line in the capture bar, for example call mom fri !1 . Create a goal and link a task to it, then plan your day in the Planner. Export a backup from Settings so you know how it works. Open the app"},{"t":"Privacy","u":"privacy.html","k":"Page","x":"Northstar keeps your records in your browser. Four optional connections exist, each off by default; this page lists exactly what each one sends and to whom."},{"t":"What leaves your device, switch by switch.","u":"privacy.html#explorer","k":"Privacy","x":"01 Explorer Fig. 1 01 What leaves your device, switch by switch. Every connection is off by default. Turn them on here to see what each one would send and to whom. This page changes nothing in the app. Encrypted sync Off by default Google Calendar Off by default Open Food Facts search Off by default Live bank feed (SimpleFIN) Off by default Sent Nothing. Wit"},{"t":"Static files, a database in your browser, nothing else by default.","u":"privacy.html#short","k":"Privacy","x":"02 The short version 02 Static files, a database in your browser, nothing else by default. The app is a set of static files. Once loaded, it reads and writes a database inside your browser (IndexedDB). By default it makes no network requests that carry your records. There are four optional connections, each off until you turn it on. A strict content security"},{"t":"Every connection, in one table.","u":"privacy.html#table","k":"Privacy","x":"03 Every connection Table 1 03 Every connection, in one table. Every connection Northstar can make, its default, what it sends and who can see it Feature Default What is sent, and where Who can see it Everything else (tasks, goals, journal, finance, food, body, people, history, settings) On device only Nothing. Stored in IndexedDB in your browser. You Encryp"},{"t":"What is kept, what is not, and how to erase it.","u":"privacy.html#details","k":"Privacy","x":"04 The details 04 What is kept, what is not, and how to erase it. What is not collected No accounts or sign-ins, unless you turn on sync. No analytics, advertising or tracking scripts. No cloud storage by default. No third-party requests from this website or the app at rest. No third-party fonts, CDNs or embeds. What is stored on your device Tasks and goals,"},{"t":"Roadmap","u":"roadmap.html","k":"Page","x":"What Northstar can do today, area by area, and what is being considered next. Written plainly, with no dates and no promises."},{"t":"Everything, by area.","u":"roadmap.html#log","k":"Roadmap","x":"01 Log 30 entries 01 Everything, by area. There is no changelog by version number yet. Filter by status or area. All Shipped Next Capture Planning Money Body and food Reflection Command Sync and data Platform 30 entries 01 Capture and search Shipped One-line capture for tasks, transactions, meals, weights, wins and journal entries Shipped Bulk add for many l"},{"t":"Security","u":"security.html","k":"Page","x":"How Northstar's optional end-to-end encrypted sync works: PBKDF2 with 600,000 rounds, a wrapped master key, AES-256-GCM per record, and exactly what the server can and cannot see."},{"t":"Every record is locked on your device before it leaves.","u":"security.html#idea","k":"Security","x":"01 The idea in one paragraph 01 Every record is locked on your device before it leaves. When you turn on sync, your device locks every record in its own box before sending it, and only you have the key. The server stores locked boxes. It can count them and see when they changed, but it cannot open them. Your passphrase is what unlocks the key, and your passp"},{"t":"Step by step, from passphrase to ciphertext.","u":"security.html#keys","k":"Security","x":"02 Key wrapping Fig. 1 02 Step by step, from passphrase to ciphertext. Pick a step to highlight its part of the drawing. Everything left of the rule happens on your devices; only what crosses it is stored in your Supabase project. 1 You choose a passphrase. Northstar stretches it into a key with PBKDF2-SHA256 using 600,000 rounds and a random salt. The delib"},{"t":"What the server can and cannot see.","u":"security.html#server","k":"Security","x":"03 What the server sees Table 1 03 What the server can and cannot see. The server can see Your account email and sign-in times Which tables exist and how many records each has When records were created, changed or deleted The size of each encrypted record The wrapped master key and salts, which are useless without your passphrase or recovery code The server "},{"t":"Nobody can recover your passphrase. That is the point.","u":"security.html#who-holds","k":"Security","x":"04 Who holds which key 04 Nobody can recover your passphrase. That is the point. Passphrase and recovery code They live in your head or your password manager. Northstar cannot recover them. Row-level security In your Supabase project, your signed-in account can only read and write its own rows. The app never contains a service-role key. Conflicts Resolved by"},{"t":"What this does not protect against.","u":"security.html#limits","k":"Security","x":"05 Limits 05 What this does not protect against. Someone with your unlocked device or browser profile. The local database is readable by the app. Use your device’s screen lock and disk encryption. Malware on your device, or a weak passphrase. Choose a long one. Backup files you export. They are plain JSON. Store them carefully. The exact network paths for ev"}]/*@end*/
  var css = $('link[rel="stylesheet"]'), BASE = css ? css.href.replace(/style\.css(\?.*)?$/, '') : ''
  var here = (location.pathname.split('/').pop() || 'index.html')
  var pal = null, palIn, palList, palSel = 0, palItems = []
  var buildPal = function () {
    pal = d.createElement('dialog'); pal.className = 'pal'; pal.setAttribute('aria-label', 'Search this site')
    pal.innerHTML = '<div class="pal-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>' +
      '<input class="pal-in" type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" aria-label="Search pages, sections and answers" placeholder="Search pages, sections and answers" autocomplete="off" spellcheck="false">' +
      '<button type="button" class="pal-x">Esc</button></div><ul class="pal-list" id="pal-list" role="listbox" aria-label="Results"></ul>' +
      '<div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span><span>Searches this site only, in the page</span></div>'
    d.body.appendChild(pal)
    palIn = $('.pal-in', pal); palList = $('.pal-list', pal)
    $('.pal-x', pal).addEventListener('click', function () { pal.close() })
    pal.addEventListener('click', function (e) { if (e.target === pal) pal.close() })
    palIn.addEventListener('input', function () { renderPal(palIn.value) })
    palIn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (palItems.length) { palSel = (palSel + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % palItems.length; markSel(true) } }
      else if (e.key === 'Enter') { e.preventDefault(); if (palItems[palSel]) go(palItems[palSel]) }
    })
    palList.addEventListener('click', function (e) { var o = e.target.closest('.pal-o'); if (o) go(palItems[+o.getAttribute('data-i')]) })
    palList.addEventListener('mousemove', function (e) { var o = e.target.closest('.pal-o'); if (o && +o.getAttribute('data-i') !== palSel) { palSel = +o.getAttribute('data-i'); markSel(false) } })
  }
  var hl = function (text, toks) {
    var out = esc(text)
    toks.forEach(function (t) { if (t.length > 1) out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') })
    return out
  }
  var snippet = function (x, toks) {
    var lx = x.toLowerCase(), at = -1
    toks.forEach(function (t) { var i = lx.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i })
    if (at < 0) return x.slice(0, 120)
    var s = Math.max(0, at - 40); return (s ? '…' : '') + x.slice(s, s + 140)
  }
  var renderPal = function (qs) {
    var q = qs.trim().toLowerCase(), toks = q.split(/\s+/).filter(Boolean), res
    if (!toks.length) {
      res = INDEX.filter(function (e) { return e.k === 'Page' || e.u.split('#')[0] === here }).map(function (e) { return { e: e, s: e.k === 'Page' ? 2 : 1 } })
    } else {
      res = INDEX.map(function (e) {
        var t = e.t.toLowerCase(), x = (e.x || '').toLowerCase(), s = 0
        for (var i = 0; i < toks.length; i++) {
          var tk = toks[i], inT = t.indexOf(tk), inX = x.indexOf(tk)
          if (inT < 0 && inX < 0) return null
          s += inT === 0 ? 8 : inT > 0 ? 5 : 1
        }
        if (e.k === 'Page') s += 1
        return { e: e, s: s }
      }).filter(Boolean).sort(function (a, b) { return b.s - a.s }).slice(0, 24)
    }
    palItems = res.map(function (r) { return r.e })
    palSel = 0
    if (!palItems.length) { palList.innerHTML = '<li class="pal-none" role="presentation">No match. Try a shorter word, such as “sync” or “backup”.</li>'; palIn.removeAttribute('aria-activedescendant'); return }
    palList.innerHTML = palItems.map(function (e, i) {
      var sub = toks.length ? snippet(e.x || '', toks) : (e.k === 'Page' ? e.x : 'On this page')
      return '<li class="pal-o" role="option" id="pal-o' + i + '" data-i="' + i + '" aria-selected="false"><span class="pal-t">' + hl(e.t, toks) + '</span><span class="pal-k">' + esc(e.k) + '</span><span class="pal-s">' + hl(sub || '', toks) + '</span></li>'
    }).join('')
    markSel(false)
  }
  var markSel = function (scroll) {
    $$('.pal-o', palList).forEach(function (o, i) { o.setAttribute('aria-selected', i === palSel ? 'true' : 'false') })
    var o = $('#pal-o' + palSel); if (o) { palIn.setAttribute('aria-activedescendant', o.id); if (scroll) o.scrollIntoView({ block: 'nearest' }) }
  }
  var go = function (e) {
    var parts = e.u.split('#'), page = parts[0] || 'index.html', hash = parts[1]
    pal.close()
    if (page === here && hash) {
      var t = d.getElementById(hash)
      if (t) {
        if (t.tagName === 'DETAILS') t.open = true
        history.pushState(null, '', '#' + hash)
        t.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
        if (!t.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|DETAILS)$/.test(t.tagName)) t.setAttribute('tabindex', '-1')
        t.focus({ preventScroll: true }); replay(t, 'flash')
        return
      }
    }
    location.href = BASE + e.u
  }
  var openPal = function () {
    if (!INDEX.length) return
    if (!pal) buildPal()
    if (pal.open) return
    palIn.value = ''; renderPal('')
    pal.showModal(); palIn.focus()
  }
  $$('[data-pal]').forEach(function (b) { b.addEventListener('click', openPal) })
  d.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (pal && pal.open) pal.close(); else openPal() }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openPal() }
  })
})()
