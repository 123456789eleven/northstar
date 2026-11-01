/* Northstar site: progressive enhancement only. Every page is complete without this file.
   No network requests, no storage, no analytics. Each block runs only if its markup exists. */
(function () {
  'use strict'
  var d = document, root = d.documentElement
  root.classList.add('js')
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var sup = function (q) { return !!(window.CSS && CSS.supports && CSS.supports(q)) }
  var hasView = sup('animation-timeline: view()')
  var hasScroll = sup('animation-timeline: scroll()')
  var $ = function (s, el) { return (el || d).querySelector(s) }
  var $$ = function (s, el) { return Array.prototype.slice.call((el || d).querySelectorAll(s)) }
  var inView = function (el) { var r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 }
  var live = $('#live')
  var say = function (msg) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = msg }, 30) } }

  /* ---- sticky header hairline (fallback for browsers without scroll timelines) ---- */
  var head = $('.site-head')
  if (head && (!hasScroll || reduce)) {
    var onScroll = function () { head.classList.toggle('scrolled', window.scrollY > 8) }
    onScroll(); addEventListener('scroll', onScroll, { passive: true })
  }

  /* ---- reveal-on-scroll fallback (IntersectionObserver) ---- */
  if (!hasView && !reduce && 'IntersectionObserver' in window) {
    var els = $$('.rv, .rv-kids, .draw-on, .tl-wrap, .tl > li')
    els.forEach(function (e) { if (inView(e)) e.classList.add('in') })
    root.classList.add('io')
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } })
    }, { rootMargin: '0px 0px -8% 0px' })
    els.forEach(function (e) { if (!e.classList.contains('in')) io.observe(e) })
  }

  /* ---- one-shot "in view" flag for marker pings ---- */
  if (!reduce && 'IntersectionObserver' in window) {
    var feats = $$('.feat')
    var io3 = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add(x.target.classList.contains('arch') ? 'live' : 'in'); io3.unobserve(x.target) } })
    }, { threshold: 0.35 })
    feats.forEach(function (f) { io3.observe(f) })
    $$('.arch').forEach(function (a) { io3.observe(a) })
  }

  /* ---- count-ups for real counts ---- */
  var counters = $$('[data-count]')
  if (counters.length && !reduce && 'IntersectionObserver' in window) {
    var fmt = function (n) { return Math.round(n).toLocaleString('en-US') }
    var run = function (el) {
      var to = +el.getAttribute('data-count'), final = el.getAttribute('data-final'), t0 = performance.now(), dur = to > 100 ? 1400 : 900
      var step = function (t) {
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3)
        el.textContent = fmt(to * e)
        if (p < 1) requestAnimationFrame(step); else el.textContent = final
      }
      requestAnimationFrame(step)
    }
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { io2.unobserve(x.target); run(x.target) } })
    }, { threshold: 0.6 })
    counters.forEach(function (c) { if (inView(c)) return; c.setAttribute('data-final', c.textContent); c.textContent = '0'; io2.observe(c) })
  }

  /* ---- tabs (module showcase): roving focus, arrow keys, automatic activation ---- */
  $$('[role="tablist"]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list)
    var select = function (tab, focus, animate) {
      tabs.forEach(function (t) {
        var on = t === tab, panel = d.getElementById(t.getAttribute('aria-controls'))
        t.setAttribute('aria-selected', on ? 'true' : 'false')
        t.tabIndex = on ? 0 : -1
        if (panel) {
          panel.hidden = !on
          if (on && animate && !reduce) { panel.classList.remove('enter'); void panel.offsetWidth; panel.classList.add('enter') }
        }
      })
      if (focus) tab.focus()
    }
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
      // warm the image before the click
      t.addEventListener('pointerenter', function () {
        var p = d.getElementById(t.getAttribute('aria-controls'))
        $$('img[loading="lazy"]', p || d.createElement('i')).forEach(function (img) { img.loading = 'eager' })
      }, { once: true })
    })
    select(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true' })[0] || tabs[0], false, false)
  })

  /* ---- clipboard ---- */
  var copyText = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text)
    return new Promise(function (res, rej) {
      var ta = d.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only'
      d.body.appendChild(ta); ta.select()
      try { d.execCommand('copy') ? res() : rej() } catch (e) { rej(e) } finally { ta.remove() }
    })
  }
  $$('.copy[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy')
      copyText(text).then(function () {
        b.classList.add('done'); say('Copied ' + text)
        setTimeout(function () { b.classList.remove('done') }, 1600)
      }, function () { say('Copy failed. Select the text and copy it manually.') })
    })
  })

  /* ---- capture playground: a small re-implementation of src/lib/capture.ts (demo) ---- */
  var capIn = $('#cap-in')
  if (capIn) {
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
    var long = function (dt) { return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }
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
    var view = function (c) {
      switch (c.kind) {
        case 'task': return {
          chips: ['Task', c.due && label(c.due), c.pri !== 2 && PRI[c.pri], c.rec !== 'none' && c.rec, c.goal && c.goal.title],
          rows: [['Title', c.title || '(empty)'], ['Due', c.due ? long(c.due) : 'No date'], ['Priority', PRI[c.pri]], ['Repeats', c.rec === 'none' ? 'No' : c.rec], ['Goal', c.goal ? c.goal.title : 'None']],
          where: 'Files into Tasks. Completing it is logged to History' + (c.goal ? ' and moves the goal.' : '.') }
        case 'transaction': return {
          chips: [c.income ? 'Income' : 'Expense', usd(c.amount)],
          rows: [['Amount', (c.income ? '+' : '−') + usd(c.amount)], ['Description', c.desc], ['Date', long(today())], ['Category', 'Filled by your merchant rules']],
          where: 'Files into Finance, Transactions.' }
        case 'meal': return {
          chips: ['Meal', c.slot, c.cal != null && c.cal + ' cal'],
          rows: [['Food', c.name], ['Slot', c.slot], ['Calories', c.cal != null ? c.cal.toLocaleString('en-US') : 'Not set'], ['Date', long(c.date)]],
          where: 'Files into Food and updates what is left today.' }
        case 'weight': return {
          chips: ['Weight', c.weight + ' lb', !same(c.date, today()) && label(c.date)],
          rows: [['Weight', c.weight.toFixed(1) + ' lb'], ['Date', long(c.date)]],
          where: 'Files into Body and moves the 7-day average.' }
        case 'journal': return { chips: ['Journal entry'], rows: [['Text', c.text], ['Entry', 'Today, appended']], where: 'Adds to today’s Journal entry. Stays on this device.' }
        case 'win': return { chips: ['Win', c.area.charAt(0).toUpperCase() + c.area.slice(1)], rows: [['Title', c.title], ['Area', c.area]], where: 'Lands on your History timeline as a win.' }
        default: return { chips: [], rows: [], where: 'Type a line to see how it would be filed.' }
      }
    }
    var chipsEl = $('#cap-chips'), rowsEl = $('#cap-fields'), whereEl = $('#cap-where-t'), lastSig = ''
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] }) }
    var render = function () {
      var v = view(parse(capIn.value)), chips = v.chips.filter(Boolean), sig = chips.join('|')
      var anim = sig !== lastSig && !reduce
      chipsEl.innerHTML = chips.map(function (c, i) { return '<span class="cap-chip' + (i === 0 ? ' kind' : '') + (anim ? ' pop' : '') + '">' + esc(c) + '</span>' }).join('')
      rowsEl.innerHTML = v.rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd' + (/^(No|None|No date|Not set)$/.test(r[1]) ? ' class="dim"' : '') + '>' + esc(r[1]) + '</dd>' }).join('')
      whereEl.textContent = v.where
      lastSig = sig
    }
    var announce
    capIn.addEventListener('input', function () { render(); clearTimeout(announce); announce = setTimeout(function () { say('Filed as: ' + (chipsEl.textContent ? $$('.cap-chip', chipsEl).map(function (c) { return c.textContent }).join(', ') : 'nothing yet')) }, 700) })
    capIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); say('Demo only: nothing was saved. Filed as ' + $$('.cap-chip', chipsEl).map(function (c) { return c.textContent }).join(', ')) } })
    $$('button.ex-try').forEach(function (b) {
      b.addEventListener('click', function () {
        capIn.value = b.getAttribute('data-line'); render()
        $$('button.ex-try').forEach(function (x) { x.classList.toggle('on', x === b) })
        var box = $('.cap'); if (box && !inView(box)) box.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
        say('Filed as: ' + $$('.cap-chip', chipsEl).map(function (c) { return c.textContent }).join(', '))
      })
    })
    render()
  }

  /* ---- command proposal stepper ---- */
  var prop = $('#prop')
  if (prop) {
    var sbtns = $$('.step-btn'), cur = 1
    var MSG = { 1: 'Step 1, proposed. Nothing has changed yet.', 2: 'Step 2, approved. Three transactions categorized; undo available for 24 hours.', 3: 'Step 3, undone. The three transactions are back to Uncategorized.' }
    var go = function (n) {
      cur = Math.max(1, Math.min(3, n))
      prop.setAttribute('data-step', String(cur))
      sbtns.forEach(function (b) { if (+b.getAttribute('data-step') === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current') })
      $('#prop-state').textContent = ['', 'Proposed', 'Applied', 'Undone'][cur]
      $('#step-prev').disabled = cur === 1
      $('#step-next').textContent = cur === 3 ? 'Start over' : 'Next step'
      say(MSG[cur])
    }
    sbtns.forEach(function (b) { b.addEventListener('click', function () { go(+b.getAttribute('data-step')) }) })
    $('#step-prev').addEventListener('click', function () { go(cur - 1) })
    $('#step-next').addEventListener('click', function () { go(cur === 3 ? 1 : cur + 1) })
    prop.setAttribute('data-step', '1')
  }

  /* ---- weight projection calculator (same math as the Body module) ---- */
  var calc = $('#calc')
  if (calc) {
    var ci = $('#c-cur'), cg = $('#c-goal'), cr = $('#c-rate'), svg = $('#c-svg'), msg = $('#c-msg')
    var NS = 'http://www.w3.org/2000/svg'
    var el = function (tag, attrs, text) { var e = d.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e }
    var W = 560, H = 220, L = 44, R = 16, T = 16, B = 28
    var draw = function (animate) {
      var cur = parseFloat(ci.value), goal = parseFloat(cg.value), rate = parseFloat(cr.value)
      var out = function (a, b, c) { $('#c-weeks').textContent = a; $('#c-date').textContent = b; $('#c-delta').textContent = c }
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      if (!(cur >= 50 && cur <= 700) || !(goal >= 50 && goal <= 700)) { out('–', '–', '–'); msg.textContent = 'Enter a current and goal weight between 50 and 700 lb.'; return }
      var dist = Math.abs(goal - cur), dir = goal >= cur ? 1 : -1
      if (dist < 0.05) { out('0', 'Today', '0.0 lb'); msg.textContent = 'You are already at your goal weight.'; return }
      if (!(rate > 0.01)) { out('–', '–', (dir > 0 ? '+' : '−') + dist.toFixed(1) + ' lb'); msg.textContent = 'Projection needs a weekly rate above zero.'; return }
      if (rate > 3) { msg.textContent = 'Rates above 3 lb a week are outside what the Body module projects.'; out('–', '–', '–'); return }
      var days = Math.ceil((dist / rate) * 7), weeks = Math.ceil(dist / rate)
      var end = new Date(); end.setDate(end.getDate() + days)
      out(String(weeks), end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: end.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }), (dir > 0 ? '+' : '−') + dist.toFixed(1) + ' lb')
      msg.textContent = 'At ' + rate + ' lb a week you reach ' + goal + ' lb in about ' + weeks + ' week' + (weeks === 1 ? '' : 's') + ', around ' + long2(end) + '.'
      var lo = Math.min(cur, goal), hi = Math.max(cur, goal), pad = Math.max(1, (hi - lo) * 0.12)
      var y0 = lo - pad, y1 = hi + pad
      var X = function (wk) { return L + (W - L - R) * (wk / weeks) }, Y = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)) }
      // grid: 4 horizontal lines with labels
      for (var i = 0; i <= 3; i++) {
        var v = y0 + (y1 - y0) * (i / 3), yy = Y(v)
        svg.appendChild(el('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: 'grid' }))
        svg.appendChild(el('text', { x: L - 8, y: yy + 4, 'text-anchor': 'end', class: 'axis' }, v.toFixed(0)))
      }
      var ticks = Math.min(6, weeks)
      for (var k = 0; k <= ticks; k++) {
        var wk = Math.round(weeks * k / ticks)
        svg.appendChild(el('text', { x: X(wk), y: H - 8, 'text-anchor': k === 0 ? 'start' : k === ticks ? 'end' : 'middle', class: 'axis' }, k === 0 ? 'Now' : wk + 'w'))
      }
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: Y(goal), y2: Y(goal), class: 'goal' }))
      svg.appendChild(el('text', { x: W - R, y: Y(goal) + (dir > 0 ? -8 : 16), 'text-anchor': 'end', class: 'lbl' }, 'Goal ' + goal + ' lb'))
      var path = el('path', { d: 'M' + X(0) + ' ' + Y(cur) + ' L' + X(weeks) + ' ' + Y(goal), class: 'path' + (animate && !reduce ? ' draw-path' : ''), pathLength: '1' })
      svg.appendChild(path)
      // milestones every 5 lb between start and goal (as Body does)
      var first = dir > 0 ? Math.floor(cur / 5) * 5 + 5 : Math.ceil(cur / 5) * 5 - 5
      for (var m = first; dir > 0 ? m < goal : m > goal; m += 5 * dir) {
        var wkm = Math.abs(m - cur) / rate
        svg.appendChild(el('circle', { cx: X(wkm), cy: Y(m), r: 4, class: 'ms' }))
      }
      svg.appendChild(el('circle', { cx: X(weeks), cy: Y(goal), r: 5, class: 'end' }))
      svg.appendChild(el('circle', { cx: X(0), cy: Y(cur), r: 4, class: 'ms' }))
      svg.setAttribute('aria-label', 'Projected line from ' + cur + ' lb now to ' + goal + ' lb in ' + weeks + ' weeks, with a marker every 5 lb.')
    }
    var long2 = function (dt) { return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
    var t
    ;[ci, cg, cr].forEach(function (x) { x.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { draw(true) }, 120) }) })
    calc.addEventListener('submit', function (e) { e.preventDefault(); draw(true) })
    draw(false)
  }

  /* ---- "what leaves your device" explorer ---- */
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
      })
      none.classList.toggle('off', any)
    }
    sws.forEach(function (s) {
      s.addEventListener('change', function () {
        upd()
        say(s.getAttribute('aria-label') + (s.checked ? ' on. ' : ' off. ') + (s.checked ? $('.sent li[data-f="' + s.getAttribute('data-f') + '"]', ex).textContent : ''))
      })
    })
    upd()
  }

  /* ---- FAQ: hash deep links, filter, expand all ---- */
  var faq = $('.faq')
  if (faq) {
    var items = $$('details', faq), bulk = false
    var openHash = function () {
      var id = decodeURIComponent(location.hash.slice(1)), t = id && d.getElementById(id)
      if (t && t.tagName === 'DETAILS') { t.open = true; t.scrollIntoView({ block: 'start' }); $('summary', t).focus({ preventScroll: true }) }
    }
    items.forEach(function (det) {
      det.addEventListener('toggle', function () {
        if (bulk) return
        if (det.open) history.replaceState(null, '', '#' + det.id)
        else if (location.hash === '#' + det.id) history.replaceState(null, '', location.pathname + location.search)
      })
    })
    addEventListener('hashchange', openHash)
    openHash()
    var q = $('#faq-q'), count = $('#faq-count'), empty = $('#faq-empty')
    if (q) {
      q.addEventListener('input', function () {
        var s = q.value.trim().toLowerCase(), n = 0
        items.forEach(function (det) {
          var hit = !s || det.textContent.toLowerCase().indexOf(s) >= 0
          det.hidden = !hit; if (hit) n++
          det.classList.toggle('hit', !!s && hit)
        })
        count.textContent = s ? n + ' of ' + items.length + ' questions' : items.length + ' questions'
        empty.hidden = n > 0
      })
    }
    var all = $('#faq-all')
    if (all) all.addEventListener('click', function () {
      var open = all.getAttribute('aria-pressed') !== 'true'
      bulk = true
      items.forEach(function (det) { if (!det.hidden) det.open = open })
      setTimeout(function () { bulk = false }, 0)
      all.setAttribute('aria-pressed', open ? 'true' : 'false')
      all.textContent = open ? 'Collapse all' : 'Expand all'
    })
  }
})()
