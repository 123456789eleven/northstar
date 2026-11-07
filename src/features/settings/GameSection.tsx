// Settings > Progress: haptics, sound, motion, weekly target and the counting table ("How activity is counted").
// All device-local (`game.*` settings, never synced). Nothing here asks for a permission.
import { useState } from 'react'
import { Card } from '../../components/ui'
import { useGameSettings } from '../game/gameSettings'
import { XP_TABLE } from '../game/engine/xpTable'
import { SKILLS } from '../game/types'
import { haptic, setHapticsEnabled } from '../../lib/haptics'
import { setSoundEnabled, tick } from '../../lib/sound'

const SKILL_LABEL: Record<string, string> = Object.fromEntries(SKILLS.map((s) => [s.id, s.label]))
const skillText = (r: (typeof XP_TABLE)[number]) => (r.skill === 'goal' ? `Goal's area (else ${SKILL_LABEL[r.fallback ?? 'mind']})` : r.skill === 'top' ? 'Your busiest area that day' : SKILL_LABEL[r.skill])

function Switch({ id, label, help, checked, onChange }: { id: string; label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="set-pref-row">
      <div className="set-pref-text">
        <span className="set-pref-label" id={`${id}-l`}>{label}</span>
        <span className="small muted" id={`${id}-h`}>{help}</span>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} aria-describedby={`${id}-h`} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch-knob" aria-hidden />
      </button>
    </div>
  )
}

export function GameSection() {
  const g = useGameSettings()
  const [showTable, setShowTable] = useState(false)
  return (
    <Card title="Progress">
      <p className="set-text small muted">Rings, the plan and your week come only from things you already log. Nothing is ever taken away. These settings stay on this device.</p>
      <Switch id="g-haptics" label="Haptics" help="A light tick when a plan item completes. Phones that support vibration only." checked={g.haptics} onChange={(v) => { setHapticsEnabled(v); if (v) haptic('tick'); void g.set('haptics', v) }} />
      <Switch id="g-sound" label="Sound" help="A quiet tick on the same moments. Off by default." checked={g.sound} onChange={(v) => { setSoundEnabled(v); if (v) tick('tick'); void g.set('sound', v) }} />
      <div className="set-pref-row">
        <div className="set-pref-text">
          <span className="set-pref-label" id="g-motion">Motion</span>
          <span className="small muted">Reduced turns off springs, count-ups and the completion toast app-wide (your system setting is always respected).</span>
        </div>
        <div className="seg" role="radiogroup" aria-labelledby="g-motion">
          {(['full', 'reduced'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={g.motion === m} className="seg-btn" onClick={() => void g.set('motion', m)}>{m === 'full' ? 'Full' : 'Reduced'}</button>
          ))}
        </div>
      </div>
      <div className="set-pref-row">
        <div className="set-pref-text">
          <label className="set-pref-label" htmlFor="g-week">Active days a week</label>
          <span className="small muted">How many days a week fill your rings. Two grace days a week cover days off, and a run never resets in a day.</span>
        </div>
        <select id="g-week" className="select set-week" value={g.weekTarget} onChange={(e) => void g.set('weekTarget', Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
        </select>
      </div>
      <div className="set-pref-row">
        <div className="set-pref-text">
          <span className="set-pref-label">How activity is counted</span>
          <span className="small muted">Every rule, its area, its weight and its daily cap. The same table drives the rings.</span>
        </div>
        <button type="button" className="btn btn-sm" aria-expanded={showTable} aria-controls="count-table" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Hide counting table' : 'Show counting table'}</button>
      </div>
      {showTable && (
        <div className="table-wrap set-xp" id="count-table">
          <table className="table">
            <caption className="sr-only">Counting table</caption>
            <thead><tr><th scope="col">Action</th><th scope="col">Area</th><th scope="col" className="num">Weight</th><th scope="col" className="num">Daily cap</th><th scope="col">Rule</th></tr></thead>
            <tbody>
              {XP_TABLE.map((r) => (
                <tr key={r.kind}>
                  <th scope="row">{r.label}</th>
                  <td>{skillText(r)}</td>
                  <td className="num mono set-xp-n">+{r.xp}</td>
                  <td className="num mono">{r.cap}</td>
                  <td className="small muted">{r.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
