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
  var INDEX = /*@index*/[{"t":"FAQ","u":"faq.html","k":"Page","x":"Answers about data loss, backups, sync passphrases, multiple devices, bank connections, cost, who built Northstar, its source code and offline use."},{"t":"Will I lose my data?","u":"faq.html#lose-data","k":"FAQ","x":"Q01 Will I lose my data? Your data lives in your browser on your device. Clearing site data for Northstar, using a browser’s “clear everything” option, or losing the device can erase it. Without sync or a backup there is no other copy, so export a JSON backup from Settings regularly. Northstar nudges you if you have never exported one. Link to this answer"},{"t":"How do backups work?","u":"faq.html#backups","k":"FAQ","x":"Q02 How do backups work? In Settings, Export backup downloads one file of everything, either plain JSON or encrypted with a passphrase you choose (at least 12 characters, stretched with 600,000 PBKDF2 rounds before AES-GCM). Import restores it as a single step, so a failed import cannot leave things half-written. A plain file is readable, so store it like any personal document; an encrypted one cannot be opened without the passphrase, which Northstar never stores. Link to this answer"},{"t":"Can I use it on more than one device?","u":"faq.html#devices","k":"FAQ","x":"Q03 Can I use it on more than one device? Yes. Turn on encrypted sync in Settings on each device, with your own Supabase project and the same passphrase. Or skip sync and move data by exporting a backup on one device and importing it on another. Link to this answer"},{"t":"Does it work offline?","u":"faq.html#offline","k":"FAQ","x":"Q04 Does it work offline? Yes. After the first load, the app opens without a connection and everything that works on local data keeps working. Sync, Google Calendar and food search wait until you are online. See Install . Link to this answer"},{"t":"What if I forget my sync passphrase?","u":"faq.html#passphrase","k":"FAQ","x":"Q05 What if I forget my sync passphrase? If you still have your one-time recovery code, you can use it to regain access. If you lose both the passphrase and the recovery code, nobody can decrypt the cloud copy, including Northstar and Supabase. Each device keeps its own readable copy, so export a backup and set sync up again. Link to this answer"},{"t":"How do bank connections work?","u":"faq.html#banks","k":"FAQ","x":"Q06 How do bank connections work? By default they do not. You export a CSV or OFX/QFX file from your bank and import it; Northstar never asks for bank credentials. There is an optional live feed through SimpleFIN, off by default, which uses a small relay in your own Supabase project. See the privacy explorer for exactly what it sends. Link to this answer"},{"t":"Does it send my data anywhere or track me?","u":"faq.html#tracking","k":"FAQ","x":"Q07 Does it send my data anywhere or track me? No tracking or analytics. Only four opt-in connections can send anything: encrypted sync, read-only Google Calendar, Open Food Facts search and the SimpleFIN bank feed. The Privacy page lists exactly what each one sends. Link to this answer"},{"t":"How much does it cost?","u":"faq.html#cost","k":"FAQ","x":"Q08 How much does it cost? Nothing. It is free to use, with no ads and no accounts. Sync uses a Supabase project that you create, which has its own plan and limits. Link to this answer"},{"t":"Who built it?","u":"faq.html#who","k":"FAQ","x":"Q09 Who built it? One person, mainly for their own use, and then made available to anyone. There is no company behind it and no data collection to fund. Link to this answer"},{"t":"Is it open source?","u":"faq.html#open-source","k":"FAQ","x":"Q10 Is it open source? The source code is in a public repository, so it is viewable. A license has not been chosen yet, so please treat it as viewable but not yet licensed for reuse. Link to this answer"},{"t":"Does this website use cookies or analytics?","u":"faq.html#site","k":"FAQ","x":"Q11 Does this website use cookies or analytics? No. The site is a set of static files. It sets no cookies, stores nothing in your browser and makes no requests to other sites. The search runs inside the page and keeps nothing. Link to this answer"},{"t":"Are the screenshots on this site real?","u":"faq.html#demos","k":"FAQ","x":"Q12 Are the screenshots on this site real? They are real screenshots of the app, but they show the built-in demo data, not a real person’s records. You can load the same demo data from the app to look around, and clear it afterwards. The app is at Open the app . Link to this answer"},{"t":"Does it nag me?","u":"faq.html#nag","k":"FAQ","x":"Q13 Does it nag me? No. There are no push notifications. A missed day gets one plain line, such as “No entries Tuesday,” and nothing is taken away. Today’s plan ticks itself off when the matching record appears, so there is nothing to check by hand. Link to this answer"},{"t":"What is the weekly recap image?","u":"faq.html#recap","k":"FAQ","x":"Q14 What is the weekly recap image? The You page can turn your week into a single image: the numbers for the week, drawn on your device. Saving or sharing it is up to you. Northstar does not upload it anywhere. Link to this answer"},{"t":"Features","u":"features.html","k":"Page","x":"What Northstar does today: Today, Plan, Money, Areas and You. A calm, private, local-first life dashboard that keeps your data on your device."},{"t":"Home","u":"index.html","k":"Page","x":"Northstar is a calm, private, local-first life dashboard. Today’s plan, money, body, mind, career and people in one app that keeps your data on your device. Free to use, no account."},{"t":"Each place answers one question.","u":"index.html#places","k":"Home","x":"§ 01 What is in it Today, Plan, Money, Areas, You 01 Each place answers one question. What is on today, what is coming, what is safe to spend, how you are doing, and what you have finished. Plan. Tasks, the planner, goals and habits, with progress that follows what you finish. Money. Safe to spend, bills, net worth and investments. Numbers first. Areas. Body, mind, career and people, each with the records behind its ring. You. Milestones, the season, and a weekly recap you can save or share as an image. Every screenshot on this site uses the demo data, not a real person’s records."},{"t":"On your device. Sync is opt-in.","u":"index.html#where","k":"Home","x":"§ 02 Where your data lives Privacy 02 On your device. Sync is opt-in. The app is a set of static files. Once loaded, it reads and writes a database inside your browser. By default no request carries your records anywhere. 02.1 Local first. The copy on your device is the source of truth, and the app works offline after the first load. 02.2 Encrypted sync, if you want it. Each record is encrypted on your device before it leaves, to a Supabase project you create. The server cannot read it. How it works . 02.3 Banks, your way. Import a CSV or OFX file you pick yourself. Northstar never asks for ba"},{"t":"Install","u":"install.html","k":"Page","x":"Use Northstar in a browser tab right away, or install it on iPhone, Android or desktop for its own window and icon. It works offline either way."},{"t":"Pick your device.","u":"install.html#platforms","k":"Install","x":"§ 01 Instructions Fig. 1–3 01 Pick your device. This page guessed from your browser; switch if it guessed wrong. iPhone and iPad Android Desktop iPhone and iPad Step 1 Open the app in Safari and tap Share. It must be Safari. The Share button is in the toolbar. Step 2 Choose Add to Home Screen, then Add. Scroll the share sheet if you do not see it. Step 3 Open Northstar from your Home Screen. It opens in its own window, without the browser bar."},{"t":"After the first load, the network is optional.","u":"install.html#offline","k":"Install","x":"§ 02 Offline behavior 02 After the first load, the network is optional. What works offline The app’s files are cached and Northstar opens with no connection. Your data is already on the device, so everything works offline: capture, tasks, planner, journal, finance and the rest. What waits for a connection Features that need the network, such as encrypted sync, Google Calendar and food search, wait until you are back online. Updates When a new version is ready, the app offers to update; your data is not touched. Data is per device and per browser Your phone and laptop do not share data unless y"},{"t":"Ten minutes to know your way around.","u":"install.html#first-steps","k":"Install","x":"§ 03 First steps 03 Ten minutes to know your way around. Open the app and choose Load demo to look around with fictional data, or start empty. Add a task with one line in the capture bar, for example call mom fri !1 . Create a goal and link a task to it, then plan your day in the Planner. Export a backup from Settings so you know how it works. Open the app"},{"t":"Privacy","u":"privacy.html","k":"Page","x":"Northstar keeps your records in your browser. Four optional connections exist, each off by default; this page lists exactly what each one sends and to whom."},{"t":"What leaves your device, switch by switch.","u":"privacy.html#explorer","k":"Privacy","x":"§ 01 Explorer Fig. 1 01 What leaves your device, switch by switch. Every connection is off by default. Turn them on here to see what each one would send and to whom. This page changes nothing in the app. Encrypted sync Off by default Google Calendar Off by default Open Food Facts search Off by default Live bank feed (SimpleFIN) Off by default Sent Nothing. With every option off, your records stay in IndexedDB on this device and no request carries them. Encrypted sync: each record as AES-256-GCM ciphertext, plus metadata (account email, table names, opaque ids, counts, timestamps, sizes), to a "},{"t":"Static files, a database in your browser, nothing else by default.","u":"privacy.html#short","k":"Privacy","x":"§ 02 The short version 02 Static files, a database in your browser, nothing else by default. The app is a set of static files. Once loaded, it reads and writes a database inside your browser (IndexedDB). By default it makes no network requests that carry your records. There are four optional connections, each off until you turn it on. A strict content security policy limits what the app can connect to, and fonts are self-hosted. This website makes no requests to any other site, sets no cookies and stores nothing in your browser."},{"t":"Every connection, in one table.","u":"privacy.html#table","k":"Privacy","x":"§ 03 Every connection Table 1 03 Every connection, in one table. Every connection Northstar can make, its default, what it sends and who can see it Feature Default What is sent, and where Who can see it Everything else (tasks, goals, journal, finance, food, body, people, history, settings) On device only Nothing. Stored in IndexedDB in your browser. You Encrypted sync Off Each record, encrypted on your device with AES-256-GCM, plus metadata, to a Supabase project you create. Your passphrase, recovery code and keys never leave your devices. Supabase sees your account email, table names, opaque "},{"t":"What is kept, what is not, and how to erase it.","u":"privacy.html#details","k":"Privacy","x":"§ 04 The details 04 What is kept, what is not, and how to erase it. What is not collected No accounts or sign-ins, unless you turn on sync. No analytics, advertising or tracking scripts. No cloud storage by default. No third-party requests from this website or the app at rest. No third-party fonts, CDNs or embeds. What is stored on your device Tasks and goals, finance transactions and budgets, planner events, habits, journal entries and mood, meals and weights, learning items, people and contact notes, your history timeline, and settings. Backups are JSON files that you export and import yours"},{"t":"Roadmap","u":"roadmap.html","k":"Page","x":"What Northstar can do today, area by area, and what is being considered next. Written plainly, with no dates and no promises."},{"t":"Everything, by area.","u":"roadmap.html#log","k":"Roadmap","x":"§ 01 Log 41 entries 01 Everything, by area. There is no changelog by version number yet. Filter by status or area. All Shipped Next Capture Plan Money Body and food Areas and recap Intel Sync and data Platform 41 entries 01 Capture and search Shipped One-line capture for tasks, transactions, meals, weights, wins and journal entries Shipped Bulk add for many lines at once Shipped Search and command palette, on-device; a result opens the exact record Shipped Phone capture button in the bottom bar, with one-tap quick logs"},{"t":"Security","u":"security.html","k":"Page","x":"How Northstar's optional end-to-end encrypted sync works: PBKDF2 with 600,000 rounds, a wrapped master key, AES-256-GCM per record, and exactly what the server can and cannot see."},{"t":"Every record is locked on your device before it leaves.","u":"security.html#idea","k":"Security","x":"§ 01 The idea in one paragraph 01 Every record is locked on your device before it leaves. When you turn on sync, your device locks every record in its own box before sending it, and only you have the key. The server stores locked boxes. It can count them and see when they changed, but it cannot open them. Your passphrase is what unlocks the key, and your passphrase never leaves your devices."},{"t":"Step by step, from passphrase to ciphertext.","u":"security.html#keys","k":"Security","x":"§ 02 Key wrapping Fig. 1 02 Step by step, from passphrase to ciphertext. Pick a step to highlight its part of the drawing. Everything left of the rule happens on your devices; only what crosses it is stored in your Supabase project. 1 You choose a passphrase. Northstar stretches it into a key with PBKDF2-SHA256 using 600,000 rounds and a random salt. The deliberate slowness makes guessing passphrases expensive. Passphrases are at least 12 characters. 2 A master key is wrapped twice. A random master key is made on your first device. It is wrapped (AES-KW) by your passphrase-derived key, and aga"},{"t":"What the server can and cannot see.","u":"security.html#server","k":"Security","x":"§ 03 What the server sees Table 1 03 What the server can and cannot see. The server can see Your account email and sign-in times Which tables exist and how many records each has When records were created, changed or deleted The size of each encrypted record The wrapped master key and salts, which are useless without your passphrase or recovery code The server cannot see The text, amounts, dates or names inside any record Your passphrase, recovery code or unwrapped keys Which task, goal, transaction or journal entry a box is Anything in device-only settings, which never sync Sizes and counts ar"},{"t":"Nobody can recover your passphrase. That is the point.","u":"security.html#who-holds","k":"Security","x":"§ 04 Who holds which key 04 Nobody can recover your passphrase. That is the point. Passphrase and recovery code They live in your head or your password manager. Northstar cannot recover them. Row-level security In your Supabase project, your signed-in account can only read and write its own rows. The app never contains a service-role key. Conflicts Resolved by the newest change, using a timestamp inside the ciphertext, so the server cannot reorder your edits. Lose both and the cloud copy is gone If you lose your passphrase and your recovery code, nobody can decrypt the cloud copy, including yo"},{"t":"What this does not protect against.","u":"security.html#limits","k":"Security","x":"§ 05 Limits 05 What this does not protect against. Someone with your unlocked device or browser profile. The local database is readable by the app. Use your device’s screen lock and disk encryption. Malware on your device, or a weak passphrase. Choose a long one. Backup files you export. They are plain JSON. Store them carefully. The exact network paths for every opt-in feature are on the Privacy page . Setup instructions for sync are in the repository under supabase/README.md ."}]
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
