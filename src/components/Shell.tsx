// App shell parts: desktop rail, top bar (context, capture, sync, date), phone bottom bar + More sheet.
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from '../db'
import { parseISODate, today } from '../lib/dates'
import QuickCapture from './QuickCapture'
import BottomSheet from './BottomSheet'
import { Icon } from './Icons'
import { NAV, NAV_GROUPS, PRIMARY_TABS } from './nav'
import { useMedia, PHONE_QUERY } from './useMedia'

export function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" strokeLinecap="round" opacity="0.35" />
      <path d="M12 4l2 8-2 8-2-8z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Rail() {
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand"><Mark />Northstar</div>
      {NAV_GROUPS.map((g) => (
        <div key={g} className="nav-group" role="group" aria-label={g}>
          <div className="nav-section">{g}</div>
          {NAV.filter((n) => n.group === g).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
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

function useRouteContext() {
  const { pathname } = useLocation()
  const item = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))
  return item ?? { label: 'Northstar', group: '' }
}

const dateLabel = () => parseISODate(today()).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function TopBar() {
  const phone = useMedia(PHONE_QUERY)
  const [open, setOpen] = useState(false)
  const ctx = useRouteContext()
  const { search } = useLocation()
  const navigate = useNavigate()
  // PWA shortcut "Quick capture" opens #/?capture=1: focus the capture line (desktop) or open the sheet (phone).
  useEffect(() => {
    if (!new URLSearchParams(search).has('capture')) return
    navigate('/', { replace: true })
    setTimeout(() => (phone ? setOpen(true) : window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))), 0)
  }, [search, phone, navigate])
  return (
    <header className="topbar">
      <div className="topbar-ctx">
        {ctx.group && <span className="topbar-group">{ctx.group}</span>}
        <span className="topbar-title">{ctx.label}</span>
      </div>
      {!phone && <div className="topbar-capture"><QuickCapture /></div>}
      <div className="topbar-right">
        <SyncChip dotOnly={phone} />
        {!phone && <span className="topbar-date mono">{dateLabel()}</span>}
        {phone && (
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Quick capture">
            <Icon name="capture" size={18} />
          </button>
        )}
      </div>
      {phone && open && (
        <BottomSheet title="Capture" onClose={() => setOpen(false)}>
          <QuickCapture autoFocus />
        </BottomSheet>
      )}
    </header>
  )
}

export function TabBar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const tabs = PRIMARY_TABS.map((to) => NAV.find((n) => n.to === to)!)
  const moreActive = !PRIMARY_TABS.some((to) => (to === '/' ? pathname === '/' : pathname.startsWith(to)))
  return (
    <>
      <nav className="tabbar" aria-label="Main mobile">
        {tabs.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button className={`tab-item ${moreActive ? 'active' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Icon name="more" size={20} />
          <span>More</span>
        </button>
      </nav>
      {open && (
        <BottomSheet title="More" onClose={() => setOpen(false)}>
          {NAV_GROUPS.map((g) => {
            const items = NAV.filter((n) => n.group === g && !PRIMARY_TABS.includes(n.to))
            if (!items.length) return null
            return (
              <div key={g} className="more-group">
                <div className="nav-section">{g}</div>
                <div className="more-grid">
                  {items.map((n) => (
                    <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className={({ isActive }) => `more-link ${isActive ? 'active' : ''}`}>
                      <Icon name={n.icon} />
                      {n.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </BottomSheet>
      )}
    </>
  )
}
