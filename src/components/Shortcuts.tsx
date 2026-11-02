// Keyboard shortcuts overlay. Opens with `?` (never while typing or while another dialog is open), from the palette
// footer and from Settings (event `ns:shortcuts`). Lists only shortcuts that exist; keep SHORTCUT_GROUPS in step with
// the handlers (Shell, QuickCapture, CommandPalette, pages/Tasks, pages/Ops, journal/FocusMode).
import { useEffect, useState } from 'react'
import { Modal } from './ui'
import { isTypingTarget, OPEN_SHORTCUTS, SHORTCUT_GROUPS } from './shortcutsData'

export function Kbd({ k }: { k: string[] }) {
  return (
    <span className="kbd-combo">
      {k.map((p, i) => <kbd key={i} className="kbd">{p}</kbd>)}
    </span>
  )
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} wide>
      <div className="ks-grid">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.name} className="ks-group" aria-labelledby={`ks-${g.name}`}>
            <h3 className="ks-head" id={`ks-${g.name}`}>{g.name}</h3>
            <dl className="ks-list">
              {g.items.map((it) => (
                <div key={it.label} className="ks-row">
                  <dt>{it.label}</dt>
                  <dd>
                    {it.keys.map((k, i) => (
                      <span key={i} className="ks-alt">{i > 0 && <span className="ks-or">or</span>}<Kbd k={k} /></span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="ks-foot">
        <span className="small muted">Single-key shortcuts pause while you type in a field.</span>
        <button className="btn" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}

/** Mounted once in the shell. */
export function ShortcutsHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      if (isTypingTarget(e.target as HTMLElement | null)) return
      if (document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      setOpen(true)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_SHORTCUTS, onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_SHORTCUTS, onOpen) }
  }, [])
  return open ? <ShortcutsDialog onClose={() => setOpen(false)} /> : null
}
