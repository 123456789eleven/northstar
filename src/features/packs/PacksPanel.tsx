import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card } from '../../components/ui'
import { db } from '../../db'
import { installPack, packKey, removePack, type PackRecord } from './packActions'
import { PACKS, packCounts, type Pack } from './packDefs'
import './packs.css'

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

function countsText(p: Pack) {
  const c = packCounts(p)
  return [
    c.goals && plural(c.goals, 'goal'),
    c.learning && plural(c.learning, 'learning item'),
    c.habits && plural(c.habits, 'habit'),
    c.tasks && plural(c.tasks, 'task'),
    c.budgets && plural(c.budgets, 'budget category', 'budget categories'),
  ].filter(Boolean).join(' · ')
}

function Preview({ p }: { p: Pack }) {
  const sections: [string, string[]][] = [
    ['Goals', (p.goals ?? []).map((g) => `${g.title} (${g.horizon}${g.milestones?.length ? `, ${plural(g.milestones.length, 'milestone')}` : ''})`)],
    ['Learning', (p.learning ?? []).map((l) => `${l.title} · ${l.note.replace('Suggested: ', '')}`)],
    ['Habits', (p.habits ?? []).map((h) => `${h.name} · ${h.perWeek}/week`)],
    ['Tasks', (p.tasks ?? []).map((t) => `${t.title}${t.recurrence !== 'none' ? ` · ${t.recurrence}` : ''}`)],
    ['Budgets', (p.budgets ?? []).map((b) => `${b.category} · $${b.monthlyLimit}/mo`)],
  ]
  return (
    <div className="pack-preview">
      {p.note && <p className="small muted" style={{ margin: '0 0 8px' }}>{p.note}</p>}
      {sections.filter(([, l]) => l.length).map(([h, list]) => (
        <div key={h}>
          <div className="tiny faint pack-h">{h}</div>
          <ul>{list.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ))}
    </div>
  )
}

export default function PacksPanel() {
  const recs = useLiveQuery(async () => {
    const out: Record<string, PackRecord | undefined> = {}
    for (const p of PACKS) out[p.id] = (await db.settings.get(packKey(p.id)))?.value as PackRecord | undefined
    return out
  }, [])
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (!recs) return null

  async function run(fn: () => Promise<string>) {
    setBusy(true)
    try { setMsg(await fn()) } catch (e) { setMsg(`Something went wrong: ${(e as Error).message}`) } finally { setBusy(false) }
  }

  return (
    <Card title="Starter packs">
      <p className="small muted" style={{ marginTop: 0 }}>
        Optional bundles of editable goals, habits, tasks and learning items. Everything is added as normal data you can change or delete. Nothing is added until you tap Install.
      </p>
      <div className="pack-list">
        {PACKS.map((p) => {
          const installed = !!recs[p.id]
          return (
            <div key={p.id} className="pack">
              <div className="pack-head">
                <div className="grow">
                  <div className="pack-name">{p.name}</div>
                  <div className="small muted">{p.blurb}</div>
                  <div className="tiny faint" style={{ marginTop: 4 }}>What you get: {countsText(p)}</div>
                </div>
                <div className="pack-actions">
                  <button className="btn btn-sm btn-ghost" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                    {open === p.id ? 'Hide' : 'Preview'}
                  </button>
                  {installed ? (
                    <button
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Remove "${p.name}"? Only items you have not changed are deleted; anything you edited, completed or checked in is kept.`)) return
                        void run(async () => {
                          const r = await removePack(p.id)
                          return `Removed ${plural(r.removed, 'item')}${r.kept ? `, kept ${r.kept} you had changed` : ''}.`
                        })
                      }}
                    >
                      Installed · Remove
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={busy}
                      onClick={() => void run(async () => {
                        const r = await installPack(p)
                        return `Added ${plural(r.added, 'item')}${r.skipped ? `, skipped ${r.skipped} that already exist` : ''}.`
                      })}
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
              {open === p.id && <Preview p={p} />}
            </div>
          )
        })}
      </div>
      {msg && <p className="small pack-msg" role="status" style={{ marginBottom: 0 }}>{msg}</p>}
    </Card>
  )
}
