// App shell chrome: the top bar (district and tab, capture, search, sync, date, the You profile control), the phone capture
// orb and capture sheet. Primary navigation is the district strip (DistrictStrip.tsx); see docs/redesign/CITY_SHELL_PLAN.md.
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from '../db'
import { parseISODate, today } from '../lib/dates'
import QuickCapture from './QuickCapture'
import BulkHost from '../features/bulk/BulkHost'
import { SetupHost } from '../features/onboarding/SetupWizard'
import BottomSheet from './BottomSheet'
import { Icon, type IconName } from './Icons'
import { breadcrumb, districtForPath } from './districts'
import { useMedia, PHONE_QUERY } from './useMedia'
import { PlayerStrip } from '../features/game/ui/Mission'
import './shell.css'

const CommandPalette = lazy(() => import('./CommandPalette'))
const OPEN_PALETTE = 'ns:palette'
/** Opens the phone capture sheet (orb, PWA shortcut, palette "New task" on phone). */
export const OPEN_CAPTURE_SHEET = 'ns:capture-sheet'
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Owns Ctrl/Cmd+K and mounts the lazy-loaded palette only once it is first opened. */
function PaletteHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        e.stopImmediatePropagation() // the capture bar also listens for Ctrl+K; the palette takes it over
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener(OPEN_PALETTE, onOpen)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener(OPEN_PALETTE, onOpen) }
  }, [])
  if (!open) return null
  return <Suspense fallback={null}><CommandPalette onClose={() => setOpen(false)} /></Suspense>
}

function SearchButton({ compact }: { compact: boolean }) {
  const open = () => window.dispatchEvent(new Event(OPEN_PALETTE))
  const glass = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
    </svg>
  )
  return compact ? (
    <button className="icon-btn" onClick={open} aria-label="Search" aria-haspopup="dialog">{glass}</button>
  ) : (
    <button className="cp-trigger" onClick={open} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
      {glass}<span>Search</span><kbd>{isMac ? 'Cmd K' : 'Ctrl K'}</kbd>
    </button>
  )
}

