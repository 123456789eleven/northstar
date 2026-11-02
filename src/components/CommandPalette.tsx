// Global search + command palette (Ctrl/Cmd+K). Lazy-loaded from Shell. Search is on-device only (lib/search.ts);
// journal text appears only as a short snippet on screen and is never logged.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { searchAll, scoreFields, type SearchGroup } from '../lib/search'
import { openBulk } from '../features/bulk/openBulk'
import { NAV } from './nav'
import { useFocusTrap } from './useFocusTrap'
import { Icon, type IconName } from './Icons'
import { Kbd } from './Shortcuts'
import { openShortcuts } from './shortcutsData'
import { getSetting } from '../db'
import { DENSITY_KEY, normalizeDensity, setDensity } from './density'

interface Item {
  id: string
  group: string
  label: string
  secondary: string
  icon: IconName
  run: () => void
}

const GROUP_ICON: Record<string, IconName> = {
  Tasks: 'tasks', Goals: 'goals', Habits: 'habits', People: 'people', Journal: 'journal', Food: 'food',
  Learning: 'learning', Finance: 'finance', Calendar: 'planner', History: 'history',
}

/** Bold the first case-insensitive match of the query inside a label (no colour: weight only). */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<mark className="cp-mark">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

/** Shell listens for this and focuses/opens the capture bar. */
const CAPTURE_EVENT = 'ns:capture'

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const listId = `${uid}-list`
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<Array<{ group: SearchGroup; items: Item[] }>>([])
  const [active, setActive] = useState(0)
  const [searched, setSearched] = useState(true)
  useFocusTrap(ref, onClose)

  const go = (to: string) => () => { onClose(); navigate(to) }
  const baseItems = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { id: 'act:capture', group: 'Actions', icon: 'capture', label: 'New task', secondary: 'Focus the capture bar', run: () => { onClose(); setTimeout(() => window.dispatchEvent(new Event(CAPTURE_EVENT)), 0) } },
      { id: 'act:bulk', group: 'Actions', icon: 'plus', label: 'Add many items', secondary: 'Paste tasks, people, goals, meals, transactions', run: () => { onClose(); setTimeout(openBulk, 0) } },
      { id: 'act:backup', group: 'Actions', icon: 'data', label: 'Export or restore backup', secondary: 'Settings', run: go('/settings') },
      { id: 'act:density', group: 'Actions', icon: 'settings', label: 'Switch density', secondary: 'Comfortable or compact, this device', run: () => { onClose(); void getSetting(DENSITY_KEY, 'comfortable').then((d) => setDensity(normalizeDensity(d) === 'compact' ? 'comfortable' : 'compact')) } },
      { id: 'act:keys', group: 'Actions', icon: 'command', label: 'Keyboard shortcuts', secondary: 'Press ? anywhere', run: () => { onClose(); setTimeout(openShortcuts, 0) } },
    ]
    const pages = NAV.map((n): Item => ({ id: `nav:${n.to}`, group: 'Go to', icon: n.icon, label: n.label, secondary: n.group, run: go(n.to) }))
    return [...actions, ...pages]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search over records.
  useEffect(() => {
    const q = query.trim()
    if (!q) { setGroups([]); setSearched(true); return }
    setSearched(false)
    let stale = false
    const t = window.setTimeout(() => {
      searchAll(q).then((res) => {
        if (stale) return
        setGroups(res.map((g) => ({
          group: g.group,
          items: g.hits.map((h) => ({ id: h.id, group: h.group, icon: GROUP_ICON[h.group] ?? 'more', label: h.label, secondary: h.secondary, run: go(h.to) })),
        })))
        setSearched(true)
      }).catch(() => { if (!stale) { setGroups([]); setSearched(true) } })
    }, 120)
    return () => { stale = true; window.clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const sections = useMemo(() => {
    const q = query.trim()
    if (!q) {
      return [
        { name: 'Actions', items: baseItems.filter((i) => i.group === 'Actions') },
        { name: 'Go to', items: baseItems.filter((i) => i.group === 'Go to') },
      ]
    }
    const cmds = baseItems.filter((i) => scoreFields([i.label, i.id === 'act:keys' ? 'help shortcuts keys' : i.id === 'act:density' ? 'compact comfortable spacing' : ''], q) > 0)
    const out: Array<{ name: string; items: Item[] }> = []
    const acts = cmds.filter((i) => i.group === 'Actions')
    const pgs = cmds.filter((i) => i.group === 'Go to')
    if (acts.length) out.push({ name: 'Actions', items: acts })
    if (pgs.length) out.push({ name: 'Go to', items: pgs.slice(0, 5) })
    for (const g of groups) out.push({ name: g.group, items: g.items })
    return out
  }, [query, baseItems, groups])

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections])
  useEffect(() => { setActive(0) }, [flat])
  const optId = (i: number) => `${uid}-opt-${i}`

  useEffect(() => {
    listRef.current?.querySelector(`[id="${optId(active)}"]`)?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (flat.length ? (a + 1) % flat.length : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, flat.length - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); flat[active]?.run() }
  }

  const status = !searched ? 'Searching' : query.trim() && !flat.length ? 'No results' : `${flat.length} ${flat.length === 1 ? 'result' : 'results'}`
  let idx = -1

  return createPortal(
    <div className="cp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="cp" role="dialog" aria-modal="true" aria-label="Search and commands">
        <div className="cp-head">
          <svg className="cp-glass" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
          </svg>
          <input
            className="cp-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat.length ? optId(active) : undefined}
            aria-autocomplete="list"
            aria-label="Search tasks, goals, people, journal and more, or jump to a page"
            placeholder="Search or jump to…"
            value={query}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="sr-only" role="status" aria-live="polite">{status}</div>
        <div className="cp-list" role="listbox" id={listId} aria-label="Results" ref={listRef}>
          {sections.map((s) => (
            <div key={s.name} role="group" aria-labelledby={`${uid}-g-${s.name}`}>
              <div className="cp-group" id={`${uid}-g-${s.name}`}>{s.name}</div>
              {s.items.map((it) => {
                const i = ++idx
                return (
                  <div
                    key={it.id}
                    id={optId(i)}
                    role="option"
                    aria-selected={i === active}
                    className={`cp-opt ${i === active ? 'on' : ''}`}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => it.run()}
                  >
                    <span className="cp-ico" aria-hidden><Icon name={it.icon} /></span>
                    <span className="cp-label"><Highlight text={it.label} q={query.trim()} /></span>
                    <span className="cp-sec">{it.secondary}</span>
                    <span className="cp-enter" aria-hidden><kbd className="kbd">Enter</kbd></span>
                  </div>
                )
              })}
            </div>
          ))}
          {!searched && query.trim() && !flat.length && <div className="cp-empty" aria-hidden><span className="cp-empty-title">Searching</span></div>}
          {searched && query.trim() && !flat.length && (
            <div className="cp-empty">
              <span className="cp-empty-title">No matches for &ldquo;{query.trim()}&rdquo;</span>
              <span>Search covers tasks, goals, habits, people, journal, food, learning, money and history, on this device only. Try a shorter word.</span>
            </div>
          )}
        </div>
        <div className="cp-foot">
          <span className="cp-hint">
            <span className="cp-hint-item"><Kbd k={['Up']} /><Kbd k={['Down']} /> move</span>
            <span className="cp-hint-item"><Kbd k={['Enter']} /> open</span>
            <span className="cp-hint-item"><Kbd k={['Esc']} /> close</span>
          </span>
          <button type="button" className="btn btn-ghost btn-sm cp-keys" onClick={() => { onClose(); setTimeout(openShortcuts, 0) }}>
            Shortcuts <Kbd k={['?']} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