export function Mark() {
  return (
    <span className="brand-tile" aria-hidden>
      <svg className="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" strokeLinecap="round" opacity="0.35" />
        <path d="M12 4l2 8-2 8-2-8z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

interface SyncShape { state?: string; lastSyncedAt?: string | null }

function ago(iso?: string | null) {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

/** Reads setting `sync.status` (read-only). Links to Settings. */
export function SyncChip({ dotOnly = false }: { dotOnly?: boolean }) {
  const st = useLiveQuery(() => getSetting<SyncShape | null>('sync.status', null), [])
  const state = st?.state ?? 'off'
  const tone = state === 'up-to-date' ? 'good' : state === 'error' ? 'warn' : state === 'off' ? 'neutral' : 'info'
  const label =
    state === 'off' ? 'Sync off'
    : state === 'up-to-date' ? `Synced ${ago(st?.lastSyncedAt)}`.trim()
    : state === 'syncing' ? 'Syncing'
    : state === 'locked' ? 'Sync locked'
    : state === 'offline' ? 'Offline'
    : 'Sync error'
  return (
    <Link to="/settings" className={`sync-chip status-${tone}`} aria-label={`${label}. Open Settings`} title={label}>
      <span className="status-dot" aria-hidden />
      {!dotOnly && <span className="sync-text">{label}</span>}
    </Link>
  )
}

/** Top-bar context: district, then the tab inside it ("Money" / "Markets"). Home reads "Northstar". */
function useRouteContext() {
  const { pathname, search } = useLocation()
  if (districtForPath(pathname) === 'home') return { label: 'Northstar', group: '' }
  const [d, tab] = breadcrumb(pathname, search)
  return tab ? { group: d, label: tab } : { group: '', label: d }
}

const dateLabel = () => parseISODate(today()).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function TopBar() {
  const phone = useMedia(PHONE_QUERY)
  const ctx = useRouteContext()
  const { search, pathname } = useLocation()
  const you = districtForPath(pathname) === 'you'
  const navigate = useNavigate()
  const openCapture = () => (phone ? window.dispatchEvent(new Event(OPEN_CAPTURE_SHEET)) : window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' })))
  // PWA shortcut "Quick capture" opens #/?capture=1: focus the capture line (desktop) or open the sheet (phone).
  useEffect(() => {
    if (!new URLSearchParams(search).has('capture')) return
    navigate('/', { replace: true })
    setTimeout(openCapture, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, phone, navigate])
  // "New task" in the palette: focus the capture line (desktop) or open the capture sheet (phone).
  useEffect(() => {
    window.addEventListener('ns:capture', openCapture)
    return () => window.removeEventListener('ns:capture', openCapture)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone])
  return (
    <header className="topbar">
      <div className="topbar-ctx">
        {!phone && <Mark />}
        {ctx.group && <span className="topbar-group">{ctx.group}</span>}
        <span className="topbar-title">{ctx.label}</span>
      </div>
      {!phone && <div className="topbar-capture"><QuickCapture /></div>}
      <div className="topbar-right">
        {phone && <PlayerStrip />}
        <SearchButton compact={phone} />
        <SyncChip dotOnly={phone} />
        {!phone && <span className="topbar-date mono">{dateLabel()}</span>}
        <Link to="/you" className={`icon-btn topbar-you${you ? ' is-active' : ''}`} aria-label="You" aria-current={you ? 'true' : undefined}><Icon name="user" size={18} /></Link>
      </div>
      <PaletteHost />
      <BulkHost />
      <SetupHost />
    </header>
  )
}

const QUICK_LOGS: Array<{ label: string; icon: IconName; text: string; hint: string }> = [
  { label: 'Weigh-in', icon: 'weight', text: 'w ', hint: 'w 182.4' },
  { label: 'Meal', icon: 'food', text: 'ate ', hint: 'ate oats 350cal' },
  { label: 'Win', icon: 'win', text: 'win: ', hint: 'win: shipped it #career' },
  { label: 'Journal', icon: 'journal', text: 'journal: ', hint: 'journal: long walk' },
]

/** Phone capture sheet: the same one-line capture (same parser and save path) plus one-tap quick-log prefixes. */
function CaptureSheet({ onClose }: { onClose: () => void }) {
  const [seed, setSeed] = useState<{ text: string; n: number } | undefined>()
  const [hint, setHint] = useState('')
  return (
    <BottomSheet title="Capture" onClose={onClose}>
      <QuickCapture autoFocus seed={seed} />
      <div className="qlog" role="group" aria-label="Quick logs">
        {QUICK_LOGS.map((q) => (
          <button key={q.label} type="button" className="qlog-btn" onClick={() => { setSeed({ text: q.text, n: Date.now() }); setHint(q.hint) }}>
            <Icon name={q.icon} size={18} />
            <span>{q.label}</span>
          </button>
        ))}
      </div>
      <p className="qlog-help">{hint ? <>For example <span className="mono">{hint}</span>, then Enter.</> : <>One line: a task, <span className="mono">$12 lunch</span>, <span className="mono">w 182.4</span>, <span className="mono">ate oats 350cal</span>, <span className="mono">win: …</span>, <span className="mono">journal: …</span></>}</p>
    </BottomSheet>
  )
}

export function CaptureHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_CAPTURE_SHEET, onOpen)
    return () => window.removeEventListener(OPEN_CAPTURE_SHEET, onOpen)
  }, [])
  return open ? <CaptureSheet onClose={() => setOpen(false)} /> : null
}

/** Phone capture orb: floats bottom-right above the district strip (lifted above pages that pin an add line). */
export function CaptureOrb() {
  return (
    <button type="button" className="capture-orb" aria-label="Capture" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(OPEN_CAPTURE_SHEET))}>
      <Icon name="plus" size={22} />
    </button>
  )
}
